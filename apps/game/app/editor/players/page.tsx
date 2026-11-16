"use client";

// HM-PLAYER-DATA-EDITOR-1.0: the bulk player calibration workspace --
// every Handbollsligan + Allsvenskan player in one compact,
// spreadsheet-like table with inline editing, so the manager can go
// through hundreds of players quickly without opening a separate
// profile page per player (the pre-existing per-player editors at
// /editor/players/[playerId] and /editor/ratings/[playerId] still exist
// for a deep-dive, but are no longer the primary calibration workflow).
//
// Every field this page writes goes through the SAME canonical
// resolution path a fresh career already reads:
//  - position / birth data / permanent squad-status default / special
//    tags -> lib/editor/playerRepository.ts's savePlayerEdit (same
//    atomic-write/backup/diff mechanism the single-player editor uses)
//    -> data/real-world/.../players-*.json + roster-*.json -> read by
//    gameWorldAdapter.ts's toPlayerMock on every career creation.
//  - CA/PA -> lib/editor/ratingCalibration.ts's calibratePlayerRating,
//    which composes the SAME draft-override + lock steps the
//    single-player rating editor's Override/Lock buttons already
//    perform -> lib/editor/ratingDatabaseRepository.ts's locked
//    database -> read FIRST by gameplayRatingSnapshot.ts's resolver
//    (LOCKED > CALIBRATED > ESTIMATED > GENERATED_GAME_PRIOR), which is
//    what every fresh career's gameplayRatings snapshot is built from.
// There is no third, parallel data source anywhere in this page.
//
// Arena Nights SYS-02a (A) "Keep spreadsheet, add dev affordances": sticky header and name
// column, column filters (+ "only unsaved"), dirty-cell highlight, a batch save bar, Ctrl+S
// (save all) and Ctrl+Z / Ångra (undo the last cell edit). Save paths are unchanged.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DevPageHead } from "@/components/dev/DevShell";
import { abilityStarsFromCA, potentialStarsFromPA } from "@/lib/development/types";
import { SortableTh, applySortDirection, type SortState } from "@/components/SortableTh";
import StarRating from "@/components/StarRating";
import { formatEur } from "@/lib/economy/currency";
import {
  isSourceDirty,
  isRatingDirty,
  isDirty,
  matchesFilters,
  dirtyPlayerIds as computeDirtyPlayerIds,
  runSaveAll,
  applySaveOutcome,
} from "@/lib/editor/bulkEditorState";
import { countDirtyCells, dirtyFields, pickBefore, popEditStep, pushEditStep, revertPatch, type BulkEditableField, type EditStep } from "@/lib/editor/calibrationEdits";
import "./players.css";

const CANONICAL_POSITIONS = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"] as const;
type CanonicalPosition = (typeof CANONICAL_POSITIONS)[number];
const SQUAD_STATUS_TIER_VALUES = ["KEY_PLAYER", "FIRST_CHOICE", "ROTATION", "SQUAD_PLAYER", "TALENT"] as const;
type SquadStatusTierValue = (typeof SQUAD_STATUS_TIER_VALUES)[number];
const SQUAD_STATUS_LABEL_SV: Record<SquadStatusTierValue, string> = {
  KEY_PLAYER: "Nyckelspelare",
  FIRST_CHOICE: "Förstaval",
  ROTATION: "Rotation",
  SQUAD_PLAYER: "Truppspelare",
  TALENT: "Talang",
};
const PLAYER_TAG_VALUES = ["ATTACK_SPECIALIST", "DEFENCE_SPECIALIST", "SEVEN_METER_TAKER", "SEVEN_VS_SIX_IMPORTANT", "CAPTAIN", "FIRST_GOALKEEPER", "BACKUP_GOALKEEPER"] as const;
type PlayerTagValue = (typeof PLAYER_TAG_VALUES)[number];
const PLAYER_TAG_LABEL_SV: Record<PlayerTagValue, string> = {
  ATTACK_SPECIALIST: "Anfallsspecialist",
  DEFENCE_SPECIALIST: "Försvarsspecialist",
  SEVEN_METER_TAKER: "Straffskytt",
  SEVEN_VS_SIX_IMPORTANT: "Viktig i 7-mot-6",
  CAPTAIN: "Lagkapten",
  FIRST_GOALKEEPER: "Förstemålvakt",
  BACKUP_GOALKEEPER: "Reservmålvakt",
};

