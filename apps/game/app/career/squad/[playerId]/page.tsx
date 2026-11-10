"use client";
import { DevelopmentHistory } from "@/components/players/DevelopmentHistory";
import PlayerActions from '@/components/manager/PlayerActions';
import { careerPlayerVisibility } from "@/lib/knowledge/careerVisibility";
import PlayerPerformance from '@/components/manager/PlayerPerformance';
import { PlayerHero } from '@/components/game/Identity';
import { PlayerConditionPanel } from '@/components/game/PlayerCondition';
import ContractRenewal from '@/components/ContractRenewal';
import { PlayerTransferCard } from '@/components/transfers/PlayerTransferCard';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { abilityStars, getClub, potentialStars } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { isFreeAgentClubId } from "@/lib/career/contractExpiry";
import { isRetiredClubId } from "@/lib/career/playerLifecycle";
import { emptyPlayerSeasonStats } from "@/lib/career/types";
import type { PlayerAvailability } from "@/lib/career/playerStatus";
import StarRating from "@/components/StarRating";
import StatValue from "@/components/StatValue";
import { GameplayAbilityPanel, GameplayAttributesPanel, type GameplayRatingRow } from "@/components/GameplayProfilePanels";
import { abilityStarsFromCA, potentialStarsFromPA, type IndividualDevelopmentFocus } from "@/lib/development/types";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import type { GameplayPlayerRating } from "@/lib/gameWorld/gameplayRatingSnapshot";
import { INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS, REHAB_PHASE_LABELS } from "@/lib/medical/labels";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/economy/labels";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { getPlayerClubHistory } from "@/lib/economy/clubHistoryIntegration";
import { getPlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { KnowledgeGatedAbilityPanel, KnowledgeGatedAttributesPanel } from "@/components/KnowledgeGatedProfilePanels";
import { buildScoutReportView } from "@/lib/knowledge/scoutReportVisibility";
import { getClubScouts, getPlayerScoutReports } from "@/lib/career/scouting";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import { PlayerDynamicsPanel } from "@/components/players/PlayerDynamicsPanel";
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

export default function PlayerProfilePage() {
  useMoney(); // re-render every figure when the display currency changes
  const router = useRouter();
  const params = useParams<{ playerId: string }>();
  const { career } = useCareer();
  const player = getCareerPlayer(career, params.playerId);

  // HM-UX-RATINGS-0.1: real-world players show HM-RATINGS-0.6's
  // canonical, COMPLETE gameplay rating snapshot -- never the older
  // sparse HM-RATINGS-0.3 evidence proposal (that view now lives only
  // in Editor -> Rating Review, where "what do we actually know?" is
  // the point). `undefined` = not yet fetched, `null` = fetched but
  // this player has no gameplay rating (an honest failure -- falls
  // back to the old mock display, same as any non-real-world player;
  // never fabricated client-side).
  const [tab, setTab] = useState('overview');
  const [ratingRow, setRatingRow] = useState<GameplayRatingRow | null | undefined>(undefined);

  useEffect(() => {
    if (!player) return;
    if (getCareerPlayerRating(career, player.id, player.clubId) || player.dataSource !== "REAL_WORLD") {
      // HM-RATINGS-CAREER-1.0 Part 25: a mock/generated player's rating
      // already lives in CareerState -- ensureCareerGameplayRatings
      // guarantees every roster player has one, so no fetch is needed.
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

  if (!player) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Spelaren hittades inte.</div>
      </div>
    );
  }

  const seasonStats = career.playerSeasonStats[player.id] ?? emptyPlayerSeasonStats(player.id);
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate);
  const isWonderkid = age !== null && age <= 19 && potentialStars(player) >= 5;
  const isFreeAgentPlayer = isFreeAgentClubId(player.clubId);
  const isRetiredPlayer = isRetiredClubId(player.clubId);
  const club = getClub(player.clubId);
  const hasRatingProfile = Boolean(ratingRow);
  // HM-DATA-ALLSVENSKAN-1.1B Part 12: TRUE WORLD STATE -> MANAGER
  // KNOWLEDGE -> PLAYER-FACING VIEW. The manager's own club stays exactly
  // as before (full stars, full 56/21-attribute grid) -- only an EXTERNAL
  // player's rating passes through the knowledge-gated resolver, which
  // never exposes raw CA/PA or the raw 1-20 attribute grid at any tier.
  const isOwnPlayer = player.clubId === career.playerClubId;
  const knowledgePct = isOwnPlayer ? 100 : getPlayerKnowledgePct(career, player.id, player.clubId);
  const knowledgeView = !isOwnPlayer && ratingRow ? careerPlayerVisibility(career, ratingRow, player.id, knowledgePct) : null;
  const contract = getPlayerContract(career, player.id);
  const contractStatus = getPlayerContractStatus(career, player.id);
  const marketValue = getPlayerMarketValueEur(career, player.id);
  const clubHistory = getPlayerClubHistory(career, player.id);
  const trainingCompensation = getPlayerTrainingCompensation(career, player.id);

  // HM-SCOUTING-1.0: the scout report view IS the "better manager view"
  // the whole scouting loop exists to produce -- composed here from the
  // exact same knowledgePct/ratingRow already resolved above, plus this
  // player's own filed report history (most recent scout's suitability
  // drives displayed confidence).
  const playerScoutReports = !isOwnPlayer ? getPlayerScoutReports(career, player.id) : [];
  const latestReport = playerScoutReports[0] ?? null;
  const clubScouts = getClubScouts(career);
  const scoutReportView = !isOwnPlayer && ratingRow ? buildScoutReportView(ratingRow, knowledgePct, marketValue, latestReport?.scoutSuitability ?? null) : null;
  const scoutReportHistory: ScoutReportHistoryEntry[] = playerScoutReports.map((r) => ({
    reportId: r.id,
    createdDate: r.createdDate,
    scoutDisplayName: findStaffMember(career, r.scoutStaffId)?.displayName ?? "Okänd scout",
  }));

  const attributesContent = <>        {/* Attributes -- HM-RATINGS-0.6 complete gameplay profile where it exists, otherwise the explicitly-marked mock set. External players NEVER see the raw attribute grid, at any knowledge level (Part 12). */}
        {ratingRow === undefined ? (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Läser in spelarbetyg…</div>
          </div>
        ) : !isOwnPlayer ? (
          knowledgeView ? <KnowledgeGatedAttributesPanel view={knowledgeView} /> : null
        ) : hasRatingProfile ? (
          <GameplayAttributesPanel row={ratingRow!} />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Egenskaper</span>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Tränarstabens bedömning</span>
            </div>
            <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
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
  const abilityContent = <>        {/* Ability / potential -- HM-RATINGS-0.6 gameplay CA/PA where it exists, otherwise the old star display. External players go through the knowledge-gated resolver (Part 12) -- raw CA/PA never shown, not even at 100% knowledge. */}
        {ratingRow === undefined && player.dataSource === "REAL_WORLD" ? (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Läser in spelarbetyg…</div>
          </div>
        ) : !isOwnPlayer ? (
          knowledgeView ? <KnowledgeGatedAbilityPanel view={knowledgeView} /> : null
        ) : hasRatingProfile ? (
          <GameplayAbilityPanel row={ratingRow!} />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Förmåga</span>
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>Nuvarande nivå</span>
                <StarRating stars={abilityStars(player)} title="Tränarstabens bedömning av nuvarande nivå" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>Potential</span>
                <StarRating stars={potentialStars(player)} title="Scoutingens uppskattning — osäker" />
              </div>
              <div className="hm-divider" />
              <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0, lineHeight: 1.5 }}>
                {isWonderkid
                  ? "En av klubbens mest lovande unga spelare. Scoutingavdelningen ser stor utvecklingspotential, men bedömningen är fortfarande osäker så här tidigt."
                  : "Tränarstabens löpande bedömning baserat på matcher och träning."}
              </p>
            </div>
          </div>
        )}

</>;
  const contractContent = <>        {/* HM-CONTRACTS-1.0 Part: dynamic, persistent contract -- reads
            career.playerContracts, never the static PlayerMock fields. */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kontrakt</span>
            {contractStatus ? <span className={`hm-badge hm-badge-${CONTRACT_STATUS_TONE[contractStatus]}`}>{CONTRACT_STATUS_LABEL[contractStatus]}</span> : null}
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* HM-ALPHA2-05C/E: the contract belongs to its owning club, which may differ from the club he plays for during a loan. */}
            <ContractRow label="Avtalsklubb" value={(contract?.clubId ? getClub(contract.clubId)?.name : club?.name) ?? "Okänd"} />
            <ContractRow label="Lön / månad" value={contract ? formatMoney(contract.wageEurPerMonth) : "—"} />
            <ContractRow label="Kontrakt t.o.m." value={contract ? contract.contractEndDate : "—"} />
            <ContractRow label="Tröjnummer" value={player.shirtNumber !== null ? String(player.shirtNumber) : "Okänt"} />
            {contract?.clubId === career.playerClubId && <ContractRenewal key={player.id} playerId={player.id} />}
          </div>
        </div>

        {/* HM-ALPHA2-05E: ownership vs playing club, loan, promise, interest and the way into the Negotiation Room. */}
        <PlayerTransferCard playerId={player.id} />

        {/* Market value -- HM-SCOUTING-1.0 Part 8/9: an external player's
            true canonical value is never shown exactly, only a knowledge-
            gated range (via scoutReportView.marketValueRange), same
            consistency rule the ScoutReportPanel below already applies.
            The manager's own players (always fully known) keep the exact
            figure. */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Marknadsvärde</span>
          </div>
          <div className="hm-panel-body">
            {isOwnPlayer ? (
              <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{marketValue !== undefined ? formatMoney(marketValue) : "—"}</div>
            ) : scoutReportView?.marketValueRange ? (
              <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>
                {scoutReportView.marketValueRange.min === scoutReportView.marketValueRange.max
                  ? formatMoney(scoutReportView.marketValueRange.min)
                  : `${formatMoney(scoutReportView.marketValueRange.min)} – ${formatMoney(scoutReportView.marketValueRange.max)}`}
              </div>
            ) : (
              <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>—</div>
            )}
            <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: "4px 0 0" }}>
              {isOwnPlayer
                ? "Uppskattat värde -- baserat på nuvarande förmåga, potential, ålder, roll och kontraktstid."
                : "Uppskattat intervall -- osäkerheten minskar med bättre kännedom om spelaren."}
            </p>
          </div>
        </div>

</>;
  const historyContent = <>        {/* HM-CONTRACTS-1.0A Part: club/youth history + training
            compensation -- deliberately SEPARATE from market value/
            contract above (never blended into either number). */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Klubbhistorik</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {clubHistory && clubHistory.entries.length > 0 ? (
              clubHistory.entries.map((entry, i) => (
                <ContractRow key={i} label={getClub(entry.clubId)?.name ?? entry.clubId} value={`${entry.fromAge}–${entry.toAge} år`} />
              ))
            ) : (
              <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                Ingen tidigare klubb registrerad.
              </p>
            )}
            <div className="hm-divider" />
            <div className="hm-eyebrow">Utbildningsersättning</div>
            {trainingCompensation && trainingCompensation.totalEur > 0 ? (
              <>
                <ContractRow label="Vid framtida övergång" value={formatMoney(trainingCompensation.totalEur)} />
                {trainingCompensation.perClub.map((share) => (
                  <div key={share.clubId} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
                    <span className="hm-text-muted">
                      {getClub(share.clubId)?.name ?? share.clubId} ({share.years} år)
                    </span>
                    <span style={{ fontWeight: 600 }}>{formatMoney(share.amountEur)}</span>
                  </div>
                ))}
                <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                  Separat från marknadsvärde och övergångssumma. Uppskattat belopp.
                </p>
              </>
            ) : (
              <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                Ingen utbildningsersättning (spelaren är över åldersgränsen eller saknar tidigare utbildningsklubb).
              </p>
            )}
          </div>
        </div>

</>;
  const bodyContent = <>        {/* Body profile */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kroppsprofil</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Längd" value={player.heightCm !== null ? `${player.heightCm} cm` : "Okänd"} />
            <ContractRow label="Vikt" value={player.weightKg !== null ? `${player.weightKg} kg` : "Okänd"} />
            <ContractRow label="Hand" value={player.foot ?? "Okänd"} />
            <ContractRow label="Ålder" value={age !== null ? `${age} år` : "Okänd"} />
            <ContractRow label="Född" value={player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString("sv-SE") : player.birthYear ? String(player.birthYear) : "Okänt"} />
          </div>
        </div>

</>;
  const reportContent = !isOwnPlayer && scoutReportView ? (
    <ScoutReportPanel view={scoutReportView} history={scoutReportHistory} hasOwnScout={clubScouts.length > 0} onStartAssignment={() => router.push(`/career/scouting?target=${player.id}`)} />
  ) : null;
  const tabs = [["overview", "Profil & egenskaper"], ["performance", "Prestation & historik"], ["attributes", "Egenskaper"], ["development", "Utveckling"], ["contract", "Kontrakt"], ["history", "Klubbhistorik"]];

  return (
    <div className="hm-profile-page">
      <PlayerHero player={player} career={career}>
        <button type="button" className="hm-btn hm-btn-sm" onClick={() =>
          isOwnPlayer ? router.push("/career/squad") : isFreeAgentPlayer ? router.push("/career/transfers") : isRetiredPlayer ? router.push("/career/squad") : router.push(`/career/clubs/${player.clubId}`)
        }>← {isOwnPlayer ? "Trupp" : isFreeAgentPlayer ? "Transfers" : isRetiredPlayer ? "Trupp" : "Klubb"}</button>
      </PlayerHero>
      <PlayerActions player={player} />
      {isOwnPlayer && <PlayerConditionPanel career={career} player={player} />}
      <nav className="hm-tabs hm-profile-tabs" aria-label="Spelarprofil">
        {tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <div className="hm-profile-body" key={tab}>
        {tab === "overview" && <div className="hm-profile-split">
          <div className="hm-profile-main">
            <section className="hm-profile-stats" aria-label="Säsongen i siffror">
              <div><small>Matcher från start</small><strong>{seasonStats.starts}</strong></div>
              <div><small>{player.position === "MV" ? "Mötta skott" : "Skott"}</small><strong>{player.position === "MV" ? seasonStats.shotsFaced : seasonStats.shots}</strong></div>
              <div><small>{player.position === "MV" ? "Räddningsprocent" : "Skotteffektivitet"}</small><strong>{player.position === "MV" ? seasonStats.shotsFaced > 0 ? `${Math.round(seasonStats.saves / seasonStats.shotsFaced * 100)}%` : "—" : seasonStats.shots > 0 ? `${Math.round(seasonStats.goals / seasonStats.shots * 100)}%` : "—"}</strong></div>
              <div><small>{player.position === "MV" ? "Räddningar / mötta" : "Mål / skott"}</small><strong>{player.position === "MV" ? `${seasonStats.saves}/${seasonStats.shotsFaced}` : `${seasonStats.goals}/${seasonStats.shots}`}</strong></div>
            </section>
            {/* HM-ALPHA3-M05: morale, talks, promises, requests, bids, transfer list and release. */}
            {isOwnPlayer && <PlayerDynamicsPanel playerId={player.id} />}
            {attributesContent}
          </div>
          <aside className="hm-world-rail" aria-label="Spelarbedömning och tillgänglighet">
            {abilityContent}
            {reportContent}
            <MedicalPanel playerId={player.id} />
            <section className="hm-world-note">
              <h2>Din nästa bedömning</h2>
              <p>{isOwnPlayer ? "Matchprestation, tillgänglighet och utveckling formar spelarens roll i din trupp." : "Fördjupa bedömningen genom scouting och jämför spelaren med din egen trupp innan du tar nästa steg."}</p>
              <div className="hm-actions"><button className="hm-btn hm-btn-sm" onClick={() => setTab("contract")}>Visa kontrakt</button><button className="hm-btn hm-btn-sm" onClick={() => setTab("performance")}>Visa prestation</button></div>
            </section>
          </aside>
        </div>}
        {tab === "performance" && <PlayerPerformance playerId={player.id} />}
        {tab === "attributes" && <div className="hm-profile-split"><div className="hm-profile-main">{attributesContent}</div><aside className="hm-world-rail">{abilityContent}{bodyContent}{reportContent}</aside></div>}
        {tab === "development" && <div className="hm-profile-split"><div className="hm-profile-main">{isOwnPlayer ? <DevelopmentPanel playerId={player.id} /> : <section className="hm-world-note"><h2>Utvecklingsbedömning</h2><p>Du följer spelarens utveckling genom scouting och registrerade prestationer. Individuell träning hanteras av spelarens klubb.</p></section>}{bodyContent}</div><aside className="hm-world-rail">{abilityContent}<MedicalPanel playerId={player.id} /></aside></div>}
        {tab === "contract" && <div className="hm-profile-split"><div className="hm-profile-main">{contractContent}</div><aside className="hm-world-rail">{historyContent}</aside></div>}
        {tab === "history" && <div className="hm-profile-split"><div className="hm-profile-main">{historyContent}<PlayerPerformance playerId={player.id} /></div><aside className="hm-world-rail">{bodyContent}</aside></div>}
      </div>
    </div>
  );
}

function DevelopmentPanel({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const dev = career.playerDevelopmentState[playerId];
  const rating = career.gameplayRatings[career.playerClubId]?.find((r) => r.playerId === playerId);
  const assignment = career.playerTrainingAssignments[playerId];
  const focus = (assignment?.individualFocus as IndividualDevelopmentFocus | undefined) ?? "NORMAL";
  const focusLabel: Record<IndividualDevelopmentFocus, string> = {
    NORMAL: "Normal",
    TECHNICAL: "Teknik",
    ATTACKING_DECISIONS: "Anfallsspel",
    DEFENCE: "Försvarsspel",
    PHYSICAL: "Fysik",
    MENTAL: "Mentalt",
    GOALKEEPER: "Målvaktsspel",
  };
  const recentEvents = dev?.developmentHistory.slice(0, 5) ?? [];

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Utveckling</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ContractRow label="Nuvarande nivå" value={rating ? "★".repeat(abilityStarsFromCA(rating.ca)) + "☆".repeat(5 - abilityStarsFromCA(rating.ca)) : "—"} />
        <ContractRow label="Potential" value={rating ? "★".repeat(potentialStarsFromPA(rating.pa)) + "☆".repeat(5 - potentialStarsFromPA(rating.pa)) : "—"} />
        <ContractRow label="Individuellt fokus" value={focusLabel[focus]} />
        <div className="hm-divider" />
        {recentEvents.length === 0 ? (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Ingen synlig förbättring registrerad ännu.
          </p>
        ) : (
          <DevelopmentHistory events={recentEvents} />
        )}
      </div>
    </div>
  );
}

function MedicalPanel({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const injuryState = career.playerInjuries[playerId];
  const activeInjury = injuryState?.activeInjury ?? null;
  const availability = career.playerStatuses[playerId]?.availability;
  const availabilityLabels: Record<PlayerAvailability, string> = { AVAILABLE:'Tillgänglig', INJURED:'Skadad', SUSPENDED:'Avstängd', RECOVERING:'Under återhämtning', LIMITED:'Begränsad återgång', ON_PLACEMENT:'Hos partnerklubb', NATIONAL_TEAM:'Med landslaget' };
  const statusLabel = availability ? availabilityLabels[availability] : 'Ingen uppgift';
  const recentHistory = (injuryState?.injuryHistory ?? []).slice(-5).reverse();

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Medicinskt</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ContractRow label="Tillgänglighet" value={statusLabel} />
        {activeInjury ? (
          <>
            <ContractRow label="Skada" value={INJURY_TYPE_LABELS[activeInjury.injuryType]} />
            <ContractRow label="Allvarlighetsgrad" value={INJURY_SEVERITY_LABELS[activeInjury.severity]} />
            <ContractRow label="Rehabfas" value={REHAB_PHASE_LABELS[activeInjury.currentPhase]} />
            <ContractRow label="Beräknad återkomst" value={activeInjury.expectedReturnDate} />
            <ContractRow label="Rehabframsteg" value={`${Math.round(activeInjury.rehabProgress * 100)}%`} />
          </>
        ) : (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Ingen aktiv skada.
          </p>
        )}
        <div className="hm-divider" />
        <div className="hm-eyebrow">Skadehistorik</div>
        {recentHistory.length === 0 ? (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Ingen tidigare skada registrerad.
          </p>
        ) : (
          recentHistory.map((entry) => (
            <div key={entry.injuryId} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
              <span className="hm-text-muted">
                {INJURY_TYPE_LABELS[entry.injuryType]} ({entry.occurredDate})
              </span>
              <span style={{ fontWeight: 600 }}>{INJURY_SEVERITY_LABELS[entry.severity]}</span>
            </div>
          ))
        )}
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

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
