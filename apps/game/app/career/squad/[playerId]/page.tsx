"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { abilityStars, getClub, playerAge, positionLabel, potentialStars } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { averageRating, emptyPlayerSeasonStats } from "@/lib/career/types";
import { resolveStatusLabel } from "@/lib/career/playerStatus";
import StarRating from "@/components/StarRating";
import StatValue from "@/components/StatValue";
import { ClubLink } from "@/components/entityLinks";
import { GameplayAbilityPanel, GameplayAttributesPanel, type GameplayRatingRow } from "@/components/GameplayProfilePanels";
import { potentialStarsFromPA, type IndividualDevelopmentFocus } from "@/lib/development/types";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import type { GameplayPlayerRating } from "@/lib/gameWorld/gameplayRatingSnapshot";
import { INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS, REHAB_PHASE_LABELS } from "@/lib/medical/labels";

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
  const [ratingRow, setRatingRow] = useState<GameplayRatingRow | null | undefined>(undefined);

  useEffect(() => {
    if (!player) return;
    if (player.dataSource !== "REAL_WORLD") {
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
  const age = playerAge(player.dateOfBirth, player.birthYear);
  const isWonderkid = age !== null && age <= 19 && potentialStars(player) >= 5;
  const club = getClub(player.clubId);
  const hasRatingProfile = Boolean(ratingRow);

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
      <div className="hm-grid" style={{ gap: 12 }}>
        {/* Header */}
        <div className="hm-panel">
          <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--hm-surface-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 800,
                color: "var(--hm-text-muted)",
                flexShrink: 0,
              }}
            >
              {player.firstName[0]}
              {player.lastName[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="hm-shirt-number">{player.shirtNumber ?? "–"}</span>
                <span style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>
                  {player.firstName} {player.lastName}
                </span>
                {isWonderkid ? <span className="hm-badge hm-badge-warning">TALANG</span> : null}
                {player.dataSource === "REAL_WORLD" ? (
                  <span className="hm-badge hm-badge-neutral" title="Importerad från verklig spelardata">
                    REAL DATA
                  </span>
                ) : null}
              </div>
              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)", marginTop: 2 }}>
                {positionLabel(player.position)}
                {player.secondaryPosition ? ` / ${positionLabel(player.secondaryPosition)}` : ""} · {age ?? "–"} år · {player.nationality} · {player.foot ?? "Okänd"}
                {club ? (
                  <>
                    {" · "}
                    <ClubLink clubId={club.id}>{club.name}</ClubLink>
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="hm-btn"
              onClick={() => (player.clubId === career.playerClubId ? router.push("/career/squad") : router.push(`/career/clubs/${player.clubId}`))}
            >
              ← {player.clubId === career.playerClubId ? "Trupp" : "Klubb"}
            </button>
          </div>
        </div>

        {/* Overview */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Översikt</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
            <MetricBlock label="Matcher" value={seasonStats.appearances} />
            <MetricBlock label="Mål" value={seasonStats.goals} />
            <MetricBlock label="Snittbetyg" value={seasonStats.appearances > 0 ? averageRating(seasonStats).toFixed(1) : "—"} />
            {player.position === "MV" ? (
              <MetricBlock label="Räddningar" value={`${seasonStats.saves}/${seasonStats.shotsFaced}`} />
            ) : (
              <MetricBlock label="Skott" value={seasonStats.shots} />
            )}
            <MetricBlock label="Fitness" value={`${player.fitnessPct}%`} />
            <MetricBlock label="Status" value={resolveStatusLabel(career.playerStatuses, player)} />
          </div>
        </div>

        {/* Attributes -- HM-RATINGS-0.6 complete gameplay profile where it exists, otherwise the explicitly-marked mock set */}
        {ratingRow === undefined ? (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Läser in spelarbetyg…</div>
          </div>
        ) : hasRatingProfile ? (
          <GameplayAttributesPanel row={ratingRow!} />
        ) : (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Egenskaper</span>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Mockat attributset — ej slutgiltig modell</span>
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
      </div>

      <div className="hm-grid" style={{ gap: 12 }}>
        {/* Ability / potential -- HM-RATINGS-0.6 gameplay CA/PA where it exists, otherwise the old star display */}
        {ratingRow === undefined && player.dataSource === "REAL_WORLD" ? (
          <div className="hm-panel">
            <div className="hm-panel-body hm-text-muted">Läser in spelarbetyg…</div>
          </div>
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

        {/* Contract */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kontrakt</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Kontrakt t.o.m." value={player.contractEndSeason} />
            <ContractRow label="Lön / månad" value={`${player.wageSekPerMonth.toLocaleString("sv-SE")} kr`} />
            <ContractRow label="Tröjnummer" value={player.shirtNumber !== null ? String(player.shirtNumber) : "Okänt"} />
          </div>
        </div>

        {/* Body profile */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kroppsprofil</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Längd" value={player.heightCm !== null ? `${player.heightCm} cm` : "Okänd"} />
            <ContractRow label="Vikt" value={player.weightKg !== null ? `${player.weightKg} kg` : "Okänd"} />
            <ContractRow label="Ålder" value={age !== null ? `${age} år` : "Okänd"} />
            <ContractRow label="Född" value={player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString("sv-SE") : player.birthYear ? String(player.birthYear) : "Okänt"} />
          </div>
        </div>

        {/* HM-TRAINING-1.1 Part 28: a small, real development section --
            recent attribute changes, individual focus, recent training
            participation. Never a giant redesign. */}
        <DevelopmentPanel playerId={player.id} />

        {/* HM-INJURIES-1.0 Part 31: a compact injury/medical section --
            current status, active injury, expected return, rehab phase,
            recent history. No full medical center here. */}
        <MedicalPanel playerId={player.id} />
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
        <ContractRow label="CA" value={rating ? String(Math.round(rating.ca)) : "—"} />
        <ContractRow label="Potential" value={rating ? "★".repeat(potentialStarsFromPA(rating.pa)) + "☆".repeat(5 - potentialStarsFromPA(rating.pa)) : "—"} />
        <ContractRow label="Individuellt fokus" value={focusLabel[focus]} />
        <div className="hm-divider" />
        {recentEvents.length === 0 ? (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Ingen synlig förbättring registrerad ännu.
          </p>
        ) : (
          recentEvents.map((ev, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
              <span className="hm-text-muted">
                {ev.attribute} ({ev.date})
              </span>
              <span style={{ fontWeight: 600 }}>
                {ev.previousValue} → {ev.newValue}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MedicalPanel({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const player = getCareerPlayer(career, playerId);
  const injuryState = career.playerInjuries[playerId];
  const activeInjury = injuryState?.activeInjury ?? null;
  const statusLabel = player ? resolveStatusLabel(career.playerStatuses, player) : "—";
  const recentHistory = (injuryState?.injuryHistory ?? []).slice(-5).reverse();

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Medicinskt</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ContractRow label="Status" value={statusLabel} />
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

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{value}</div>
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
