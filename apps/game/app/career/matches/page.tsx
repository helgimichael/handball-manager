"use client";

import { useRouter } from "next/navigation";
import { getClub, getPlayerClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";

export default function MatchesPage() {
  const router = useRouter();
  const { career } = useCareer();
  const club = getPlayerClub();

  const played = career.fixtures
    .filter((f) => (f.homeClubId === club.id || f.awayClubId === club.id) && career.results[f.id])
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Matcher — resultat</span>
        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{played.length} spelade matcher</span>
      </div>
      {played.length === 0 ? (
        <div className="hm-panel-body hm-text-muted">Inga matcher spelade ännu den här säsongen.</div>
      ) : (
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Omg</th>
                <th>Hemmalag</th>
                <th>Resultat</th>
                <th>Bortalag</th>
                <th>Utfall</th>
              </tr>
            </thead>
            <tbody>
              {played.map((f) => {
                const result = career.results[f.id];
                const home = getClub(f.homeClubId)!;
                const away = getClub(f.awayClubId)!;
                const tumbaHome = f.homeClubId === club.id;
                const gf = tumbaHome ? result.homeGoals : result.awayGoals;
                const ga = tumbaHome ? result.awayGoals : result.homeGoals;
                const outcome = gf > ga ? "Vinst" : gf < ga ? "Förlust" : "Oavgjort";
                const tone = outcome === "Vinst" ? "positive" : outcome === "Förlust" ? "negative" : "warning";
                return (
                  <tr key={f.id} data-clickable="true" onClick={() => router.push(`/career/match-report/${f.id}`)}>
                    <td className="hm-text-muted">{new Date(f.date).toLocaleDateString("sv-SE")}</td>
                    <td>{f.round}</td>
                    <td className={home.id === club.id ? "hm-td-strong" : ""}>{home.name}</td>
                    <td className="hm-td-strong">
                      {result.homeGoals}–{result.awayGoals}
                    </td>
                    <td className={away.id === club.id ? "hm-td-strong" : ""}>{away.name}</td>
                    <td>
                      <span className={`hm-badge hm-badge-${tone}`}>{outcome}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
