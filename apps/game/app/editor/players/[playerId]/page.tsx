"use client";

// Arena Nights SYS-02b (A) "Diff-first detail": the saved source record (left) beside the
// editable draft (right), every changed field highlighted on both sides; saving first shows
// the diff summary and writes only after an explicit confirm. Same GET/PUT
// /api/editor/players/[playerId] calls as before -- no new data path.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { DevPageHead } from "@/components/dev/DevShell";
import { recordDiff } from "@/lib/editor/calibrationEdits";
import {
  CANONICAL_POSITIONS,
  CONFIDENCE_VALUES,
  HANDEDNESS_VALUES,
  ROSTER_STATUS_VALUES,
  type PlayerEditableFields,
  type RosterEditableFields,
} from "@/lib/editor/schema";
import "../players.css";

interface EditorPlayerRecord {
  playerId: string;
  clubId: string;
  clubName: string;
  player: PlayerEditableFields;
  roster: RosterEditableFields;
  readOnly: {
    aliases: string[];
    dataNotes: string[];
    rosterEntryId: string;
    competitionId: string;
    season: string;
    snapshotDate: string;
    sources: { sourceId: string; publisher?: string; title?: string; url?: string }[];
  };
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Förnamn",
  lastName: "Efternamn",
  fullName: "Fullständigt namn",
  dateOfBirth: "Födelsedatum",
  birthYear: "Födelseår",
  nationalities: "Nationalitet",
  heightCm: "Längd (cm)",
  handedness: "Hänthet",
  recordConfidence: "Källkonfidens (spelare)",
  shirtNumber: "Tröjnummer",
  sourcePosition: "Källposition",
  primaryPosition: "Primär position",
  secondaryPositions: "Sekundära positioner",
  rosterStatus: "Truppstatus",
  contract: "Kontrakt",
  rosterConfidence: "Källkonfidens (trupp)",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${String(v)}`);
    return parts.length ? parts.join(" · ") : "—";
  }
  return String(value);
}

export default function PlayerEditorPage() {
  const params = useParams<{ playerId: string }>();
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId") ?? "";

  const [record, setRecord] = useState<EditorPlayerRecord | null>(null);
  const [player, setPlayer] = useState<PlayerEditableFields | null>(null);
  const [roster, setRoster] = useState<RosterEditableFields | null>(null);
  const [nationalitiesText, setNationalitiesText] = useState("");
  const [status, setStatus] = useState<"idle" | "confirm" | "saving" | "saved" | "error">("idle");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    if (!clubId) return;
    fetch(`/api/editor/players/${encodeURIComponent(params.playerId)}?clubId=${encodeURIComponent(clubId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.record) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data;
      })
      .then((data) => {
        setLoadError(null);
        setRecord(data.record);
        setPlayer(data.record.player);
        setRoster(data.record.roster);
        setNationalitiesText((data.record.player.nationalities ?? []).join(", "));
        setStatus((prev) => (prev === "saved" ? "saved" : "idle"));
        setSaveErrors([]);
      })
      .catch((err) => setLoadError(String(err instanceof Error ? err.message : err)));
  }

  useEffect(load, [params.playerId, clubId]);

  const parsedNationalities = useMemo(() => {
    const parts = nationalitiesText
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return parts.length ? parts : null;
  }, [nationalitiesText]);

  const currentPlayer: PlayerEditableFields | null = useMemo(
    () => (player ? { ...player, nationalities: parsedNationalities } : null),
    [player, parsedNationalities],
  );

  const diff = useMemo(
    () => (record && currentPlayer && roster ? recordDiff({ player: record.player, roster: record.roster }, { player: currentPlayer, roster }) : []),
    [record, currentPlayer, roster],
  );
  const changed = useMemo(() => new Set(diff.map((d) => `${d.section}.${d.field}`)), [diff]);

  // Any further edit after "Granska" cancels the pending confirm, so the confirmed diff is always the one shown.
  function editPlayer(next: PlayerEditableFields) {
    setPlayer(next);
    setStatus("idle");
  }
  function editRoster(next: RosterEditableFields) {
    setRoster(next);
    setStatus("idle");
  }

  async function save() {
    if (!currentPlayer || !roster) return;
    setStatus("saving");
    setSaveErrors([]);
    try {
      const res = await fetch(`/api/editor/players/${encodeURIComponent(params.playerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, player: currentPlayer, roster }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setSaveErrors(data.errors ?? [data.error ?? "Okänt fel"]);
        return;
      }
      setStatus("saved");
      load();
    } catch (err) {
      setStatus("error");
      setSaveErrors([String(err)]);
    }
  }

  if (!clubId) {
    return (
      <div className="hm-dev-panel">
        <div className="hm-dev-empty">
          Spelaren saknar klubb i adressen (?clubId=…). Öppna spelaren från <Link href="/editor/players">spelartabellen</Link>.
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="hm-dev-panel">
        <div className="hm-dev-panel-body">
          <div className="hm-dev-alert">Kunde inte läsa spelaren: {loadError}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="hm-dev-btn"
              onClick={() => {
                setLoadError(null);
                load();
              }}
            >
              Försök igen
            </button>
            <Link href="/editor/players" className="hm-dev-btn">
              ← Spelare
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!record || !currentPlayer || !roster) {
    return <div className="hm-dev-empty">Läser in spelare…</div>;
  }

  const p = (field: keyof PlayerEditableFields) => (changed.has(`player.${field}`) ? "hm-dev-dirty" : undefined);
  const r = (field: keyof RosterEditableFields) => (changed.has(`roster.${field}`) ? "hm-dev-dirty" : undefined);
  const busy = status === "saving";

  return (
    <>
      <DevPageHead
        eyebrow="Data · Spelardetalj"
        title={record.player.fullName}
        note={
          <>
            <span className="hm-dev-num">{record.playerId}</span> · {record.clubName} ({record.clubId}) · säsong {record.readOnly.season} · ögonblicksbild{" "}
            {record.readOnly.snapshotDate}
          </>
        }
        actions={
          <Link href="/editor/players" className="hm-dev-btn">
            ← Spelare
          </Link>
        }
      />

      <div className="hm-dev-split hm-dev-split--6-6">
        <section className="hm-dev-panel" aria-label="Sparad data">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title">Sparat i källfilerna</span>
            <span className="hm-dev-muted">skrivskyddat</span>
          </div>
          <div className="hm-dev-eyebrow ed-section-label">Spelare</div>
          <dl className="ed-fields">
            {(Object.keys(record.player) as (keyof PlayerEditableFields)[]).map((field) => (
              <SavedRow key={field} label={FIELD_LABELS[field] ?? field} value={record.player[field]} cls={p(field)} />
            ))}
          </dl>
          <div className="hm-dev-eyebrow ed-section-label">Trupp {record.readOnly.season}</div>
          <dl className="ed-fields">
            {(Object.keys(record.roster) as (keyof RosterEditableFields)[]).map((field) => (
              <SavedRow key={field} label={FIELD_LABELS[field] ?? field} value={record.roster[field]} cls={r(field)} />
            ))}
          </dl>
        </section>

        <section className="hm-dev-panel" aria-label="Redigering">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title">Redigering</span>
            <span className={diff.length ? "hm-dev-warn hm-dev-num" : "hm-dev-muted"}>{diff.length ? `${diff.length} ändrade fält` : "inga ändringar"}</span>
          </div>
          <div className="hm-dev-eyebrow ed-section-label">Spelare</div>
          <div className="ed-form">
            <Row label="Förnamn" cls={p("firstName")}>
              <input type="text" value={currentPlayer.firstName} onChange={(e) => editPlayer({ ...currentPlayer, firstName: e.target.value })} />
            </Row>
            <Row label="Efternamn" cls={p("lastName")}>
              <input type="text" value={currentPlayer.lastName} onChange={(e) => editPlayer({ ...currentPlayer, lastName: e.target.value })} />
            </Row>
            <Row label="Fullständigt namn" cls={p("fullName")}>
              <input type="text" value={currentPlayer.fullName} onChange={(e) => editPlayer({ ...currentPlayer, fullName: e.target.value })} />
            </Row>
            <Row label="Födelsedatum" cls={p("dateOfBirth")}>
              <input type="date" value={currentPlayer.dateOfBirth ?? ""} onChange={(e) => editPlayer({ ...currentPlayer, dateOfBirth: e.target.value || null })} />
            </Row>
            <Row label="Födelseår" cls={p("birthYear")}>
              <input
                type="number"
                value={currentPlayer.birthYear ?? ""}
                onChange={(e) => editPlayer({ ...currentPlayer, birthYear: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Row>
            <Row label="Nationalitet (t.ex. SE, NO)" cls={p("nationalities")}>
              <input
                type="text"
                value={nationalitiesText}
                onChange={(e) => {
                  setNationalitiesText(e.target.value);
                  setStatus("idle");
                }}
              />
            </Row>
            <Row label="Längd (cm)" cls={p("heightCm")}>
              <input
                type="number"
                value={currentPlayer.heightCm ?? ""}
                onChange={(e) => editPlayer({ ...currentPlayer, heightCm: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Row>
            <Row label="Hänthet" cls={p("handedness")}>
              <select
                value={currentPlayer.handedness ?? ""}
                onChange={(e) => editPlayer({ ...currentPlayer, handedness: (e.target.value || null) as PlayerEditableFields["handedness"] })}
              >
                <option value="">Okänd</option>
                {HANDEDNESS_VALUES.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Källkonfidens (spelare)" cls={p("recordConfidence")}>
              <select
                value={currentPlayer.recordConfidence}
                onChange={(e) => editPlayer({ ...currentPlayer, recordConfidence: e.target.value as PlayerEditableFields["recordConfidence"] })}
              >
                {CONFIDENCE_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Row>
          </div>

          <div className="hm-dev-eyebrow ed-section-label">Trupp {record.readOnly.season}</div>
          <div className="ed-form">
            <Row label="Tröjnummer" cls={r("shirtNumber")}>
              <input
                type="number"
                value={roster.shirtNumber ?? ""}
                onChange={(e) => editRoster({ ...roster, shirtNumber: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Row>
            <Row label="Källposition (originalterm)" cls={r("sourcePosition")}>
              <input type="text" value={roster.sourcePosition} onChange={(e) => editRoster({ ...roster, sourcePosition: e.target.value })} />
            </Row>
            <Row label="Primär position" cls={r("primaryPosition")}>
              <select value={roster.primaryPosition} onChange={(e) => editRoster({ ...roster, primaryPosition: e.target.value as RosterEditableFields["primaryPosition"] })}>
                {CANONICAL_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Sekundära positioner" cls={r("secondaryPositions")} group>
              <div className="ed-checks">
                {CANONICAL_POSITIONS.map((pos) => (
                  <label key={pos}>
                    <input
                      type="checkbox"
                      checked={roster.secondaryPositions.includes(pos)}
                      onChange={(e) =>
                        editRoster({
                          ...roster,
                          secondaryPositions: e.target.checked ? [...roster.secondaryPositions, pos] : roster.secondaryPositions.filter((x) => x !== pos),
                        })
                      }
                    />
                    {pos}
                  </label>
                ))}
              </div>
            </Row>
            <Row label="Truppstatus" cls={r("rosterStatus")}>
              <select value={roster.rosterStatus} onChange={(e) => editRoster({ ...roster, rosterStatus: e.target.value as RosterEditableFields["rosterStatus"] })}>
                {ROSTER_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Kontrakt t.o.m. datum" cls={r("contract")}>
              <input type="date" value={roster.contract.untilDate ?? ""} onChange={(e) => editRoster({ ...roster, contract: { ...roster.contract, untilDate: e.target.value || null } })} />
            </Row>
            <Row label="Kontrakt t.o.m. säsong (ÅÅÅÅ/ÅÅ)" cls={r("contract")}>
              <input
                type="text"
                value={roster.contract.untilSeason ?? ""}
                onChange={(e) => editRoster({ ...roster, contract: { ...roster.contract, untilSeason: e.target.value || null } })}
              />
            </Row>
            <Row label="Källkonfidens (trupp)" cls={r("rosterConfidence")}>
              <select value={roster.rosterConfidence} onChange={(e) => editRoster({ ...roster, rosterConfidence: e.target.value as RosterEditableFields["rosterConfidence"] })}>
                {CONFIDENCE_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Row>
          </div>
        </section>
      </div>

      <div className="hm-dev-panel" style={{ marginTop: 12 }}>
        <div className="hm-dev-panel-head">
          <span className="hm-dev-panel-title">Källor och anteckningar</span>
          <span className="hm-dev-muted">skrivskyddat · inga betyg (CA/PA) här, verklig data blandas inte med spelvärderingar</span>
        </div>
        <div className="hm-dev-panel-body">
          {record.readOnly.sources.length === 0 ? (
            <div className="hm-dev-muted">Inga källor kopplade.</div>
          ) : (
            record.readOnly.sources.map((s) => (
              <div key={s.sourceId}>
                <span className="hm-dev-muted">{s.publisher ?? s.sourceId}</span> — {s.title ?? s.url ?? s.sourceId}
              </div>
            ))
          )}
          {record.readOnly.dataNotes.map((note, i) => (
            <div key={i} className="hm-dev-muted">
              • {note}
            </div>
          ))}
        </div>
      </div>

      {/* Diff summary + save (SYS-02b): saving is a two-step "Granska" -> "Bekräfta" so the exact
          field-by-field change is always read before it is written. */}
      <div className={`hm-dev-savebar${status === "confirm" ? " ed-confirm" : ""}`} role="region" aria-label="Ändringar">
        {diff.length === 0 ? (
          <span className="hm-dev-muted">{status === "saved" ? "Sparat. Inga osparade ändringar." : "Inga ändringar."}</span>
        ) : status === "confirm" ? (
          <div style={{ flex: "1 1 100%" }}>
            <strong>Bekräfta {diff.length} ändringar</strong>
            <table className="hm-dev-table ed-diff-table" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Fält</th>
                  <th>Sparat</th>
                  <th></th>
                  <th>Nytt</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={`${d.section}.${d.field}`}>
                    <td>{FIELD_LABELS[d.field] ?? d.field}</td>
                    <td className="ed-diff-old">{formatValue(d.oldValue)}</td>
                    <td>→</td>
                    <td className="hm-dev-diff">{formatValue(d.newValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <span>
            <b className="hm-dev-warn hm-dev-num">{diff.length}</b> ändrade fält: {diff.map((d) => FIELD_LABELS[d.field] ?? d.field).join(", ")}
          </span>
        )}
        {saveErrors.length > 0 ? (
          <div className="hm-dev-alert" style={{ flex: "1 1 100%" }}>
            {saveErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ) : null}
        <span className="hm-dev-savebar-spacer" />
        <button type="button" className="hm-dev-btn" onClick={load} disabled={diff.length === 0 || busy}>
          Återställ
        </button>
        {status === "confirm" ? (
          <>
            <button type="button" className="hm-dev-btn" onClick={() => setStatus("idle")}>
              Tillbaka
            </button>
            <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={save}>
              Bekräfta och spara
            </button>
          </>
        ) : (
          <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={() => setStatus("confirm")} disabled={diff.length === 0 || busy}>
            {busy ? "Sparar…" : "Granska och spara"}
          </button>
        )}
      </div>
    </>
  );
}

function SavedRow({ label, value, cls }: { label: string; value: unknown; cls?: string }) {
  return (
    <>
      <dt className={cls}>{label}</dt>
      <dd className={cls}>{formatValue(value)}</dd>
    </>
  );
}

function Row({ label, cls, group, children }: { label: string; cls?: string; group?: boolean; children: ReactNode }) {
  const className = `ed-form-row${cls ? ` ${cls}` : ""}`;
  // A group of checkboxes has its own labels, so it is a labelled group rather than a nested <label>.
  if (group) {
    return (
      <div className={className} role="group" aria-label={label}>
        <span>{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className={className}>
      <span>{label}</span>
      {children}
    </label>
  );
}
