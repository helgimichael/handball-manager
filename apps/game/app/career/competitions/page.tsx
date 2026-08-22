"use client";

import { useState } from "react";
import { COMPETITIONS, NATIONS, getClub, getClubsByCompetition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getLiveStandings } from "@/lib/career/standings";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink } from "@/components/entityLinks";

export default function CompetitionsPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const [competitionId, setCompetitionId] = useState(career.competitionId);
  const competition = COMPETITIONS.find((c) => c.id === competitionId)!;
  const clubs = getClubsByCompetition(competitionId);
  const isLiveCompetition = competitionId === career.competitionId;
  const liveTable = isLiveCompetition ? getLiveStandings(career) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, height: "100%" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Tävlingar</span>
        </div>
        <div style={{ overflowY: "auto" }}>
          {NATIONS.map((n) => (
            <div key={n.code}>
              <div className="hm-nav-group-label" style={{ padding: "8px 12px 2px" }}>{n.name}</div>
              {COMPETITIONS.filter((c) => c.nation === n.code).map((c) => (
                <div
                  key={c.id}
                  className="hm-nav-item"
                  data-active={c.id === competitionId}
                  style={{ borderRadius: 0 }}
                  onClick={() => setCompetitionId(c.id)}
                >
                  <span>{c.name}</span>
                  <span className="hm-text-muted" style={{ marginLeft: "auto", fontSize: "10px" }}>T{c.tier}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="hm-grid" style={{ gap: 12, alignContent: "start" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">
              {competition.name}
              {competition.officialName ? <span className="hm-text-muted" style={{ fontWeight: 500, marginLeft: 6 }}>({competition.officialName})</span> : null}
            </span>
            {isLiveCompetition ? (
              <span className="hm-badge hm-badge-positive">LIVE-SIMULERAD SÄSONG</span>
            ) : (
              <span className="hm-badge hm-badge-neutral">{clubs.length} klubbar (ej simulerad)</span>
            )}
          </div>
          {liveTable ? (
            <div className="hm-scroll-x">
              <table className="hm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Klubb</th>
                    <th className="hm-table-num">SM</th>
                    <th className="hm-table-num">V</th>
                    <th className="hm-table-num">O</th>
                    <th className="hm-table-num">F</th>
                    <th className="hm-table-num">GM</th>
                    <th className="hm-table-num">IM</th>
                    <th className="hm-table-num">MSK</th>
                    <th className="hm-table-num">P</th>
                  </tr>
                </thead>
                <tbody>
                  {liveTable.map((row, i) => {
                    const c = getClub(row.clubId)!;
                    return (
                      <tr key={row.clubId} data-highlight={c.id === club.id}>
                        <td>{i + 1}</td>
                        <td style={{ display: "flex", alignItems: "center", gap: 6 }} className={c.id === club.id ? "hm-td-strong" : ""}>
                          <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={16} />
                          <ClubLink clubId={c.id}>{c.name}</ClubLink>
                        </td>
                        <td className="hm-table-num">{row.played}</td>
                        <td className="hm-table-num">{row.won}</td>
                        <td className="hm-table-num">{row.drawn}</td>
                        <td className="hm-table-num">{row.lost}</td>
                        <td className="hm-table-num">{row.goalsFor}</td>
                        <td className="hm-table-num">{row.goalsAgainst}</td>
                        <td className="hm-table-num">{row.goalDifference}</td>
                        <td className="hm-table-num hm-td-strong">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hm-scroll-x">
              <table className="hm-table">
                <thead>
                  <tr>
                    <th>Klubb</th>
                    <th>Stad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((c) => (
                    <tr key={c.id} className={c.playable ? "" : "hm-not-playable"}>
                      <td style={{ display: "flex", alignItems: "center", gap: 6 }} className="hm-td-strong">
                        <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={16} />
                        {c.name}
                      </td>
                      <td>{c.city ?? "—"}</td>
                      <td>{c.playable ? <span className="hm-badge hm-badge-positive">SPELBAR</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                Denna liga simuleras inte i HM-GAME-0.2A — endast klubbnamn (verkliga) visas, ingen tabell/resultat.
                {competition.sourceNote}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
