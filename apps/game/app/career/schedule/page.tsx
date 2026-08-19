"use client";

import { useRouter } from "next/navigation";
import { TUMBA_FIXTURES, getClub, getPlayerClub } from "@/lib/game-data";

export default function SchedulePage() {
  const router = useRouter();
  const club = getPlayerClub();

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Säsongsschema — Allsvenskan</span>
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
            {TUMBA_FIXTURES.map((f) => {
              const home = f.homeClubId === club.id;
              const opponent = getClub(home ? f.awayClubId : f.homeClubId)!;
              const isNext = f.status === "Kommande";
              return (
                <tr
                  key={f.id}
                  data-clickable={isNext}
                  data-highlight={isNext && f.id === TUMBA_FIXTURES.find((x) => x.status === "Kommande")?.id}
                  onClick={() => isNext && router.push("/career/match-preview")}
                >
                  <td>{f.round}</td>
                  <td>{new Date(f.date).toLocaleDateString("sv-SE", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td>{home ? "Hemma" : "Borta"}</td>
                  <td className="hm-td-strong">{opponent.name}</td>
                  <td>
                    <span className={`hm-badge ${f.status === "Spelad" ? "hm-badge-neutral" : "hm-badge-positive"}`}>{f.status}</span>
                  </td>
                  <td>
                    {f.status === "Spelad" ? (
                      <span className="hm-td-strong">
                        {home ? f.homeScore : f.awayScore}–{home ? f.awayScore : f.homeScore}
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