interface ApiPlayer {
  playerId: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  competitionSlug: string;
  player: {
    firstName: string; lastName: string; fullName: string; dateOfBirth: string | null; birthYear: number | null;
    nationalities: string[] | null; heightCm: number | null; handedness: "LEFT" | "RIGHT" | null; recordConfidence: "VERIFIED" | "PARTIAL" | "UNKNOWN";
  };
  roster: {
    shirtNumber: number | null; sourcePosition: string; primaryPosition: CanonicalPosition; secondaryPositions: CanonicalPosition[];
    rosterStatus: string; contract: { untilDate: string | null; untilSeason: string | null; optionUntilSeason: string | null }; rosterConfidence: "VERIFIED" | "PARTIAL" | "UNKNOWN";
    defaultSquadStatus: SquadStatusTierValue | null; specialTags: PlayerTagValue[];
  };
  readOnly: { ageYears: number | null; contractEndDisplay: string; marketValueEurPreview: number | null };
  rating: { ca: number | null; pa: number | null; abilityStars: number; potentialStars: number; caSource: string; paSource: string; locked: boolean; matchedCalibration: boolean };
}

interface RowVM {
  playerId: string;
  clubId: string;
  clubName: string;
  competitionSlug: string;
  fullName: string;
  primaryPosition: CanonicalPosition;
  dateOfBirth: string | null;
  birthYear: number | null;
  defaultSquadStatus: SquadStatusTierValue | null;
  specialTags: PlayerTagValue[];
  ca: number | null;
  pa: number | null;
  // read-only display
  abilityStars: number;
  potentialStars: number;
  caSource: string;
  paSource: string;
  locked: boolean;
  ageYears: number | null;
  marketValueEurPreview: number | null;
  contractEndDisplay: string;
  recordConfidence: string;
  rosterConfidence: string;
  // preserved originals, so a save never clobbers a field this page doesn't expose
  _player: ApiPlayer["player"];
  _roster: ApiPlayer["roster"];
}

function toRowVM(p: ApiPlayer): RowVM {
  return {
    playerId: p.playerId,
    clubId: p.clubId,
    clubName: p.clubName,
    competitionSlug: p.competitionSlug,
    fullName: p.player.fullName,
    primaryPosition: p.roster.primaryPosition,
    dateOfBirth: p.player.dateOfBirth,
    birthYear: p.player.birthYear,
    defaultSquadStatus: p.roster.defaultSquadStatus,
    specialTags: p.roster.specialTags,
    ca: p.rating.ca,
    pa: p.rating.pa,
    abilityStars: p.rating.abilityStars,
    potentialStars: p.rating.potentialStars,
    caSource: p.rating.caSource,
    paSource: p.rating.paSource,
    locked: p.rating.locked,
    ageYears: p.readOnly.ageYears,
    marketValueEurPreview: p.readOnly.marketValueEurPreview,
    contractEndDisplay: p.readOnly.contractEndDisplay,
    recordConfidence: p.player.recordConfidence,
    rosterConfidence: p.roster.rosterConfidence,
    _player: p.player,
    _roster: p.roster,
  };
}

// SOURCE fields (position/birth/status/tags) and RATING fields (CA/PA) are
// independent edits with independent canonical write paths -- see the
// header comment above. Tracking them separately lets save-orchestration
// dispatch only the part that actually changed (HM-PLAYER-DATA-EDITOR-1.0A),
// instead of coupling a pure position edit to CA/PA validation/writes.
//
// The rules themselves live in lib/editor/bulkEditorState.ts so the save
// lifecycle is testable without a DOM (HM-PLAYER-DATA-EDITOR-1.0C).

// The data editor edits canonical EUR source values, so it always shows EUR (never the display currency).
function formatEditorEur(v: number | null): string {
  return v === null ? "—" : formatEur(v);
}

