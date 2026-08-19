"use client";

import { useRouter } from "next/navigation";
import { getClub, getNextFixture, getSquad } from "@/lib/game-data";
import ClubCrest from "@/components/ClubCrest";

export default function MatchPreviewPage() {
  const router = useRouter();
  const fixture = getNextFixture();
  const squad = getSquad();
  const unavailable = squad.filter((p) => p.squadStatus === "Skadad" || p.squadStatus === "Avstängd");

  if (!fixture) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Ingen kommande match schemalagd.</div>
      </div>
    );
  }

  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matchförhandsvisning</span>
          <span className="hm-badge hm-badge-neutral">Allsvenskan · Omgång {fixture.round}</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, padding: "28px" }}>
          <TeamColumn clubId={home.id} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800, color: "var(--hm-text-muted)" }}>–</div>
            <div className="hm-eyebrow" style={{ marginTop: 8 }}>
              {new Date(fixture.date).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <TeamColumn clubId={away.id} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 20 }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push("/career/match-center")}>
            GÅ TILL MATCH →
          </button>
        </div>
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Otillgängliga spelare</span>
          </div>
          {unavailable.length === 0 ? (
            <div className="hm-panel-body hm-text-muted">Ingen trupp saknas — full trupp tillgänglig.</div>
          ) : (
            <table className="hm-table">
              <tbody>
                {unavailable.map((p) => (
                  <tr key={p.id}>
                    <td className="hm-td-strong">
                      {p.firstName} {p.lastName}
                    </td>
                    <td>{p.position}</td>
                    <td>
                      <span className="hm-badge hm-badge-negative">{p.squadStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Assisterande tränarens analys</span>
          </div>
          <div className="hm-panel-body" style={{ fontSize: "var(--hm-text-xs)", color: "var(--hm-text-secondary)", lineHeight: 1.6 }}>
            {away.shortName} spelar ett strukturerat 6:0-försvar och förlitar sig på snabba omställningar. Vi bör
            hålla bollinnehavet högt och utnyttja våra kantspelares fart i öppna ytor.
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamColumn({ clubId }: { clubId: string }) {
  const c = getClub(clubId)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 140 }}>
      <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={56} />
      <div style={{ fontSize: "var(--hm-text-sm)", fontWeight: 800, textAlign: "center" }}>{c.name}</div>
    </div>
  );
}
