"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CANONICAL_POSITIONS,
  CONFIDENCE_VALUES,
  HANDEDNESS_VALUES,
  ROSTER_STATUS_VALUES,
  type PlayerEditableFields,
  type RosterEditableFields,
} from "@/lib/editor/schema";

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

interface FieldDiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
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
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function PlayerEditorPage() {
  const router = useRouter();
  const params = useParams<{ playerId: string }>();
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId") ?? "";

  const [record, setRecord] = useState<EditorPlayerRecord | null>(null);
  const [player, setPlayer] = useState<PlayerEditableFields | null>(null);
  const [roster, setRoster] = useState<RosterEditableFields | null>(null);
  const [nationalitiesText, setNationalitiesText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  function load() {
    if (!clubId) return;
    fetch(`/api/editor/players/${encodeURIComponent(params.playerId)}?clubId=${encodeURIComponent(clubId)}`)
      .then((res) => res.json())
      .then((data) => {
        setRecord(data.record);
        setPlayer(data.record.player);
        setRoster(data.record.roster);
        setNationalitiesText((data.record.player.nationalities ?? []).join(", "));
        setStatus("idle");
        setSaveErrors([]);
      });
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

  const diff: FieldDiffEntry[] = useMemo(() => {
    if (!record || !currentPlayer || !roster) return [];
    const entries: FieldDiffEntry[] = [];
    for (const key of Object.keys(record.player) as (keyof PlayerEditableFields)[]) {
      if (JSON.stringify(record.player[key]) !== JSON.stringify(currentPlayer[key])) {
        entries.push({ field: key, oldValue: record.player[key], newValue: currentPlayer[key] });
      }
    }
    for (const key of Object.keys(record.roster) as (keyof RosterEditableFields)[]) {
      if (JSON.stringify(record.roster[key]) !== JSON.stringify(roster[key])) {
        entries.push({ field: key, oldValue: record.roster[key], newValue: roster[key] });
      }
    }
    return entries;
  }, [record, currentPlayer, roster]);

  function discard() {
    load();
  }

  async function save() {
    if (!currentPlayer || !roster) return;
    setStatus("saving");
    setSaveErrors([]);
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
  }

  if (!record || !currentPlayer || !roster) {
    return (
      <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 20px" }}>
        <div className="hm-panel">
          <div className="hm-panel-body hm-text-muted">Läser in spelare...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "32px auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">{record.player.fullName}</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/editor/players")}>
            ← Spelare
          </button>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          SPELAR-ID (skrivskyddat): {record.playerId} · KLUBB: {record.clubName} ({record.clubId})
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">VERKLIG DATA</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Förnamn">
              <input style={inputStyle} value={currentPlayer.firstName} onChange={(e) => setPlayer({ ...currentPlayer, firstName: e.target.value })} />
            </Field>
            <Field label="Efternamn">
              <input style={inputStyle} value={currentPlayer.lastName} onChange={(e) => setPlayer({ ...currentPlayer, lastName: e.target.value })} />
            </Field>
            <Field label="Fullständigt namn">
              <input style={inputStyle} value={currentPlayer.fullName} onChange={(e) => setPlayer({ ...currentPlayer, fullName: e.target.value })} />
            </Field>
            <Field label="Födelsedatum">
              <input
                type="date"
                style={inputStyle}
                value={currentPlayer.dateOfBirth ?? ""}
                onChange={(e) => setPlayer({ ...currentPlayer, dateOfBirth: e.target.value || null })}
              />
            </Field>
            <Field label="Födelseår">
              <input
                type="number"
                style={inputStyle}
                value={currentPlayer.birthYear ?? ""}
                onChange={(e) => setPlayer({ ...currentPlayer, birthYear: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Nationalitet (kommaseparerad, t.ex. SE, NO)">
              <input style={inputStyle} value={nationalitiesText} onChange={(e) => setNationalitiesText(e.target.value)} />
            </Field>
            <Field label="Längd (cm)">
              <input
                type="number"
                style={inputStyle}
                value={currentPlayer.heightCm ?? ""}
                onChange={(e) => setPlayer({ ...currentPlayer, heightCm: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Hänthet">
              <select
                style={inputStyle}
                value={currentPlayer.handedness ?? ""}
                onChange={(e) => setPlayer({ ...currentPlayer, handedness: (e.target.value || null) as PlayerEditableFields["handedness"] })}
              >
                <option value="">Okänd</option>
                {HANDEDNESS_VALUES.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Källkonfidens (spelare)">
              <select
                style={inputStyle}
                value={currentPlayer.recordConfidence}
                onChange={(e) => setPlayer({ ...currentPlayer, recordConfidence: e.target.value as PlayerEditableFields["recordConfidence"] })}
              >
                {CONFIDENCE_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">TRUPP {record.readOnly.season}</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Tröjnummer">
              <input
                type="number"
                style={inputStyle}
                value={roster.shirtNumber ?? ""}
                onChange={(e) => setRoster({ ...roster, shirtNumber: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Källposition (originalterm)">
              <input style={inputStyle} value={roster.sourcePosition} onChange={(e) => setRoster({ ...roster, sourcePosition: e.target.value })} />
            </Field>
            <Field label="Primär position">
              <select style={inputStyle} value={roster.primaryPosition} onChange={(e) => setRoster({ ...roster, primaryPosition: e.target.value as RosterEditableFields["primaryPosition"] })}>
                {CANONICAL_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sekundära positioner">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CANONICAL_POSITIONS.map((p) => {
                  const checked = roster.secondaryPositions.includes(p);
                  return (
                    <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setRoster({
                            ...roster,
                            secondaryPositions: e.target.checked
                              ? [...roster.secondaryPositions, p]
                              : roster.secondaryPositions.filter((x) => x !== p),
                          })
                        }
                      />
                      {p}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Truppstatus">
              <select style={inputStyle} value={roster.rosterStatus} onChange={(e) => setRoster({ ...roster, rosterStatus: e.target.value as RosterEditableFields["rosterStatus"] })}>
                {ROSTER_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kontrakt t.o.m. datum">
              <input
                type="date"
                style={inputStyle}
                value={roster.contract.untilDate ?? ""}
                onChange={(e) => setRoster({ ...roster, contract: { ...roster.contract, untilDate: e.target.value || null } })}
              />
            </Field>
            <Field label="Kontrakt t.o.m. säsong (ÅÅÅÅ/ÅÅ)">
              <input
                style={inputStyle}
                value={roster.contract.untilSeason ?? ""}
                onChange={(e) => setRoster({ ...roster, contract: { ...roster.contract, untilSeason: e.target.value || null } })}
              />
            </Field>
            <Field label="Källkonfidens (trupp)">
              <select style={inputStyle} value={roster.rosterConfidence} onChange={(e) => setRoster({ ...roster, rosterConfidence: e.target.value as RosterEditableFields["rosterConfidence"] })}>
                {CONFIDENCE_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">SPEL-DATA</span>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Framtida / skrivskyddat i denna version. Inga betyg (CA/PA) presenteras här -- verklig data blandas inte med spelvärderingar.
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">KÄLLOR</span>
          <span className="hm-badge hm-badge-neutral">Skrivskyddat</span>
        </div>
        {record.readOnly.sources.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Inga källor kopplade.</div>
        ) : (
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {record.readOnly.sources.map((s) => (
              <div key={s.sourceId} style={{ fontSize: "var(--hm-text-2xs)" }}>
                <span className="hm-text-muted">{s.publisher ?? s.sourceId}</span> — {s.title ?? s.url ?? s.sourceId}
              </div>
            ))}
          </div>
        )}
        {record.readOnly.dataNotes.length > 0 ? (
          <div className="hm-panel-body" style={{ paddingTop: 0 }}>
            {record.readOnly.dataNotes.map((note, i) => (
              <div key={i} className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                • {note}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">FÖRHANDSGRANSKNING — ÄNDRINGAR</span>
        </div>
        {diff.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Inga ändringar.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Fält</th>
                <th>Gammalt</th>
                <th></th>
                <th>Nytt</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((d) => (
                <tr key={d.field}>
                  <td className="hm-td-strong">{FIELD_LABELS[d.field] ?? d.field}</td>
                  <td className="hm-text-muted">{formatValue(d.oldValue)}</td>
                  <td>→</td>
                  <td>{formatValue(d.newValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {saveErrors.length > 0 ? (
          <div className="hm-panel-body" style={{ color: "var(--hm-negative)", fontSize: "var(--hm-text-xs)" }}>
            {saveErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        ) : null}
        {status === "saved" ? (
          <div className="hm-panel-body">
            <span className="hm-badge hm-badge-positive">SPARAT</span>
          </div>
        ) : null}
        <div className="hm-panel-body" style={{ display: "flex", gap: 8 }}>
          <button type="button" className="hm-btn" onClick={discard} disabled={diff.length === 0 || status === "saving"}>
            ÅTERSTÄLL
          </button>
          <button type="button" className="hm-btn hm-btn-primary" onClick={save} disabled={diff.length === 0 || status === "saving"}>
            {status === "saving" ? "SPARAR..." : "SPARA ÄNDRINGAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
};