const CA_SOURCE_LABEL_SV: Record<string, string> = {
  CALIBRATED: "Kalibrerad",
  MODEL_ESTIMATE: "Modellskattad",
  GENERATED_GAME_PRIOR: "Genererad",
  EDITOR_OVERRIDE: "Manuellt satt",
  UNRESOLVED: "Olöst",
};

type SortKey = "name" | "club" | "league" | "position" | "age" | "status" | "ca" | "pa" | "marketValue" | "confidence";

export default function PlayerCalibrationWorkspace() {
  const router = useRouter();
  const [rows, setRows] = useState<RowVM[]>([]);
  const [originals, setOriginals] = useState<Record<string, RowVM>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, { saving?: boolean; error?: string | null; savedAt?: number }>>({});
  // HM-PLAYER-DATA-EDITOR-1.0C: the outcome of the last "Spara alla" run,
  // shown as a banner. The per-row error cell lives in the LAST column of a
  // 17-column table and is therefore off-screen at any normal window width --
  // a failure must never be reported only there.
  const [saveAllState, setSaveAllState] = useState<{ running: boolean; done: number; total: number; failed: { playerId: string; name: string }[] } | null>(null);

  const [leagueFilter, setLeagueFilter] = useState<string>("");
  const [clubFilter, setClubFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<SortKey> | null>(null);
  // SYS-02a: every inline edit records the cell's previous value so Ctrl+Z / Ångra can undo it.
  const [undoStack, setUndoStack] = useState<EditStep<RowVM>[]>([]);
  const [onlyDirty, setOnlyDirty] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(null);
    fetch("/api/editor/players-bulk")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { players: ApiPlayer[] }) => {
        const vms = (data.players ?? []).map(toRowVM);
        setRows(vms);
        setOriginals(Object.fromEntries(vms.map((r) => [r.playerId, r])));
      })
      .catch((err) => setLoadError(String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const leagues = useMemo(() => Array.from(new Set(rows.map((r) => r.competitionSlug))).sort(), [rows]);
  const clubs = useMemo(() => {
    const scoped = leagueFilter ? rows.filter((r) => r.competitionSlug === leagueFilter) : rows;
    return Array.from(new Map(scoped.map((r) => [r.clubId, r.clubName])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, leagueFilter]);

  // HM-PLAYER-DATA-EDITOR-1.0C: POSITION and TRUPPSTATUS match on the row's
  // SAVED value, never on the in-progress draft. Filtering on the draft made
  // a row delete itself from the table the instant it was edited -- filter by
  // POSITION=MV, correct a goalkeeper to H9, and the row (and its own Spara
  // button) vanished mid-edit, which reads exactly like "the edit did not
  // take". The filter now describes what is ON DISK; a row leaves the view
  // only once its edit has actually been saved.
  const filtered = useMemo(() => {
    const filters = { league: leagueFilter, club: clubFilter, position: positionFilter, status: statusFilter, search };
    return rows.filter((r) => {
      if (!matchesFilters(r, originals[r.playerId], filters)) return false;
      const saved = originals[r.playerId];
      return !onlyDirty || (saved ? isDirty(r, saved) : false);
    });
  }, [rows, originals, leagueFilter, clubFilter, positionFilter, statusFilter, search, onlyDirty]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp: number;
      switch (sort.key) {
        case "name":
          cmp = a.fullName.localeCompare(b.fullName);
          break;
        case "club":
          cmp = a.clubName.localeCompare(b.clubName);
          break;
        case "league":
          cmp = a.competitionSlug.localeCompare(b.competitionSlug);
          break;
        case "position":
          cmp = a.primaryPosition.localeCompare(b.primaryPosition);
          break;
        case "age":
          cmp = (a.ageYears ?? -1) - (b.ageYears ?? -1);
          break;
        case "status":
          cmp = (a.defaultSquadStatus ?? "").localeCompare(b.defaultSquadStatus ?? "");
          break;
        case "ca":
          cmp = (a.ca ?? -1) - (b.ca ?? -1);
          break;
        case "pa":
          cmp = (a.pa ?? -1) - (b.pa ?? -1);
          break;
        case "marketValue":
          cmp = (a.marketValueEurPreview ?? -1) - (b.marketValueEurPreview ?? -1);
          break;
        case "confidence":
          cmp = a.rosterConfidence.localeCompare(b.rosterConfidence);
          break;
        default:
          cmp = 0;
      }
      return applySortDirection(sort.direction, cmp);
    });
  }, [filtered, sort]);

  function updateRow(playerId: string, patch: Partial<RowVM>) {
    const current = rows.find((r) => r.playerId === playerId);
    if (current) setUndoStack((prev) => pushEditStep(prev, { playerId, before: pickBefore(current, Object.keys(patch) as (keyof RowVM)[]) }));
    setRows((prev) => prev.map((r) => (r.playerId === playerId ? { ...r, ...patch } : r)));
  }

  const undo = useCallback(() => {
    const { step, rest } = popEditStep(undoStack);
    if (!step) return;
    setUndoStack(rest);
    setRows((prev) => prev.map((r) => (r.playerId === step.playerId ? { ...r, ...step.before } : r)));
  }, [undoStack]);

  function revertAll() {
    if (!window.confirm("Återställ alla osparade ändringar till sparade värden?")) return;
    setRows((prev) => prev.map((r) => {
      const saved = originals[r.playerId];
      return saved ? { ...r, ...revertPatch(saved) } : r;
    }));
    setUndoStack([]);
  }

  // PA>=CA only blocks a save when the rating fields are actually the
  // thing being edited -- an untouched, possibly-inconsistent generated/
  // estimated CA/PA pair must never block a pure position/birth/status/tag
  // edit (HM-PLAYER-DATA-EDITOR-1.0A). Pass the original row explicitly so
  // this stays correct even before `originals` has settled for a brand-new
  // load.
  function paError(row: RowVM, original: RowVM | undefined): string | null {
    if (!original || !isRatingDirty(row, original)) return null;
    if (row.ca !== null && row.pa !== null && row.pa < row.ca) return "PA måste vara ≥ CA.";
    return null;
  }

  async function saveRow(playerId: string): Promise<boolean> {
    const row = rows.find((r) => r.playerId === playerId);
    const original = originals[playerId];
    if (!row || !original) return false;

    const sourceDirty = isSourceDirty(row, original);
    const ratingDirty = isRatingDirty(row, original);
    if (!sourceDirty && !ratingDirty) return true;

    const err = paError(row, original);
    if (err) {
      setRowState((prev) => ({ ...prev, [playerId]: { error: err } }));
      return false;
    }

    setRowState((prev) => ({ ...prev, [playerId]: { saving: true, error: null } }));

    // Dispatch only the canonical write path(s) that actually changed --
    // a source-only edit never touches the rating override/lock store, and
    // a rating-only edit never rewrites the source JSON files. `primaryPosition`
    // is always sent (even when source itself is unchanged) because rating
    // calibration needs it to resolve the correct outcourt/goalkeeper attribute
    // branch, independent of whether roster is included in this save.
    const player = sourceDirty ? { ...row._player, dateOfBirth: row.dateOfBirth, birthYear: row.birthYear } : undefined;
    const roster = sourceDirty
      ? { ...row._roster, primaryPosition: row.primaryPosition, defaultSquadStatus: row.defaultSquadStatus, specialTags: row.specialTags }
      : undefined;
    const rating = ratingDirty ? { ca: row.ca ?? undefined, pa: row.pa ?? undefined } : undefined;

    try {
      const res = await fetch(`/api/editor/players-bulk/${encodeURIComponent(playerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: row.clubId, primaryPosition: row.primaryPosition, player, roster, rating }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowState((prev) => ({ ...prev, [playerId]: { saving: false, error: (data.errors ?? [data.error]).join("; ") } }));
        return false;
      }
      // Baseline is promoted ONLY here, after a confirmed 2xx -- never
      // optimistically, so a failed or never-dispatched save always leaves
      // the row dirty (HM-PLAYER-DATA-EDITOR-1.0C).
      setOriginals((prev) => applySaveOutcome(prev, playerId, row, true));
      setRowState((prev) => ({ ...prev, [playerId]: { saving: false, error: null, savedAt: Date.now() } }));
      return true;
    } catch (err) {
      setRowState((prev) => ({ ...prev, [playerId]: { saving: false, error: String(err) } }));
      return false;
    }
  }

  const dirtyPlayerIds = useMemo(() => computeDirtyPlayerIds(rows, originals), [rows, originals]);

  async function saveAll() {
    const ids = dirtyPlayerIds;
    if (ids.length === 0) return;
    setSaveAllState({ running: true, done: 0, total: ids.length, failed: [] });
    let done = 0;
    const outcome = await runSaveAll(ids, async (id) => {
      const ok = await saveRow(id);
      done += 1;
      setSaveAllState((prev) => ({ running: true, done, total: ids.length, failed: prev?.failed ?? [] }));
      return ok;
    });
    setSaveAllState({
      running: false,
      done: outcome.attempted.length,
      total: ids.length,
      failed: outcome.failed.map((id) => ({ playerId: id, name: rows.find((r) => r.playerId === id)?.fullName ?? id })),
    });
  }

  // HM-PLAYER-DATA-EDITOR-1.0C: unsaved edits live only in this component's
  // state -- a reload, a dev-server full refresh, or an in-app navigation
  // silently destroyed every pending edit and returned the page to
  // "Spara alla (0)", which is indistinguishable from never having edited at
  // all. Both exits are now guarded.
  useEffect(() => {
    if (dirtyPlayerIds.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyPlayerIds.length]);

  function confirmLeave(): boolean {
    return dirtyPlayerIds.length === 0 || window.confirm(`${dirtyPlayerIds.length} osparade ändringar går förlorade om du lämnar sidan. Lämna ändå?`);
  }

  function leaveEditor() {
    if (!confirmLeave()) return;
    router.push("/editor");
  }

  function guardLink(e: MouseEvent<HTMLAnchorElement>) {
    if (!confirmLeave()) e.preventDefault();
  }

  const dirtyCellCount = useMemo(() => countDirtyCells(rows, originals), [rows, originals]);

  // SYS-02a keyboard: Ctrl/Cmd+S saves every dirty row; Ctrl/Cmd+Z undoes the last cell edit
  // (left to the browser inside text-like inputs, where it already undoes typing).
  const saveAllRef = useRef<() => void>(() => {});
  useEffect(() => {
    saveAllRef.current = () => void saveAll();
  });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        saveAllRef.current();
      } else if (key === "z" && !e.shiftKey) {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement && ["text", "search", "number", "date"].includes(el.type)) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  function focusNextRow(playerId: string, columnSelector: string) {
    const idx = sorted.findIndex((r) => r.playerId === playerId);
    const next = sorted[idx + 1];
    if (!next) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-row="${next.playerId}"] ${columnSelector}`);
      el?.focus();
    });
  }

  function handleEnterKey(e: KeyboardEvent<HTMLInputElement>, playerId: string, columnSelector: string) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    saveRow(playerId);
    focusNextRow(playerId, columnSelector);
  }

  const saving = saveAllState?.running ?? false;
  const nameSortDir = sort?.key === "name" ? sort.direction : null;

  return (
    <>
      <DevPageHead
        eyebrow="Data · Spelare"
        title={`Spelarkalibrering (${rows.length} spelare)`}
        note={
          <>
            Redigera direkt i tabellen. Ändrade celler markeras; spara alla med <span className="hm-dev-kbd">Ctrl</span>+<span className="hm-dev-kbd">S</span>, ångra
            senaste celländring med <span className="hm-dev-kbd">Ctrl</span>+<span className="hm-dev-kbd">Z</span>. Klicka ett namn för detaljvyn.
          </>
        }
        actions={
          <button type="button" className="hm-dev-btn" onClick={leaveEditor}>
            ← Dev-konsol
          </button>
        }
      />

      <div className="hm-dev-panel">
        <div className="hm-dev-panel-head">
          <span className="hm-dev-panel-title">Kolumnfilter</span>
          <span className="hm-dev-muted hm-dev-num">
            Visar {sorted.length} av {rows.length}
          </span>
        </div>
        <div className="hm-dev-panel-body ed-filters">
          <label className="ed-filter">
            Liga
            <select
              value={leagueFilter}
              onChange={(e) => {
                setLeagueFilter(e.target.value);
                setClubFilter("");
              }}
            >
              <option value="">Alla</option>
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-filter">
            Klubb
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
              <option value="">Alla</option>
              {clubs.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-filter">
            Position
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
              <option value="">Alla</option>
              {CANONICAL_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-filter">
            Truppstatus
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Alla</option>
              {SQUAD_STATUS_TIER_VALUES.map((s) => (
                <option key={s} value={s}>
                  {SQUAD_STATUS_LABEL_SV[s]}
                </option>
              ))}
              <option value="__NONE__" disabled>
                (ej kalibrerad)
              </option>
            </select>
          </label>
          <label className="ed-filter ed-filter--grow">
            Sök spelare
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Namn…" />
          </label>
          <div className="hm-dev-chips">
            <button type="button" className="hm-dev-chip" aria-pressed={onlyDirty} onClick={() => setOnlyDirty((v) => !v)}>
              Endast osparade ({dirtyPlayerIds.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="hm-dev-empty">Läser in spelare…</div>
        ) : loadError ? (
          <div className="hm-dev-panel-body">
            <div className="hm-dev-alert">Kunde inte läsa spelarna: {loadError}</div>
            <button type="button" className="hm-dev-btn" style={{ marginTop: 8 }} onClick={load}>
              Försök igen
            </button>
          </div>
        ) : (
          <div className="hm-dev-table-wrap">
            <table className="hm-dev-table">
              <thead>
                <tr>
                  <th className="hm-dev-sticky-col" aria-sort={nameSortDir ? (nameSortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      className="hm-sort-button"
                      onClick={() => setSort({ key: "name", direction: nameSortDir === "asc" ? "desc" : "asc" })}
                    >
                      Namn {nameSortDir ? (nameSortDir === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </th>
                  <SortableTh label="Klubb" sortKey="club" sort={sort} onSort={setSort} />
                  <SortableTh label="Liga" sortKey="league" sort={sort} onSort={setSort} />
                  <SortableTh label="Pos" sortKey="position" sort={sort} onSort={setSort} />
                  <th>Född</th>
                  <SortableTh label="Ålder" sortKey="age" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
                  <SortableTh label="Truppstatus" sortKey="status" sort={sort} onSort={setSort} />
                  <th>Tags</th>
                  <SortableTh label="CA" sortKey="ca" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
                  <SortableTh label="PA" sortKey="pa" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
                  <th>★ nu / pot</th>
                  <th>Källa CA/PA</th>
                  <SortableTh label="Marknadsvärde" sortKey="marketValue" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
                  <th>Kontrakt t.o.m.</th>
                  <SortableTh label="Källkonfidens" sortKey="confidence" sort={sort} onSort={setSort} />
                  <th>PlayerId</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const original = originals[row.playerId];
                  const dirty = original ? isDirty(row, original) : false;
                  const cells = dirtyFields(row, original);
                  const cell = (...fields: BulkEditableField[]) => (fields.some((f) => cells.has(f)) ? "hm-dev-dirty" : undefined);
                  const state = rowState[row.playerId] ?? {};
                  // HM-PLAYER-DATA-EDITOR-1.0B: a failed save's error can be about
                  // ANY field (e.g. a source-schema issue unrelated to CA/PA) --
                  // only paError's own PA>=CA check should redden the CA/PA inputs.
                  // The row's error MESSAGE still shows whatever actually failed.
                  const ratingErr = paError(row, original);
                  const err = state.error ?? ratingErr;
                  // The save state is mirrored in the sticky name column, which is always visible
                  // (the row's own Spara button sits in the last column). "Sparad" only after a confirmed write.
                  const mark = state.saving
                    ? { cls: "", glyph: "…", title: "Sparar…" }
                    : state.error
                      ? { cls: "ed-mark--error", glyph: "⚠", title: `Fel: ${state.error}` }
                      : dirty
                        ? { cls: "ed-mark--dirty", glyph: "●", title: "Osparade ändringar" }
                        : state.savedAt
                          ? { cls: "ed-mark--saved", glyph: "✓", title: "Sparad" }
                          : { cls: "", glyph: "", title: "" };
                  return (
                    <tr key={row.playerId} data-row={row.playerId}>
                      <td className="hm-dev-sticky-col" title={mark.title || undefined}>
                        <span className="ed-name">
                          <span className={`ed-mark ${mark.cls}`}>{mark.glyph}</span>
                          <Link href={`/editor/players/${encodeURIComponent(row.playerId)}?clubId=${encodeURIComponent(row.clubId)}`} onClick={guardLink}>
                            {row.fullName}
                          </Link>
                        </span>
                      </td>
                      <td>{row.clubName}</td>
                      <td className="hm-dev-muted">{row.competitionSlug}</td>
                      <td className={cell("primaryPosition")}>
                        <select
                          data-col="primaryPosition"
                          value={row.primaryPosition}
                          onChange={(e) => updateRow(row.playerId, { primaryPosition: e.target.value as CanonicalPosition })}
                        >
                          {CANONICAL_POSITIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={cell("dateOfBirth", "birthYear")}>
                        {row.dateOfBirth !== null ? (
                          <input
                            data-col="dateOfBirth"
                            type="date"
                            className="ed-date"
                            value={row.dateOfBirth}
                            onChange={(e) => updateRow(row.playerId, { dateOfBirth: e.target.value || null })}
                          />
                        ) : (
                          <input
                            data-col="birthYear"
                            type="number"
                            className="ed-num"
                            placeholder="År"
                            value={row.birthYear ?? ""}
                            onChange={(e) => updateRow(row.playerId, { birthYear: e.target.value === "" ? null : Number(e.target.value) })}
                          />
                        )}
                      </td>
                      <td className="hm-dev-num">{row.ageYears ?? "—"}</td>
                      <td className={cell("defaultSquadStatus")}>
                        <select
                          data-col="defaultSquadStatus"
                          value={row.defaultSquadStatus ?? ""}
                          onChange={(e) => updateRow(row.playerId, { defaultSquadStatus: e.target.value === "" ? null : (e.target.value as SquadStatusTierValue) })}
                        >
                          <option value="">— ej kalibrerad —</option>
                          {SQUAD_STATUS_TIER_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {SQUAD_STATUS_LABEL_SV[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={cell("specialTags")}>
                        <select
                          data-col="specialTags"
                          className="ed-tags"
                          multiple
                          size={3}
                          value={row.specialTags}
                          onChange={(e) => updateRow(row.playerId, { specialTags: Array.from(e.target.selectedOptions).map((o) => o.value as PlayerTagValue) })}
                        >
                          {PLAYER_TAG_VALUES.map((t) => (
                            <option key={t} value={t}>
                              {PLAYER_TAG_LABEL_SV[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={cell("ca")}>
                        <input
                          data-col="ca"
                          type="number"
                          min={1}
                          max={200}
                          className={`ed-num${ratingErr ? " ed-invalid" : ""}`}
                          value={row.ca ?? ""}
                          onChange={(e) => updateRow(row.playerId, { ca: e.target.value === "" ? null : Number(e.target.value) })}
                          onKeyDown={(e) => handleEnterKey(e, row.playerId, '[data-col="ca"]')}
                        />
                      </td>
                      <td className={cell("pa")}>
                        <input
                          data-col="pa"
                          type="number"
                          min={1}
                          max={200}
                          className={`ed-num${ratingErr ? " ed-invalid" : ""}`}
                          value={row.pa ?? ""}
                          onChange={(e) => updateRow(row.playerId, { pa: e.target.value === "" ? null : Number(e.target.value) })}
                          onKeyDown={(e) => handleEnterKey(e, row.playerId, '[data-col="ca"]')}
                        />
                      </td>
                      <td>
                        <div className="ed-stars">
                          <StarRating stars={row.ca !== null ? abilityStarsFromCA(row.ca) : 0} title="Nuvarande nivå (förhandsgranskning)" />
                          <StarRating stars={row.pa !== null ? potentialStarsFromPA(row.pa) : 0} title="Potential (förhandsgranskning)" />
                        </div>
                      </td>
                      <td className="hm-dev-muted">
                        {CA_SOURCE_LABEL_SV[row.caSource] ?? row.caSource}
                        {row.locked ? " · LÅST" : ""}
                      </td>
                      <td className="hm-dev-num">{formatEditorEur(row.marketValueEurPreview)}</td>
                      <td className="hm-dev-muted">{row.contractEndDisplay}</td>
                      <td className="hm-dev-muted">{row.rosterConfidence}</td>
                      <td className="ed-id">{row.playerId}</td>
                      <td>
                        <button type="button" className="hm-dev-btn hm-dev-btn--sm" disabled={!dirty || state.saving} onClick={() => saveRow(row.playerId)}>
                          {state.saving ? "Sparar…" : !dirty && state.savedAt ? "Sparad" : "Spara"}
                        </button>
                        {err ? <div className="ed-rowerr">{err}</div> : null}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="hm-dev-empty">
                      {onlyDirty
                        ? "Inga osparade ändringar matchar filtren. Slå av \"Endast osparade\" för att se alla spelare."
                        : "Inga spelare matchar filtren. Rensa ett filter eller sök på ett annat namn."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch save bar (SYS-02a): pinned to the bottom of the viewport. A failed row is reported
          here by name, never only in the table's last (off-screen) column. */}
      <div className="hm-dev-savebar" role="region" aria-label="Osparade ändringar">
        {saving ? (
          <span className="hm-dev-num">
            Sparar… {saveAllState?.done}/{saveAllState?.total}
          </span>
        ) : dirtyPlayerIds.length > 0 ? (
          <span>
            <b className="hm-dev-warn hm-dev-num">{dirtyPlayerIds.length}</b> spelare med osparade ändringar · <span className="hm-dev-num">{dirtyCellCount}</span>{" "}
            {dirtyCellCount === 1 ? "cell" : "celler"}
          </span>
        ) : (
          <span className="hm-dev-muted">Inga osparade ändringar.</span>
        )}
        {saveAllState && !saveAllState.running ? (
          saveAllState.failed.length > 0 ? (
            <span className="ed-failed">
              {saveAllState.total - saveAllState.failed.length} av {saveAllState.total} sparade — {saveAllState.failed.length} MISSLYCKADES och är fortfarande osparade:{" "}
              {saveAllState.failed.map((f) => f.name).join(", ")}
            </span>
          ) : (
            <span className="hm-dev-pos">
              {saveAllState.total} {saveAllState.total === 1 ? "ändring sparad" : "ändringar sparade"}.
            </span>
          )
        ) : null}
        <span className="hm-dev-savebar-spacer" />
        <button type="button" className="hm-dev-btn" disabled={undoStack.length === 0 || saving} onClick={undo} title="Ångra senaste celländring (Ctrl+Z)">
          Ångra <span className="hm-dev-kbd">Ctrl Z</span>
        </button>
        <button type="button" className="hm-dev-btn" disabled={dirtyPlayerIds.length === 0 || saving} onClick={revertAll}>
          Återställ alla
        </button>
        <button type="button" className="hm-dev-btn hm-dev-btn--primary" disabled={dirtyPlayerIds.length === 0 || saving} onClick={saveAll} title="Spara alla (Ctrl+S)">
          {saving ? "Sparar…" : `Spara alla (${dirtyPlayerIds.length})`} <span className="hm-dev-kbd">Ctrl S</span>
        </button>
      </div>
      <p className="ed-footnote">
        CA/PA skrivs direkt till den låsta rating-databasen (samma mekanism som betygseditorns Lås-knapp) och slår igenom i nästa nya karriär, matchmotorn, utveckling och
        marknadsvärde. Position, född, truppstatus och tags skrivs till samma källfiler som spelardetaljen. Rå CA/PA visas bara här i Editor Mode; spelets vanliga vyer döljer
        dem alltid.
      </p>
    </>
  );
}
