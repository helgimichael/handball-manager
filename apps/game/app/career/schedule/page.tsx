"use client";

import { useRouter } from "next/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getNextEventDate } from "@/lib/career/calendar";
import { ClubLink } from "@/components/entityLinks";

export default function SchedulePage() {
  const router = useRouter();
  const { career } = useCareer();
  const club = getCareerClub(career);
  const nextEventDate = getNextEventDate(career);
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";

  const fixtures = career.fixtures
    .filter((f) => f.homeClubId === club.id || f.awayClubId === club.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Säsongsschema — {competitionName} {career.seasonId}</span>
        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{fixtures.length} matcher</span>
      </div>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead>
            <tr>
              <th>Omg</th>
              <th>Datum</th>
              <th>Hemma / Borta</th>
              <th>Motstånd</th>
              <th>Status</th>
              <th>Resultat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => {
              const home = f.homeClubId === club.id;
              const opponent = getClub(home ? f.awayClubId : f.homeClubId)!;
              const result = career.results[f.id];
              const isNext = !result && f.date === nextEventDate;
              const played = Boolean(result);
              // HM-UX-0.2 (Spec §36): Match Preview always shows the
              // career's actual next fixture, not an arbitrary one --
              // it has no per-fixture route. A future (not-yet-next)
              // fixture must not link there, or clicking round 8 would
              // silently show round 3's preview. Only the real next
              // fixture, and every already-played one, are clickable.
              const clickable = played || isNext;
              const gf = result ? (home ? result.homeGoals : result.awayGoals) : undefined;
              const ga = result ? (home ? result.awayGoals : result.homeGoals) : undefined;
              const outcome = result ? (gf! > ga! ? "Vinst" : gf! < ga! ? "Förlust" : "Oavgjort") : undefined;
              const outcomeTone = outcome === "Vinst" ? "positive" : outcome === "Förlust" ? "negative" : "warning";
              return (
                <tr
                  key={f.id}
                  data-clickable={clickable}
                  data-highlight={isNext}
                  onClick={clickable ? () => router.push(played ? `/career/match-report/${f.id}` : "/career/match-preview") : undefined}
                >
                  <td>{f.round}</td>
                  <td>{new Date(f.date).toLocaleDateString("sv-SE", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td>{home ? "Hemma" : "Borta"}</td>
                  <td className="hm-td-strong">
                    <ClubLink clubId={opponent.id} stopPropagation>
                      {opponent.name}
                    </ClubLink>
                  </td>
                  <td>
                    <span className={`hm-badge ${played ? "hm-badge-neutral" : isNext ? "hm-badge-positive" : "hm-badge-warning"}`}>
                      {played ? "Spelad" : isNext ? "Nästa match" : "Kommande"}
                    </span>
                  </td>
                  <td>
                    {result ? (
                      <span className="hm-td-strong">
                        {gf}–{ga}
                      </span>
                    ) : (
                      <span className="hm-text-muted">—</span>
                    )}
                  </td>
                  <td>{outcome ? <span className={`hm-badge hm-badge-${outcomeTone}`}>{outcome}</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
