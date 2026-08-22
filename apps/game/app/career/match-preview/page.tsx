"use client";

import { useRouter } from "next/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { getNextPlayerFixture } from "@/lib/career/calendar";
import { isAvailable, resolveStatusLabel } from "@/lib/career/playerStatus";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink, PlayerLink } from "@/components/entityLinks";

export default function MatchPreviewPage() {
  const router = useRouter();
  const { career, playManagerFixture } = useCareer();
  const fixture = getNextPlayerFixture(career);
  const squad = getCareerSquad(career);
  const unavailable = squad.filter((p) => !isAvailable(career.playerStatuses, p.id));

  if (career.seasonComplete) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Säsongen är avslutad — inga fler matcher att förhandsvisa.</div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Ingen kommande match schemalagd.</div>
      </div>
    );
  }

  // Career Rhythm's Continue Controller now stops exactly on the fixture's
  // own date with an unresolved MATCHDAY_READY (Spec S11.2) -- that IS the
  // matchday-ready condition, replacing the old jump-model's
  // "is this the next fixture" comparison.
  const isMatchdayReady = fixture.date === career.gameDate;

  function handlePlayMatch() {
    const { result } = playManagerFixture();
    if (result) {
      router.push(`/career/match-day/${result.fixtureId}`);
      return;
    }
    router.push("/career");
  }

  function handleQuickResult() {
    const { result } = playManagerFixture();
    if (result) {
      router.push(`/career/match-report/${result.fixtureId}`);
      return;
    }
    router.push("/career");
  }

  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/schedule")}>
              ← Schema
            </button>
            <span className="hm-panel-title">Matchförhandsvisning</span>
          </div>
          <span className="hm-badge hm-badge-neutral">{competitionName} · Omgång {fixture.round}</span>
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
        <div style={{ display: "flex", justifyContent: "center", gap: 10, paddingBottom: 20 }}>
          {isMatchdayReady ? (
            <>
              <button type="button" className="hm-btn hm-btn-primary" onClick={handlePlayMatch}>
                SPELA MATCH →
              </button>
              <button type="button" className="hm-btn" onClick={handleQuickResult}>
                SNABBRESULTAT
              </button>
            </>
          ) : (
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              Andra matcher i ligan spelas först — fortsätt via Fortsätt-knappen tills denna match är nästa händelse.
            </span>
          )}
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
                      <PlayerLink playerId={p.id}>
                        {p.firstName} {p.lastName}
                      </PlayerLink>
                    </td>
                    <td>{p.position}</td>
                    <td>
                      <span className="hm-badge hm-badge-negative">{resolveStatusLabel(career.playerStatuses, p)}</span>
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
      <div style={{ fontSize: "var(--hm-text-sm)", fontWeight: 800, textAlign: "center" }}>
        <ClubLink clubId={c.id}>{c.name}</ClubLink>
      </div>
    </div>
  );
}
