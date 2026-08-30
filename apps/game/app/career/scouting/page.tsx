"use client";

// HM-SCOUTING-1.0: the real scouting workspace -- replaces the old
// static/fictional page (previously rendered lib/game-data/scouting.ts's
// hardcoded SCOUTED_PLAYERS with an explicit "no real scouting
// simulation" disclaimer). This page drives the real loop:
//   ASSIGN SCOUT -> TIME PASSES (Continue/daily tick) -> KNOWLEDGE
//   INCREASES -> REPORT -> BETTER MANAGER VIEW (see the report panel on
//   Player Profile, components/ScoutReportPanel.tsx).
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClub, getCompetition, positionLabel, type HandballPosition } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad, getCareerPlayer, getExternalCandidateClubs } from "@/lib/career/careerWorld";
import { getAllScoutingAssignments, computeAssignmentProgressPct, getClubScouts, type ScoutAssignmentType } from "@/lib/career/scouting";
import { getAllScoutDiscoveries, scopeLabelSv, NATION_LABEL_SV } from "@/lib/career/scoutDiscovery";
import { clubNation } from "@/lib/staff/scoutPool";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { KNOWLEDGE_TIER_LABEL_SV, knowledgeTier } from "@/lib/knowledge/types";

const BROAD_TYPE_LABEL_SV: Record<Exclude<ScoutAssignmentType, "PLAYER">, string> = {
  CLUB: "Klubb",
  COMPETITION: "Liga",
  REGION: "Land/region",
  POSITION: "Position",
  AGE_BAND: "Ålder",
};

