import { getClub, getPlayedFixtures, getPlayerClub } from "@/lib/game-data";

export default function MatchesPage() {
  const club = getPlayerClub();
  const played = [...getPlayedFixtures()].reverse();

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Matcher — resultat</span>
        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{played.length} spelade matcher</span>
      </div>
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
              const home = getClub(f.homeClubId)!;
              const away = getClub(f.awayClubId)!;
              const tumbaHome = f.homeClubId === club.id;
              const gf = tumbaHome ? f.homeScore! : f.awayScore!;
              const ga = tumbaHome ? f.awayScore! : f.homeScore!;
              const outcome = gf > ga ? "Vinst" : gf < ga ? "Förlust" : "Oavgjort";
              const tone = outcome === "Vinst" ? "positive" : outcome === "Förlust" ? "negative" : "warning";
              return (
                <tr key={f.id}>
                  <td className="hm-text-muted">{new Date(f.date).toLocaleDateString("sv-SE")}</td>
                  <td>{f.round}</td>
                  <td className={home.id === club.id ? "hm-td-strong" : ""}>{home.name}</td>
                  <td className="hm-td-strong">
                    {f.homeScore}–{f.awayScore}
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
    </div>
  );
}
