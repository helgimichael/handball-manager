"use client";

import { useRouter } from "next/navigation";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getNextEventDate } from "@/lib/career/calendar";

export default function SchedulePage() {
  const router = useRouter();
  const { career } = useCareer();
  const club = getCareerClub(career);
  const nextEventDate = getNextEventDate(career);
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";

  const tumbaFixtures = career.fixtures
    .filter((f) => f.homeClubId === club.id || f.awayClubId === club.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Säsongsschema — {competitionName} {career.seasonId}</span>
        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>26 matcher</span>
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
            </tr>
          </thead>
          <tbody>
            {tumbaFixtures.map((f) => {
              const home = f.homeClubId === club.id;
              const opponent = getClub(home ? f.awayClubId : f.homeClubId)!;
              const result = career.results[f.id];
              const isNext = !result && f.date === nextEventDate;
              const played = Boolean(result);
              return (
                <tr
                  key={f.id}
                  data-clickable="true"
                  data-highlight={isNext}
                  onClick={() => router.push(played ? `/career/match-report/${f.id}` : "/career/match-preview")}
                >
                  <td>{f.round}</td>
                  <td>{new Date(f.date).toLocaleDateString("sv-SE", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td>{home ? "Hemma" : "Borta"}</td>
                  <td className="hm-td-strong">{opponent.name}</td>
                  <td>
                    <span className={`hm-badge ${played ? "hm-badge-neutral" : isNext ? "hm-badge-positive" : "hm-badge-warning"}`}>
                      {played ? "Spelad" : isNext ? "Nästa match" : "Kommande"}
                    </span>
                  </td>
                  <td>
                    {result ? (
                      <span className="hm-td-strong">
                        {home ? result.homeGoals : result.awayGoals}–{home ? result.awayGoals : result.homeGoals}
                      </span>
                    ) : (
                      <span className="hm-text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