export default function ScoutingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { career, createScoutingAssignment, createBroadScoutingAssignment, cancelScoutingAssignment } = useCareer();

  const scouts = getClubScouts(career);
  const assignments = getAllScoutingAssignments(career);
  const playerAssignments = assignments.filter((a) => a.assignmentType === "PLAYER");
  const broadAssignments = assignments.filter((a) => a.assignmentType !== "PLAYER");
  const activeAssignments = playerAssignments.filter((a) => a.status === "IN_PROGRESS");
  const completedAssignments = playerAssignments.filter((a) => a.status === "COMPLETED");
  const activeBroadAssignments = broadAssignments.filter((a) => a.status === "IN_PROGRESS");

  const discoveries = getAllScoutDiscoveries(career);

  const candidateClubs = useMemo(() => getExternalCandidateClubs(career), [career]);
  const candidateCompetitions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const club of candidateClubs) {
      if (!byId.has(club.competitionId)) {
        const competition = getCompetition(club.competitionId);
        byId.set(club.competitionId, { id: club.competitionId, name: competition?.name ?? club.competitionId });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [candidateClubs]);
  const candidateNations = useMemo(() => {
    const nations = new Set<string>();
    for (const club of candidateClubs) {
      const nation = clubNation(club.id);
      if (nation) nations.add(nation);
    }
    return Array.from(nations).sort((a, b) => (NATION_LABEL_SV[a] ?? a).localeCompare(NATION_LABEL_SV[b] ?? b));
  }, [candidateClubs]);

  const [broadType, setBroadType] = useState<Exclude<ScoutAssignmentType, "PLAYER">>("CLUB");
  const [broadClubId, setBroadClubId] = useState<string>("");
  const [broadCompetitionId, setBroadCompetitionId] = useState<string>("");
  const [broadNation, setBroadNation] = useState<string>("");
  const [broadPosition, setBroadPosition] = useState<HandballPosition>("MV");
  const [broadMaxAge, setBroadMaxAge] = useState<number>(21);
  const [broadScoutId, setBroadScoutId] = useState<string | null>(scouts[0]?.id ?? null);
  const [broadFormError, setBroadFormError] = useState<string | null>(null);
  const [discoveryFilterScoutId, setDiscoveryFilterScoutId] = useState<string>("ALL");
  const [discoveryFilterType, setDiscoveryFilterType] = useState<ScoutAssignmentType | "ALL">("ALL");

  function startBroadAssignment() {
    setBroadFormError(null);
    if (!broadScoutId) return;
    const scope =
      broadType === "CLUB"
        ? { targetClubId: broadClubId }
        : broadType === "COMPETITION"
          ? { targetCompetitionId: broadCompetitionId }
          : broadType === "REGION"
            ? { targetNation: broadNation }
            : broadType === "POSITION"
              ? { targetPosition: broadPosition }
              : { targetMaxAgeYears: broadMaxAge };
    const result = createBroadScoutingAssignment(broadScoutId, broadType, scope);
    if (!result.ok) {
      setBroadFormError(result.errors.join(" "));
    }
  }

  const filteredDiscoveries = discoveries.filter((d) => {
    if (discoveryFilterScoutId !== "ALL" && d.scoutStaffId !== discoveryFilterScoutId) return false;
    if (discoveryFilterType !== "ALL" && d.assignmentType !== discoveryFilterType) return false;
    return true;
  });

  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(searchParams.get("target"));
  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(scouts[0]?.id ?? null);
  const [formError, setFormError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const clubs = getExternalCandidateClubs(career);
    const rows = clubs.flatMap((club) => getCareerClubSquad(career, club.id).map((p) => ({ player: p, club })));
    return rows.filter(({ player }) => {
      if (positionFilter !== "ALL" && player.position !== positionFilter) return false;
      if (query.trim().length === 0) return true;
      return `${player.firstName} ${player.lastName}`.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [career, query, positionFilter]);

  const selectedPlayer = selectedPlayerId ? getCareerPlayer(career, selectedPlayerId) : undefined;
  const selectedKnowledgePct = selectedPlayer ? getPlayerKnowledgePct(career, selectedPlayer.id, selectedPlayer.clubId) : null;

  function startAssignment() {
    setFormError(null);
    if (!selectedPlayerId || !selectedScoutId || !selectedPlayer) return;
    const result = createScoutingAssignment(selectedScoutId, selectedPlayerId, selectedPlayer.clubId);
    if (!result.ok) {
      setFormError(result.errors.join(" "));
      return;
    }
    setSelectedPlayerId(null);
  }

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Scouts */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Dina scouter</span>
          </div>
          {scouts.length === 0 ? (
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              Din klubb har ingen anställd scout. Ny bevakning kan inte startas förrän en scout rekryteras.{" "}
              <button type="button" className="hm-btn hm-btn-sm" style={{ marginLeft: 6 }} onClick={() => router.push("/career/staff/recruitment")}>
                Rekrytera personal
              </button>
            </div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scouts.map((scout) => {
                const suitability = computeRoleSuitability(scout, "SCOUT");
                const activeCount = activeAssignments.filter((a) => a.scoutStaffId === scout.id).length;
                return (
                  <div key={scout.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--hm-text-xs)" }}>
                    <span
                      style={{ fontWeight: 700, cursor: "pointer" }}
                      onClick={() => router.push(`/career/staff/${scout.id}`)}
                    >
                      {scout.displayName}
                    </span>
                    <span className="hm-text-muted">
                      Spelarbedömning/potentialbedömning {suitability.toFixed(1)}/20 · {activeCount} aktiva uppdrag
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create assignment */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Ny bevakning</span>
            <input
              style={{ ...inputStyle, maxWidth: 180 }}
              placeholder="Sök spelare..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="hm-panel-body" style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 0 }}>
            {(["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className="hm-btn hm-btn-sm"
                style={{
                  background: positionFilter === p ? "var(--hm-accent)" : undefined,
                  borderColor: positionFilter === p ? "var(--hm-accent)" : undefined,
                  color: positionFilter === p ? "#fff" : undefined,
                }}
                onClick={() => setPositionFilter(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="hm-scroll-x" style={{ maxHeight: 320, overflowY: "auto" }}>
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Spelare</th>
                  <th>Pos</th>
                  <th>Ålder</th>
                  <th>Klubb</th>
                  <th className="hm-table-num">Kännedom</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 60).map(({ player, club }) => {
                  const pct = getPlayerKnowledgePct(career, player.id, player.clubId);
                  return (
                    <tr key={player.id} data-clickable="true" onClick={() => setSelectedPlayerId(player.id)} style={{ background: selectedPlayerId === player.id ? "var(--hm-surface-2)" : undefined }}>
                      <td className="hm-td-strong">{player.firstName} {player.lastName}</td>
                      <td title={positionLabel(player.position)}>{player.position}</td>
                      <td>{playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate) ?? "–"}</td>
                      <td className="hm-text-muted">{club.shortName}</td>
                      <td className="hm-table-num">{KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(pct)]}</td>
                      <td>
                        <button type="button" className="hm-btn hm-btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(player.id); }}>
                          Välj
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {candidates.length === 0 ? <div className="hm-panel-body hm-text-muted">Inga spelare matchar filtret.</div> : null}

          {selectedPlayer ? (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--hm-border)" }}>
              <div style={{ fontWeight: 700 }}>
                {selectedPlayer.firstName} {selectedPlayer.lastName} · {getClub(selectedPlayer.clubId)?.name ?? selectedPlayer.clubId}
              </div>
              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                Nuvarande kännedom: {selectedKnowledgePct !== null ? KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(selectedKnowledgePct)] : "—"}
              </div>
              {scouts.length > 0 ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                  Scout
                  <select style={inputStyle} value={selectedScoutId ?? ""} onChange={(e) => setSelectedScoutId(e.target.value)}>
                    {scouts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="button" className="hm-btn hm-btn-primary hm-btn-sm" disabled={scouts.length === 0} onClick={startAssignment}>
                Starta bevakning
              </button>
              {formError ? <div style={{ color: "var(--hm-negative, #b23a2e)", fontSize: "var(--hm-text-2xs)" }}>{formError}</div> : null}
            </div>
          ) : null}
        </div>

        {/* Broad discovery assignment */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Nytt bredare uppdrag</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Skicka en scout på ett bredare uppdrag utan att veta spelarens namn i förväg -- scouten upptäcker relevanta spelare över tid.
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(BROAD_TYPE_LABEL_SV) as Exclude<ScoutAssignmentType, "PLAYER">[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="hm-btn hm-btn-sm"
                  style={{
                    background: broadType === t ? "var(--hm-accent)" : undefined,
                    borderColor: broadType === t ? "var(--hm-accent)" : undefined,
                    color: broadType === t ? "#fff" : undefined,
                  }}
                  onClick={() => setBroadType(t)}
                >
                  {BROAD_TYPE_LABEL_SV[t]}
                </button>
              ))}
            </div>

            {broadType === "CLUB" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                Klubb
                <select style={inputStyle} value={broadClubId} onChange={(e) => setBroadClubId(e.target.value)}>
                  <option value="">Välj klubb...</option>
                  {candidateClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {broadType === "COMPETITION" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                Liga
                <select style={inputStyle} value={broadCompetitionId} onChange={(e) => setBroadCompetitionId(e.target.value)}>
                  <option value="">Välj liga...</option>
                  {candidateCompetitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {broadType === "REGION" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                Land
                <select style={inputStyle} value={broadNation} onChange={(e) => setBroadNation(e.target.value)}>
                  <option value="">Välj land...</option>
                  {candidateNations.map((n) => (
                    <option key={n} value={n}>
                      {NATION_LABEL_SV[n] ?? n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {broadType === "POSITION" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                Position
                <select style={inputStyle} value={broadPosition} onChange={(e) => setBroadPosition(e.target.value as HandballPosition)}>
                  {(["MV", "V9", "V6", "M9", "M6", "H9", "H6"] as const).map((p) => (
                    <option key={p} value={p}>
                      {p} · {positionLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {broadType === "AGE_BAND" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                Högsta ålder (t.ex. 21 för U21)
                <input style={inputStyle} type="number" min={15} max={40} value={broadMaxAge} onChange={(e) => setBroadMaxAge(Number(e.target.value))} />
              </label>
            ) : null}

            {scouts.length > 0 ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                Scout
                <select style={inputStyle} value={broadScoutId ?? ""} onChange={(e) => setBroadScoutId(e.target.value)}>
                  {scouts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" className="hm-btn hm-btn-primary hm-btn-sm" disabled={scouts.length === 0} onClick={startBroadAssignment}>
              Starta uppdrag
            </button>
            {broadFormError ? <div style={{ color: "var(--hm-negative, #b23a2e)", fontSize: "var(--hm-text-2xs)" }}>{broadFormError}</div> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Active assignments */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Aktiva uppdrag ({activeAssignments.length})</span>
          </div>
          {activeAssignments.length === 0 ? (
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              Inga pågående bevakningar.
            </div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeAssignments.map((a) => {
                const player = getCareerPlayer(career, a.targetPlayerId);
                const scout = findStaffMember(career, a.scoutStaffId);
                const progress = computeAssignmentProgressPct(a, career.gameDate);
                return (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span
                        style={{ fontWeight: 700, cursor: player ? "pointer" : undefined }}
                        onClick={() => player && router.push(`/career/squad/${player.id}`)}
                      >
                        {player ? `${player.firstName} ${player.lastName}` : a.targetPlayerId}
                      </span>
                      <span className="hm-text-muted">{scout?.displayName ?? "Okänd scout"}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--hm-surface-3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "var(--hm-accent)" }} />
                    </div>
                    <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                      {progress}% klart · klar {a.endDate}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed reports */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Färdiga rapporter ({completedAssignments.length})</span>
          </div>
          {completedAssignments.length === 0 ? (
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              Inga rapporter ännu.
            </div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completedAssignments.map((a) => {
                const player = getCareerPlayer(career, a.targetPlayerId);
                const scout = findStaffMember(career, a.scoutStaffId);
                const pct = getPlayerKnowledgePct(career, a.targetPlayerId, a.targetClubId);
                return (
                  <div
                    key={a.id}
                    data-clickable="true"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--hm-text-xs)", cursor: "pointer" }}
                    onClick={() => router.push(`/career/squad/${a.targetPlayerId}`)}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{player ? `${player.firstName} ${player.lastName}` : a.targetPlayerId}</div>
                      <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                        {scout?.displayName ?? "Okänd scout"} · {getClub(a.targetClubId)?.name ?? a.targetClubId}
                      </div>
                    </div>
                    <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(pct)]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Broad assignments */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Breda uppdrag ({activeBroadAssignments.length})</span>
          </div>
          {broadAssignments.length === 0 ? (
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              Inga bredare uppdrag ännu.
            </div>
          ) : (
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {broadAssignments.map((a) => {
                const scout = findStaffMember(career, a.scoutStaffId);
                const progress = computeAssignmentProgressPct(a, career.gameDate);
                return (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-xs)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700 }}>
                        {BROAD_TYPE_LABEL_SV[a.assignmentType as Exclude<ScoutAssignmentType, "PLAYER">]} · {scopeLabelSv(a)}
                      </span>
                      <span className="hm-text-muted">{scout?.displayName ?? "Okänd scout"}</span>
                    </div>
                    {a.status === "IN_PROGRESS" ? (
                      <>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--hm-surface-3)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${progress}%`, background: "var(--hm-accent)" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                            Cykel {a.cyclesCompleted + 1}/{a.maxCycles} · {progress}% klar {a.endDate}
                          </span>
                          <button type="button" className="hm-btn hm-btn-sm" onClick={() => cancelScoutingAssignment(a.id)}>
                            Avbryt
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="hm-badge hm-badge-neutral" style={{ alignSelf: "flex-start" }}>
                        {a.status === "COMPLETED" ? "Avslutat" : "Avbrutet"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Discovered players */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Upptäckta spelare ({filteredDiscoveries.length})</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 0 }}>
            <select style={{ ...inputStyle, maxWidth: 160 }} value={discoveryFilterScoutId} onChange={(e) => setDiscoveryFilterScoutId(e.target.value)}>
              <option value="ALL">Alla scouter</option>
              {scouts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
            <select style={{ ...inputStyle, maxWidth: 160 }} value={discoveryFilterType} onChange={(e) => setDiscoveryFilterType(e.target.value as ScoutAssignmentType | "ALL")}>
              <option value="ALL">Alla källor</option>
              {(Object.keys(BROAD_TYPE_LABEL_SV) as Exclude<ScoutAssignmentType, "PLAYER">[]).map((t) => (
                <option key={t} value={t}>
                  {BROAD_TYPE_LABEL_SV[t]}
                </option>
              ))}
            </select>
          </div>
          {filteredDiscoveries.length === 0 ? (
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              Inga upptäckta spelare ännu.
            </div>
          ) : (
            <div className="hm-scroll-x" style={{ maxHeight: 360, overflowY: "auto" }}>
              <table className="hm-table">
                <thead>
                  <tr>
                    <th>Spelare</th>
                    <th>Klubb</th>
                    <th>Källa</th>
                    <th>Scout</th>
                    <th className="hm-table-num">Kännedom</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscoveries.slice(0, 60).map((d) => {
                    const player = getCareerPlayer(career, d.playerId);
                    const scout = findStaffMember(career, d.scoutStaffId);
                    const pct = getPlayerKnowledgePct(career, d.playerId, d.clubId);
                    return (
                      <tr key={d.id} data-clickable="true" onClick={() => router.push(`/career/squad/${d.playerId}`)}>
                        <td className="hm-td-strong">{player ? `${player.firstName} ${player.lastName}` : d.playerId}</td>
                        <td className="hm-text-muted">{getClub(d.clubId)?.shortName ?? d.clubId}</td>
                        <td className="hm-text-muted">{BROAD_TYPE_LABEL_SV[d.assignmentType as Exclude<ScoutAssignmentType, "PLAYER">] ?? d.assignmentType}</td>
                        <td className="hm-text-muted">{scout?.displayName ?? "Okänd scout"}</td>
                        <td className="hm-table-num">{KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(pct)]}</td>
                        <td>
                          <button
                            type="button"
                            className="hm-btn hm-btn-sm"
                            disabled={scouts.length === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (scouts.length === 0) return;
                              createScoutingAssignment(scouts[0].id, d.playerId, d.clubId);
                            }}
                          >
                            Starta full scouting
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
} as const;
