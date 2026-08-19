"use client";

import { useRouter } from "next/navigation";
import {
  ALLSVENSKAN_TABLE,
  getClub,
  getInboxMessages,
  getNextFixture,
  getPlayedFixtures,
  getPlayerClub,
  getSquad,
} from "@/lib/game-data";
import ClubCrest from "@/components/ClubCrest";
import FormDots from "@/components/FormDots";

export default function HomePage() {
  const router = useRouter();
  const club = getPlayerClub();
  const next = getNextFixture();
  const recent = [...getPlayedFixtures()].reverse().slice(0, 5);
  const squad = getSquad();
  const injured = squad.filter((p) => p.squadStatus === "Skadad");
  const messages = getInboxMessages().slice(0, 4);

  const myRow = ALLSVENSKAN_TABLE.find((r) => r.clubId === club.id);
  const myPosition = ALLSVENSKAN_TABLE.findIndex((r) => r.clubId === club.id) + 1;
  const tableSlice = ALLSVENSKAN_TABLE.slice(0, 6);

  const recentForm = recent
    .slice(0, 5)
    .reverse()
    .map((f) => {
      const home = f.homeClubId === club.id;
      const gf = home ? f.homeScore! : f.awayScore!;
      const ga = home ? f.awayScore! : f.homeScore!;
      return gf > ga ? "W" : gf < ga ? "L" : "D";
    });

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
      <div className="hm-grid" style={{ gap: 12 }}>
        {/* Next match */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Nästa match</span>
            {next ? (
              <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => router.push("/career/match-preview")}>
                Matchförhandsvisning →
              </button>
            ) : null}
          </div>
          <div className="hm-panel-body">
            {next ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
                <TeamBlock clubId={next.homeClubId} />
                <div style={{ textAlign: "center" }}>
                  <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                    {new Date(next.date).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                  <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800, color: "var(--hm-text-muted)" }}>vs</div>
                  <div className="hm-eyebrow">Allsvenskan · Omg {next.round}</div>
                </div>
                <TeamBlock clubId={next.awayClubId} />
              </div>
            ) : (
              <div className="hm-text-muted">Ingen match schemalagd.</div>
            )}
          </div>
        </div>

        {/* Recent results */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Senaste resultat</span>
            <FormDots results={recentForm as ("W" | "D" | "L")[]} />
          </div>
          <div className="hm-panel-body-flush">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Match</th>
                  <th>Resultat</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((f) => {
                  const home = getClub(f.homeClubId)!;
                  const away = getClub(f.awayClubId)!;
                  const isTumbaHome = f.homeClubId === club.id;
                  const won = isTumbaHome ? f.homeScore! > f.awayScore! : f.awayScore! > f.homeScore!;
                  const drawn = f.homeScore === f.awayScore;
                  return (
                    <tr key={f.id}>
                      <td className="hm-text-muted">{new Date(f.date).toLocaleDateString("sv-SE", { day: "2-digit", month: "2-digit" })}</td>
                      <td className="hm-td-strong">
                        {home.shortName} – {away.shortName}
                      </td>
                      <td>
                        <span className={`hm-badge ${drawn ? "hm-badge-warning" : won ? "hm-badge-positive" : "hm-badge-negative"}`}>
                          {f.homeScore}–{f.awayScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Squad status */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Truppstatus</span>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/squad")}>
              Visa trupp →
            </button>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", gap: 24 }}>
            <Stat label="Spelare" value={squad.length} />
            <Stat label="Skadade" value={injured.length} tone={injured.length > 0 ? "negative" : "positive"} />
            <Stat label="Avstängda" value={squad.filter((p) => p.squadStatus === "Avstängd").length} />
            <Stat label="Snitt fitness" value={`${Math.round(squad.reduce((a, p) => a + p.fitnessPct, 0) / squad.length)}%`} />
          </div>
          {injured.length > 0 ? (
            <div className="hm-panel-body" style={{ paddingTop: 0 }}>
              {injured.map((p) => (
                <div key={p.id} style={{ fontSize: "var(--hm-text-xs)", display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="hm-text-negative">Skadad</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="hm-grid" style={{ gap: 12 }}>
        {/* League table snippet */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Allsvenskan — tabell</span>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/competitions")}>
              Full tabell →
            </button>
          </div>
          <div className="hm-panel-body-flush">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Klubb</th>
                  <th className="hm-table-num">SM</th>
                  <th className="hm-table-num">P</th>
                </tr>
              </thead>
              <tbody>
                {tableSlice.map((row, i) => {
                  const c = getClub(row.clubId)!;
                  return (
                    <tr key={row.clubId} data-highlight={c.id === club.id}>
                      <td>{i + 1}</td>
                      <td className={c.id === club.id ? "hm-td-strong" : ""}>{c.shortName}</td>
                      <td className="hm-table-num">{row.played}</td>
                      <td className="hm-table-num hm-td-strong">{row.points}</td>
                    </tr>
                  );
                })}
                {myPosition > 6 && myRow ? (
                  <tr data-highlight="true">
                    <td>{myPosition}</td>
                    <td className="hm-td-strong">{club.shortName}</td>
                    <td className="hm-table-num">{myRow.played}</td>
                    <td className="hm-table-num hm-td-strong">{myRow.points}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inbox */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Inkorg</span>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/inbox")}>
              Visa alla →
            </button>
          </div>
          <div>
            {messages.map((m) => (
              <div
                key={m.id}
                onClick={() => router.push("/career/inbox")}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--hm-border-subtle)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
                  <span className="hm-text-muted">{m.category}</span>
                  <span className="hm-text-muted">{new Date(m.date).toLocaleDateString("sv-SE", { day: "2-digit", month: "2-digit" })}</span>
                </div>
                <div style={{ fontSize: "var(--hm-text-xs)", fontWeight: m.read ? 500 : 700 }}>{m.subject}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({ clubId }: { clubId: string }) {
  const c = getClub(clubId)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 110 }}>
      <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={36} />
      <div style={{ fontSize: "var(--hm-text-xs)", fontWeight: 700, textAlign: "center" }}>{c.shortName}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "positive" | "negative" }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div
        style={{
          fontSize: "var(--hm-text-lg)",
          fontWeight: 800,
          color: tone === "negative" ? "var(--hm-negative)" : tone === "positive" ? "var(--hm-positive)" : "var(--hm-text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
