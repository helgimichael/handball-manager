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
import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { abilityStarsFromCA, potentialStarsFromPA } from "@/lib/development/types";
import { SortableTh, applySortDirection, type SortState } from "@/components/SortableTh";
import StarRating from "@/components/StarRating";
import {
  isSourceDirty,
  isRatingDirty,
  isDirty,
  matchesFilters,
  dirtyPlayerIds as computeDirtyPlayerIds,
  runSaveAll,
  applySaveOutcome,
} from "@/lib/editor/bulkEditorState";

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

const inputStyle: CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "5px 7px",
  fontSize: "var(--hm-text-2xs)",
};
const numberInputStyle: CSSProperties = { ...inputStyle, width: 56 };
const errorInputStyle: CSSProperties = { ...numberInputStyle, border: "1px solid var(--hm-negative, #b23a2e)" };

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

function formatEur(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(v) + " €";
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
    return rows.filter((r) => matchesFilters(r, originals[r.playerId], filters));
  }, [rows, originals, leagueFilter, clubFilter, positionFilter, statusFilter, search]);

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
    setRows((prev) => prev.map((r) => (r.playerId === playerId ? { ...r, ...patch } : r)));
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

  function leaveEditor() {
    if (dirtyPlayerIds.length > 0 && !window.confirm(`${dirtyPlayerIds.length} osparade ändringar går förlorade om du lämnar sidan. Lämna ändå?`)) return;
    router.push("/editor");
  }

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

  return (
    <div style={{ maxWidth: 1600, margin: "24px auto", padding: "0 16px" }}>
      {/* `overflow: visible` overrides .hm-panel's own `overflow: hidden`,
          which would otherwise silently disable the sticky header below --
          a sticky element is inert inside ANY clipping ancestor. Scoped to
          this page's panel only; the shared class is untouched. */}
      <div className="hm-panel" style={{ overflow: "visible" }}>
        {/* Sticky: the table is 17 columns and 1200 rows, so a header that
            scrolls away leaves the ONLY control that can save an edited row
            unreachable from wherever the editing actually happens. */}
        <div className="hm-panel-header" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--hm-surface-1)" }}>
          <span className="hm-panel-title">EDITOR — Spelarkalibrering ({rows.length} spelare)</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saveAllState?.running ? (
              <span style={{ fontSize: "var(--hm-text-2xs)", color: "var(--hm-text-muted)" }}>
                Sparar… {saveAllState.done}/{saveAllState.total}
              </span>
            ) : null}
            {dirtyPlayerIds.length > 0 && !saveAllState?.running ? (
              <span style={{ fontSize: "var(--hm-text-2xs)", color: "var(--hm-accent)", fontWeight: 700 }}>
                {dirtyPlayerIds.length} osparade
              </span>
            ) : null}
            <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={dirtyPlayerIds.length === 0 || saveAllState?.running} onClick={saveAll}>
              {saveAllState?.running ? "Sparar…" : `Spara alla (${dirtyPlayerIds.length})`}
            </button>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={leaveEditor}>
              ← Editor
            </button>
          </div>
        </div>

        {saveAllState && !saveAllState.running ? (
          <div
            className="hm-panel-body"
            style={{
              fontSize: "var(--hm-text-2xs)",
              color: saveAllState.failed.length > 0 ? "var(--hm-negative, #b23a2e)" : "var(--hm-positive)",
              fontWeight: 700,
            }}
          >
            {saveAllState.failed.length > 0
              ? `${saveAllState.total - saveAllState.failed.length} av ${saveAllState.total} sparade — ${saveAllState.failed.length} MISSLYCKADES och är fortfarande osparade: ${saveAllState.failed.map((f) => f.name).join(", ")}`
              : `${saveAllState.total} ${saveAllState.total === 1 ? "ändring sparad" : "ändringar sparade"}.`}
          </div>
        ) : null}

        <div className="hm-panel-body" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            LIGA
            <select
              value={leagueFilter}
              onChange={(e) => {
                setLeagueFilter(e.target.value);
                setClubFilter("");
              }}
              style={inputStyle}
            >
              <option value="">Alla</option>
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            KLUBB
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)} style={inputStyle}>
              <option value="">Alla</option>
              {clubs.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            POSITION
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} style={inputStyle}>
              <option value="">Alla</option>
              {CANONICAL_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            TRUPPSTATUS
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
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
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)", flex: 1, minWidth: 220 }}>
            SÖK SPELARE
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Namn..." style={inputStyle} />
          </label>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
            Visar {sorted.length} av {rows.length}
          </span>
        </div>

        {loading ? (
          <div className="hm-panel-body hm-text-muted">Läser in...</div>
        ) : loadError ? (
          <div className="hm-panel-body hm-text-muted">Fel: {loadError}</div>
        ) : (
          <div className="hm-scroll-x">
            <table className="hm-table" style={{ fontSize: "var(--hm-text-2xs)" }}>
              <thead>
                <tr>
                  <th></th>
                  <SortableTh label="Namn" sortKey="name" sort={sort} onSort={setSort} />
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
                  const state = rowState[row.playerId] ?? {};
                  // HM-PLAYER-DATA-EDITOR-1.0B: a failed save's error can be about
                  // ANY field (e.g. a source-schema issue unrelated to CA/PA) --
                  // only paError's own PA>=CA check should redden the CA/PA inputs.
                  // The row's error MESSAGE still shows whatever actually failed.
                  const ratingErr = paError(row, original);
                  const err = state.error ?? ratingErr;
                  return (
                    <tr key={row.playerId} data-row={row.playerId} style={{ background: dirty ? "color-mix(in srgb, var(--hm-accent) 6%, transparent)" : undefined }}>
                      {/* The row's own Spara button and error cell sit in the
                          LAST column, off-screen at any normal width -- so the
                          save state is mirrored here, in the first column,
                          which is always visible. "Sparad" appears only after
                          the server confirmed the write. */}
                      <td title={state.saving ? "Sparar…" : state.error ? `Fel: ${state.error}` : dirty ? "Osparade ändringar" : state.savedAt ? "Sparad" : ""}>
                        {state.saving ? (
                          <span style={{ color: "var(--hm-text-muted)" }}>…</span>
                        ) : state.error ? (
                          <span style={{ color: "var(--hm-negative, #b23a2e)", fontWeight: 700 }}>⚠</span>
                        ) : dirty ? (
                          <span style={{ color: "var(--hm-accent)", fontWeight: 700 }}>●</span>
                        ) : state.savedAt ? (
                          <span style={{ color: "var(--hm-positive)" }}>✓</span>
                        ) : null}
                      </td>
                      <td className="hm-td-strong">{row.fullName}</td>
                      <td>{row.clubName}</td>
                      <td className="hm-text-muted">{row.competitionSlug}</td>
                      <td>
                        <select
                          data-col="primaryPosition"
                          value={row.primaryPosition}
                          onChange={(e) => updateRow(row.playerId, { primaryPosition: e.target.value as CanonicalPosition })}
                          style={inputStyle}
                        >
                          {CANONICAL_POSITIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {row.dateOfBirth !== null ? (
                          <input
                            data-col="dateOfBirth"
                            type="date"
                            value={row.dateOfBirth}
                            onChange={(e) => updateRow(row.playerId, { dateOfBirth: e.target.value || null })}
                            style={{ ...inputStyle, width: 128 }}
                          />
                        ) : (
                          <input
                            data-col="birthYear"
                            type="number"
                            placeholder="Födelseår"
                            value={row.birthYear ?? ""}
                            onChange={(e) => updateRow(row.playerId, { birthYear: e.target.value === "" ? null : Number(e.target.value) })}
                            style={numberInputStyle}
                          />
                        )}
                      </td>
                      <td className="hm-table-num">{row.ageYears ?? "—"}</td>
                      <td>
                        <select
                          data-col="defaultSquadStatus"
                          value={row.defaultSquadStatus ?? ""}
                          onChange={(e) => updateRow(row.playerId, { defaultSquadStatus: e.target.value === "" ? null : (e.target.value as SquadStatusTierValue) })}
                          style={inputStyle}
                        >
                          <option value="">— ej kalibrerad —</option>
                          {SQUAD_STATUS_TIER_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {SQUAD_STATUS_LABEL_SV[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          data-col="specialTags"
                          multiple
                          size={3}
                          value={row.specialTags}
                          onChange={(e) => updateRow(row.playerId, { specialTags: Array.from(e.target.selectedOptions).map((o) => o.value as PlayerTagValue) })}
                          style={{ ...inputStyle, minWidth: 140 }}
                        >
                          {PLAYER_TAG_VALUES.map((t) => (
                            <option key={t} value={t}>
                              {PLAYER_TAG_LABEL_SV[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          data-col="ca"
                          type="number"
                          min={1}
                          max={200}
                          value={row.ca ?? ""}
                          onChange={(e) => updateRow(row.playerId, { ca: e.target.value === "" ? null : Number(e.target.value) })}
                          onKeyDown={(e) => handleEnterKey(e, row.playerId, '[data-col="ca"]')}
                          style={ratingErr ? errorInputStyle : numberInputStyle}
                        />
                      </td>
                      <td>
                        <input
                          data-col="pa"
                          type="number"
                          min={1}
                          max={200}
                          value={row.pa ?? ""}
                          onChange={(e) => updateRow(row.playerId, { pa: e.target.value === "" ? null : Number(e.target.value) })}
                          onKeyDown={(e) => handleEnterKey(e, row.playerId, '[data-col="ca"]')}
                          style={ratingErr ? errorInputStyle : numberInputStyle}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <StarRating stars={row.ca !== null ? abilityStarsFromCA(row.ca) : 0} title="Nuvarande nivå (förhandsgranskning)" />
                          <StarRating stars={row.pa !== null ? potentialStarsFromPA(row.pa) : 0} title="Potential (förhandsgranskning)" />
                        </div>
                      </td>
                      <td className="hm-text-muted">
                        {CA_SOURCE_LABEL_SV[row.caSource] ?? row.caSource}
                        {row.locked ? " · LÅST" : ""}
                      </td>
                      <td className="hm-table-num">{formatEur(row.marketValueEurPreview)}</td>
                      <td className="hm-text-muted">{row.contractEndDisplay}</td>
                      <td>
                        <span className="hm-badge hm-badge-neutral">{row.rosterConfidence}</span>
                      </td>
                      <td className="hm-text-muted" style={{ fontFamily: "monospace", fontSize: "10px" }}>
                        {row.playerId}
                      </td>
                      <td>
                        <button type="button" className="hm-btn hm-btn-sm" disabled={!dirty || state.saving} onClick={() => saveRow(row.playerId)}>
                          {state.saving ? "Sparar…" : !dirty && state.savedAt ? "Sparad" : "Spara"}
                        </button>
                        {err ? (
                          <div className="hm-text-muted" style={{ color: "var(--hm-negative, #b23a2e)", fontSize: "10px", marginTop: 2, maxWidth: 160 }}>
                            {err}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="hm-text-muted">
                      Inga spelare matchar filtren.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          CA/PA skrivs direkt till den låsta rating-databasen (samma mekanism som ratings-editorns Lås-knapp) -- de slår igenom i nästa fräscha karriär, Match Engine, utveckling/headroom och marknadsvärde. Position/född/truppstatus/tags skrivs till samma källfiler som spelar-editorn. Raw CA/PA visas endast här i Editor Mode -- normal spel-UI döljer alltid dessa.
        </div>
      </div>
    </div>
  );
}
