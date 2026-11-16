"use client";
// SQD-02 (C) Feature Profile + Arena Nights profile chapters: SQD-02b matches (chart + log), SQD-02c/d/j attributes &
// development workspace (heat matrix, development curve, editable focus), SQD-02e deal sheet, SQD-02f career ribbon,
// SQD-02h condition gauges, SQD-02i mood hub, SQD-02k suitability court, SQD-02l range bars (external),
// SQD-02m scout report timeline, SQD-02p rehab timeline, SQD-02q skeleton + recover. Deep links: ?tab=.
import PlayerActions from '@/components/manager/PlayerActions';
import { careerPlayerVisibility } from "@/lib/knowledge/careerVisibility";
import { PlayerHero } from '@/components/game/Identity';
import ContractRenewal from '@/components/ContractRenewal';
import { PlayerTransferCard } from '@/components/transfers/PlayerTransferCard';

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { abilityStars, getClub, potentialStars } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { useCareer } from "@/lib/career/CareerContext";
import { activeClubId } from "@/lib/manager/employment";
import { getCareerPlayer, getCareerSquad } from "@/lib/career/careerWorld";
import { isFreeAgentClubId } from "@/lib/career/contractExpiry";
import { isRetiredClubId } from "@/lib/career/playerLifecycle";
import StarRating from "@/components/StarRating";
import StatValue from "@/components/StatValue";
import { GameplayAbilityPanel, GameplayAttributesPanel, type GameplayRatingRow } from "@/components/GameplayProfilePanels";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import type { GameplayPlayerRating } from "@/lib/gameWorld/gameplayRatingSnapshot";
import { getPlayerContract, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { getPlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { KnowledgeGatedAbilityPanel, KnowledgeGatedAttributesPanel } from "@/components/KnowledgeGatedProfilePanels";
import { buildScoutReportView } from "@/lib/knowledge/scoutReportVisibility";
import { getClubScouts, getPlayerScoutReports } from "@/lib/career/scouting";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import { PlayerDynamicsPanel } from "@/components/players/PlayerDynamicsPanel";
import { buildPlayerDossier } from "@/lib/players/playerDossier";
import { buildAttributeMatrix, ownPlayerAttributes, squadAttributeAverage, type AttributeEvent } from "@/lib/players/attributeMatrix";
import { CareerTimeline, ContractFuture, DevelopmentView, DossierBar, FormTimeline, KeyRatings, Readiness, SeasonLine } from "@/components/players/PlayerDossier";
import { AttributeHistoryRail, CareerRibbon, ConditionGauges, DealSheet, DevelopmentCurveCard, MatchesView, PlayerNotFound, ProfileSkeleton, RehabTimelinePanel } from "@/components/players/ProfileViews";
import { playerAvailabilityLabel } from "@/components/game/Identity";
import { useWorkspaceState } from "@/components/game/WorkspaceMemory";
import { ScoutReportPanel, type ScoutReportHistoryEntry } from "@/components/ScoutReportPanel";

// HM-RATINGS-CAREER-1.0 Part 25: every career player (REAL_WORLD, mock or
// generated) now has exactly one CareerState-resident GameplayPlayerRating
// -- this just drops the extra generation-model-version field the API
// route's read model doesn't carry; every other field is byte-identical.
function toGameplayRatingRow(rating: GameplayPlayerRating): GameplayRatingRow {
  return {
    playerId: rating.playerId,
    position: rating.position,
    ca: rating.ca,
    pa: rating.pa,
    caSource: rating.caSource,
    branch: rating.branch,
    attackRoleProficiencies: rating.attackRoleProficiencies,
    defenceRoleProficiencies: rating.defenceRoleProficiencies,
    locked: rating.locked,
  };
}

const TAB_IDS = ["overview", "matches", "development", "career", "contract"];
const TAB_ALIAS: Record<string, string> = { attributes: "development", history: "career" };

export default function PlayerProfilePage() {
  return <Suspense fallback={<ProfileSkeleton />}><PlayerProfile /></Suspense>;
}

function PlayerProfile() {
  useMoney(); // re-render every figure when the display currency changes
  const router = useRouter();
  const params = useParams<{ playerId: string }>();
  const search = useSearchParams();
  const { career, setPlayerIndividualFocus } = useCareer();
  const player = getCareerPlayer(career, params.playerId);

  // HM-UX-RATINGS-0.1: real-world players show HM-RATINGS-0.6's canonical, COMPLETE gameplay rating snapshot.
  // `undefined` = not yet fetched, `null` = fetched but this player has no gameplay rating (an honest failure --
  // falls back to the old mock display, same as any non-real-world player; never fabricated client-side).
  const initialTab = (() => { const t = search.get("tab") ?? "overview"; const id = TAB_ALIAS[t] ?? t; return TAB_IDS.includes(id) ? id : "overview"; })();
  const [tab, setTab] = useState(initialTab);
  const [ratingRow, setRatingRow] = useState<GameplayRatingRow | null | undefined>(undefined);
  const [compareWith, setCompareWith] = useState("");
  const [selectedAttr, setSelectedAttr] = useState<string | null>(null);
  const [recent, setRecent] = useWorkspaceState<string[]>("players.recent", []);

  useEffect(() => {
    if (!player) return;
    if (getCareerPlayerRating(career, player.id, player.clubId) || player.dataSource !== "REAL_WORLD") {
      // HM-RATINGS-CAREER-1.0 Part 25: a mock/generated player's rating already lives in CareerState.
      const rating = getCareerPlayerRating(career, player.id, player.clubId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot "no fetch needed for this player" resolution, not a cascading update loop.
      setRatingRow(rating ? toGameplayRatingRow(rating) : null);
      return;
    }
    let cancelled = false;
    fetch(`/api/game-world/gameplay-ratings/clubs/${encodeURIComponent(player.clubId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const row = (data?.players ?? []).find((r: GameplayRatingRow) => r.playerId === player.id) ?? null;
        setRatingRow(row);
      })
      .catch(() => {
        if (!cancelled) setRatingRow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [player, career]);

  // SQD-02q: remember recently opened profiles for the not-found recovery list.
  const playerId = player?.id;
  // The workspace setter is a new function each render and always re-renders, so record once per player.
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (!playerId || recorded.current === playerId) return;
    recorded.current = playerId;
    setRecent((prev) => prev[0] === playerId ? prev : [playerId, ...prev.filter((id) => id !== playerId)].slice(0, 8));
  }, [playerId, setRecent]);

  // Arena Nights Phase 2: the dossier model (pure, read-only, own-player gating inside).
  const dossier = useMemo(() => (player ? buildPlayerDossier(career, player.id) : undefined), [career, player]);
  // Employment states: a former club's players are seen from the outside (no internal actions, knowledge from memory).
  const isOwn = !!player && player.clubId === activeClubId(career);
  const devEvents: AttributeEvent[] = useMemo(() => dossier ? dossier.development.points.map((p) => ({ date: p.date, attribute: p.attribute, from: p.from, to: p.to, source: p.source })) : [], [dossier]);
  // SQD-02j: heat matrix (own players only); the compare overlay reads own players / the own squad average only.
  const matrix = useMemo(() => {
    if (!player || !isOwn || !ratingRow) return null;
    const branch = ratingRow.branch.branch;
    const compare = compareWith === "avg" ? squadAttributeAverage(career, branch, player.id) : compareWith ? ownPlayerAttributes(career, compareWith) ?? null : null;
    return buildAttributeMatrix({ branch, attributes: ratingRow.branch.attributes, position: player.position, events: devEvents, gameDate: career.gameDate, compare });
  }, [player, isOwn, ratingRow, compareWith, career, devEvents]);

  if (!player || !dossier) return <PlayerNotFound recent={recent.filter((id) => id !== params.playerId)} career={career} />;

  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate);
  const isWonderkid = age !== null && age <= 19 && potentialStars(player) >= 5;
  const isFreeAgentPlayer = isFreeAgentClubId(player.clubId);
  const isRetiredPlayer = isRetiredClubId(player.clubId);
  const club = getClub(player.clubId);
  const hasRatingProfile = Boolean(ratingRow);
  // HM-DATA-ALLSVENSKAN-1.1B Part 12: TRUE WORLD STATE -> MANAGER KNOWLEDGE -> PLAYER-FACING VIEW. Only an
  // EXTERNAL player's rating passes through the knowledge-gated resolver, which never exposes raw CA/PA or the
  // raw 1-20 attribute grid at any tier.
  const isOwnPlayer = isOwn;
  const knowledgePct = isOwnPlayer ? 100 : getPlayerKnowledgePct(career, player.id, player.clubId);
  const knowledgeView = !isOwnPlayer && ratingRow ? careerPlayerVisibility(career, ratingRow, player.id, knowledgePct) : null;
  const contract = getPlayerContract(career, player.id);
  const marketValue = getPlayerMarketValueEur(career, player.id);
  const trainingCompensation = getPlayerTrainingCompensation(career, player.id);

  // HM-SCOUTING-1.0: the scout report view, composed from the same knowledgePct/ratingRow resolved above.
  // SQD-02m: each filed version is resolved through the SAME gating at that report's own knowledge level, so the
  // timeline shows how the ranges narrowed (never a true value).
  const playerScoutReports = !isOwnPlayer ? getPlayerScoutReports(career, player.id) : [];
  const latestReport = playerScoutReports[0] ?? null;
  const clubScouts = getClubScouts(career);
  const scoutReportView = !isOwnPlayer && ratingRow ? buildScoutReportView(ratingRow, knowledgePct, marketValue, latestReport?.scoutSuitability ?? null) : null;
  const scoutReportHistory: ScoutReportHistoryEntry[] = playerScoutReports.map((r) => {
    const v = ratingRow ? buildScoutReportView({ ...ratingRow, playerId: player.id }, r.knowledgePctAtReport, marketValue, r.scoutSuitability) : null;
    return {
      reportId: r.id,
      createdDate: r.createdDate,
      scoutDisplayName: findStaffMember(career, r.scoutStaffId)?.displayName ?? "Okänd scout",
      abilityRange: v?.visibility.abilityRange,
      valueRange: v ? v.marketValueRange : undefined,
      knowledgePct: r.knowledgePctAtReport,
    };
  });

  const compareChoices = isOwnPlayer && ratingRow ? getCareerSquad(career).filter((p) => p.id !== player.id && (p.position === "MV") === (ratingRow.branch.branch === "GOALKEEPER")) : [];
  const compareControl = isOwnPlayer && ratingRow ? <label className="gp-compare">Jämför med<select className="hm-select" value={compareWith} onChange={(e) => setCompareWith(e.target.value)}>
    <option value="">Ingen jämförelse</option>
    <option value="avg">Truppsnitt ({ratingRow.branch.branch === "GOALKEEPER" ? "målvakter" : "utespelare"})</option>
    {compareChoices.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.firstName} {p.lastName}</option>)}
  </select>{compareWith && compareWith !== "avg" && <Link href={`/career/compare?left=${encodeURIComponent(player.id)}&right=${encodeURIComponent(compareWith)}`}>Full jämförelse →</Link>}</label> : null;
  const compareLabel = compareWith === "avg" ? "truppsnittet" : compareChoices.find((p) => p.id === compareWith)?.lastName ?? null;
  const selectedLabel = selectedAttr ? matrix?.families.flatMap((f) => f.tiles).find((t) => t.key === selectedAttr)?.label ?? selectedAttr : null;
  const attributesContent = <>{/* Attributes -- own players: SQD-02j heat matrix; external players NEVER see the raw attribute grid (Part 12). */}
        {ratingRow === undefined ? (
          <ProfileSkeleton />
        ) : !isOwnPlayer ? (
          knowledgeView ? <KnowledgeGatedAttributesPanel view={knowledgeView} playerId={player.id} hasOwnScout={clubScouts.length > 0} /> : <p className="hm-dossier-empty">Ingen bedömning av spelarens egenskaper finns ännu. <Link href={`/career/scouting?target=${encodeURIComponent(player.id)}`}>Scouta spelaren →</Link></p>
        ) : hasRatingProfile && matrix ? (
          <GameplayAttributesPanel matrix={matrix} position={player.position} compareLabel={compareLabel} compareControl={compareControl} selected={selectedAttr} onSelect={(a) => setSelectedAttr(selectedAttr === a ? null : a)} />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Egenskaper</span>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Tränarstabens bedömning</span>
            </div>
            <div className="hm-panel-body pv-legacy-attrs">
              <AttributeGroup title="Tekniska" entries={[
                ["Skott", player.attributes.technical.skott],
                ["Passning", player.attributes.technical.passning],
                ["Spelförståelse", player.attributes.technical.spelforstaelse],
                ["Genombrott", player.attributes.technical.genombrott],
                ["Mottagning", player.attributes.technical.mottagning],
                ["Fint", player.attributes.technical.fint],
                ["Spel utan boll", player.attributes.technical.spelUtanBoll],
              ]} />
              <AttributeGroup title="Mentala" entries={[
                ["Beslutsfattande", player.attributes.mental.beslutsfattande],
                ["Kyla", player.attributes.mental.kyla],
                ["Arbetskapacitet", player.attributes.mental.arbetskapacitet],
                ["Kampvilja", player.attributes.mental.kampvilja],
                ["Positionering", player.attributes.mental.positionering],
                ["Lagarbete", player.attributes.mental.lagarbete],
                ["Ledarskap", player.attributes.mental.ledarskap],
              ]} />
              <AttributeGroup title="Fysiska" entries={[
                ["Snabbhet", player.attributes.physical.snabbhet],
                ["Acceleration", player.attributes.physical.acceleration],
                ["Styrka", player.attributes.physical.styrka],
                ["Explosivitet", player.attributes.physical.explosivitet],
                ["Uthållighet", player.attributes.physical.uthallighet],
                ["Rörlighet", player.attributes.physical.rorlighet],
              ]} />
            </div>
          </div>
        )}
</>;
  const abilityContent = <>{/* Ability -- own: SQD-02k suitability court; external: SQD-02l range bars (raw CA/PA never shown). */}
        {ratingRow === undefined && player.dataSource === "REAL_WORLD" ? (
          <ProfileSkeleton />
        ) : !isOwnPlayer ? (
          knowledgeView ? <KnowledgeGatedAbilityPanel view={knowledgeView} playerId={player.id} hasOwnScout={clubScouts.length > 0} /> : null
        ) : hasRatingProfile ? (
          <GameplayAbilityPanel row={ratingRow!} secondaryPosition={player.secondaryPosition ?? null} />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Förmåga</span>
            </div>
            <div className="hm-panel-body pv-legacy-ability">
              <div><span className="hm-text-secondary">Nuvarande nivå</span><StarRating stars={abilityStars(player)} title="Tränarstabens bedömning av nuvarande nivå" /></div>
              <div><span className="hm-text-secondary">Potential</span><StarRating stars={potentialStars(player)} title="Scoutingens uppskattning — osäker" /></div>
              <p className="hm-dossier-note">
                {isWonderkid
                  ? "En av klubbens mest lovande unga spelare. Scoutingavdelningen ser stor utvecklingspotential, men bedömningen är fortfarande osäker så här tidigt."
                  : "Tränarstabens löpande bedömning baserat på matcher och träning."}
              </p>
            </div>
          </div>
        )}
</>;

  const contractContent = <>
        {/* SQD-02e (A) Deal sheet: contract facts, market value (exact for own players, knowledge-gated range for
            external ones), payroll/budget bar, the renewal flow and the transfer status card. Reads
            career.playerContracts, never the static PlayerMock fields. */}
        <DealSheet career={career} player={player} dossier={dossier}
          contractClubName={(contract?.clubId ? getClub(contract.clubId)?.name : club?.name) ?? "Okänd"}
          marketValue={isOwnPlayer ? (marketValue !== undefined ? formatMoney(marketValue) : "—")
            : scoutReportView?.marketValueRange ? (scoutReportView.marketValueRange.min === scoutReportView.marketValueRange.max ? formatMoney(scoutReportView.marketValueRange.min) : `${formatMoney(scoutReportView.marketValueRange.min)} – ${formatMoney(scoutReportView.marketValueRange.max)}`) : "—"}
          renewal={contract?.clubId === activeClubId(career) ? <ContractRenewal key={player.id} playerId={player.id} /> : null}
          transfer={<PlayerTransferCard playerId={player.id} />} />
</>;
  const bodyContent = <section className="hm-dossier-section" aria-labelledby="pv-body-h">
    <header><h2 id="pv-body-h">Kroppsprofil</h2></header>
    <dl className="pv-kv">
      <div><dt>Längd</dt><dd>{player.heightCm !== null ? `${player.heightCm} cm` : "Okänd"}</dd></div>
      <div><dt>Vikt</dt><dd>{player.weightKg !== null ? `${player.weightKg} kg` : "Okänd"}</dd></div>
      <div><dt>Hand</dt><dd>{player.foot ?? "Okänd"}</dd></div>
      <div><dt>Ålder</dt><dd>{age !== null ? `${age} år` : "Okänd"}</dd></div>
      <div><dt>Född</dt><dd>{player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString("sv-SE") : player.birthYear ? String(player.birthYear) : "Okänt"}</dd></div>
    </dl>
  </section>;
  const compensationContent = <section className="hm-dossier-section" aria-labelledby="pv-comp-h">
    {/* HM-CONTRACTS-1.0A: training compensation stays separate from market value/contract (never blended). */}
    <header><h2 id="pv-comp-h">Utbildningsersättning</h2></header>
    {trainingCompensation && trainingCompensation.totalEur > 0 ? <>
      <table className="hm-table pv-comp"><tbody>
        {trainingCompensation.perClub.map((share) => <tr key={share.clubId}><td><Link href={`/career/clubs/${encodeURIComponent(share.clubId)}`}>{getClub(share.clubId)?.name ?? share.clubId}</Link></td><td data-numeric="true">{share.years} år</td><td data-numeric="true">{formatMoney(share.amountEur)}</td></tr>)}
        <tr><th scope="row">Vid framtida övergång</th><td /><td data-numeric="true"><b>{formatMoney(trainingCompensation.totalEur)}</b></td></tr>
      </tbody></table>
      <p className="hm-dossier-note">Separat från marknadsvärde och övergångssumma. Uppskattat belopp.</p>
    </> : <p className="hm-dossier-note">Ingen utbildningsersättning (spelaren är över åldersgränsen eller saknar tidigare utbildningsklubb).</p>}
  </section>;
  const reportContent = !isOwnPlayer && scoutReportView ? (
    <ScoutReportPanel view={scoutReportView} history={scoutReportHistory} hasOwnScout={clubScouts.length > 0} onStartAssignment={() => router.push(`/career/scouting?target=${player.id}`)} />
  ) : null;
  // SQD-02c: Egenskaper + Utveckling are one chapter (the attributes & development workspace).
  const tabs = [["overview", "Översikt"], ["matches", "Matcher"], ["development", "Egenskaper & utveckling"], ["career", "Karriär"], ["contract", "Kontrakt & framtid"]];
  const availability = isOwnPlayer ? playerAvailabilityLabel(career, player.id) : isRetiredPlayer ? "Pensionerad" : isFreeAgentPlayer ? "Fri agent" : club?.shortName ?? "Extern";
  const back = <button type="button" className="hm-btn hm-btn-sm" onClick={() =>
    isOwnPlayer ? router.push("/career/squad") : isFreeAgentPlayer ? router.push("/career/transfers") : isRetiredPlayer ? router.push("/career/squad") : router.push(`/career/clubs/${player.clubId}`)
  }>← {isOwnPlayer ? "Trupp" : isFreeAgentPlayer ? "Transfers" : isRetiredPlayer ? "Trupp" : "Klubb"}</button>;

  return (
    <div className="hm-profile-page hm-dossier">
      <PlayerHero player={player} career={career}>{back}</PlayerHero>
      {/* SQD-02g: one primary action chosen from state; the existing actions follow. */}
      <DossierBar player={player} dossier={dossier} availability={availability} actions={<PlayerActions player={player} />} primary={
        isOwnPlayer && dossier.contract?.daysLeft != null && dossier.contract.daysLeft <= 365 ? <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => setTab("contract")}>Till förlängning →</button>
        : isOwnPlayer && Object.values(career.playerDynamics?.concerns ?? {}).some(c => c.playerId === player.id && c.status === "OPEN") ? <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => setTab("overview")}>Svara på oro</button>
        : null} />
      <nav className="hm-tabs hm-profile-tabs hm-dossier-tabs" aria-label="Spelarprofil">
        {tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <div className="hm-profile-body" key={tab}>
        {tab === "overview" && <div className="hm-profile-split">
          <div className="hm-profile-main">
            <SeasonLine dossier={dossier} position={player.position} />
            <section className="hm-dossier-section" aria-labelledby="dossier-form-h">
              <header><h2 id="dossier-form-h">Form · senaste matcherna</h2><button type="button" className="hm-btn hm-btn-sm" onClick={() => setTab("matches")}>Alla matcher →</button></header>
              <FormTimeline matches={dossier.matches} />
            </section>
            <KeyRatings dossier={dossier} fallback={abilityContent} />
            {isOwnPlayer && <ConditionGauges career={career} player={player} />}
            {/* HM-ALPHA3-M05 / SQD-02i: morale, talks, promises, requests, bids, transfer list and (risk zone) release. */}
            {isOwnPlayer && <PlayerDynamicsPanel playerId={player.id} />}
          </div>
          <aside className="hm-world-rail" aria-label="Beredskap, tillgänglighet och kontrakt">
            <Readiness dossier={dossier} />
            {!isOwnPlayer && abilityContent}
            {reportContent}
            <RehabTimelinePanel career={career} playerId={player.id} />
            <ContractFuture dossier={dossier} />
          </aside>
        </div>}
        {tab === "development" && (isOwnPlayer ? <div className="hm-stack">
          <DevelopmentCurveCard dossier={dossier} events={devEvents} goalkeeper={player.position === "MV"} onFocus={(f) => setPlayerIndividualFocus(player.id, f)} />
          <div className="hm-profile-split pv-workspace">
            <div className="hm-profile-main">{attributesContent}</div>
            <aside className="hm-world-rail">
              <AttributeHistoryRail events={devEvents} selected={selectedAttr} label={selectedLabel} onClear={() => setSelectedAttr(null)} />
              {abilityContent}
              {bodyContent}
            </aside>
          </div>
        </div> : <div className="hm-profile-split">
          <div className="hm-profile-main"><DevelopmentView dossier={dossier} />{attributesContent}</div>
          <aside className="hm-world-rail">{abilityContent}{reportContent}{bodyContent}</aside>
        </div>)}
        {tab === "matches" && <MatchesView dossier={dossier} career={career} playerId={player.id} goalkeeper={player.position === "MV"} />}
        {tab === "career" && <div className="hm-profile-split"><div className="hm-profile-main"><CareerRibbon career={career} player={player} age={age} /><CareerTimeline dossier={dossier} />{compensationContent}</div><aside className="hm-world-rail">{bodyContent}</aside></div>}
        {tab === "contract" && <div className="hm-stack"><ContractFuture dossier={dossier} />{contractContent}</div>}
      </div>
    </div>
  );
}

function AttributeGroup({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div>
      <div className="hm-eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      {entries.map(([label, value]) => (
        <div key={label} className="hm-stat-row">
          <span className="hm-stat-label">{label}</span>
          <StatValue value={value} />
        </div>
      ))}
    </div>
  );
}
