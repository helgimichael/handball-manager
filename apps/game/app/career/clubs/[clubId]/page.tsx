"use client";
import ClubContext from "@/components/manager/ClubContext";
import { ClubHero, PlayerCell } from "@/components/game/Identity";

// HM-UX-0.3: universal club profile for any club that ISN'T the
// manager's own (ClubLink routes the manager's own club to the
// existing /career/club workflow instead -- this page redirects there
// too, if reached directly). Shows only data this career already has
// real access to: identity/name/competition (game-data's Club record),
// squad (getCareerClubSquad -- real roster where imported, otherwise
// an honest "no roster data" message, never a fabricated squad),
// staff (the same non-editor-gated staff-snapshot endpoint Staff's own
// page already uses), fixtures/results already in career state, and
// this club's live table position. No new data-loading work, no
// speculative content.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getClub, positionLabel } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad } from "@/lib/career/careerWorld";
import { getLiveStandings } from "@/lib/career/standings";
import type { ClubIdentityProfile, CoachIdentityProfile, IdentityClaim } from "@/lib/identity";
import { presentClaim } from "@/lib/identity/presentation";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { ClubLink } from "@/components/entityLinks";
import { getClubKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolveClubVisibility } from "@/lib/knowledge/clubVisibility";
import { KNOWLEDGE_TIER_LABEL_SV } from "@/lib/knowledge/types";
import { getClubPartnerships, getPermanentBTeamParentClubId } from "@/lib/career/clubPartnerships";
import { svOrdinal } from "@/lib/format/ordinal";

const CLUB_IDENTITY_DOMAIN_LABELS: Record<keyof Omit<ClubIdentityProfile, "clubId" | "seasonReference">, string> = {
  structuralIdentity: "Struktur & styrning",
  cultureIdentity: "Kultur",
  tacticalHeritage: "Taktiskt arv",
  developmentIdentity: "Utveckling",
  recruitmentIdentity: "Rekrytering",
  financialStrategicIdentity: "Ekonomisk inriktning",
  supporterEnvironmentIdentity: "Supportermiljö",
};

const COACH_CLAIM_LABELS: Record<keyof Omit<CoachIdentityProfile, "personId">, string> = {
  coachingStyleClaims: "Tränarstil",
  tacticalPreferenceClaims: "Taktiska preferenser",
  communicationLeadershipClaims: "Kommunikation & ledarskap",
  developmentClaims: "Spelarutveckling",
  adaptabilityClaims: "Anpassningsförmåga",
  cultureBuildingClaims: "Kulturbygge",
};

// HM-DATA-ALLSVENSKAN-1.2: every claim is rendered through the
// presentation layer (lib/identity/presentation.ts) -- never the raw
// machine key/enum value. The canonical claim (key, value, evidenceClass,
// sourceRefs, ...) is untouched; this is a read-only, additive
// translation for normal game mode. Evidence-class provenance is
// intentionally not shown here (not required in normal game mode --
// only Editor Mode/debug surfaces need it).
function ClaimRow({ claim }: { claim: IdentityClaim }) {
  return (
    <div className="hm-text-xs" style={{ padding: "4px 0", borderBottom: "1px solid var(--hm-border-subtle, #2a2d34)" }}>
      {presentClaim(claim)}
    </div>
  );
}

export default function ClubProfilePage() {
  const router = useRouter();
  const params = useParams<{ clubId: string }>();
  const { career } = useCareer();
  const club = getClub(params.clubId);
  const [identity, setIdentity] = useState<{ clubIdentity: ClubIdentityProfile | null; coachIdentity: (CoachIdentityProfile & { personId: string }) | null } | null>(null);

  const isOwnClub = params.clubId === career.playerClubId;

  useEffect(() => {
    if (isOwnClub) {
      router.replace("/career/club");
    }
  }, [isOwnClub, router]);

  useEffect(() => {
    if (!club || isOwnClub) return;
    let cancelled = false;
    fetch(`/api/game-world/club-identity-snapshot?clubId=${encodeURIComponent(club.id)}&asOfDate=${encodeURIComponent(career.gameDate)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setIdentity({ clubIdentity: data.clubIdentity ?? null, coachIdentity: data.coachIdentity ?? null });
      })
      .catch(() => {
        if (!cancelled) setIdentity({ clubIdentity: null, coachIdentity: null });
      });
    return () => {
      cancelled = true;
    };
  }, [club, isOwnClub, career.gameDate]);

  if (!club) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Klubben hittades inte.</div>
      </div>
    );
  }
  if (isOwnClub) {
    return null; // redirecting
  }

  const squad = getCareerClubSquad(career, club.id);
  const table = career.competitionId === club.competitionId ? getLiveStandings(career) : [];
  const tableRow = table.find((r) => r.clubId === club.id);
  const tablePosition = tableRow ? table.indexOf(tableRow) + 1 : null;

  const fixtures = career.fixtures.filter((f) => f.homeClubId === club.id || f.awayClubId === club.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  // HM-STAFF-CAREER-1.0: reads the same career-persistent, whole-
  // competition staffRoster the manager's own Staff page reads --
  // resolved once at career creation for every club (staffCareerIntegration.ts),
  // so this is real, career-tracked staff (moves on a completed
  // recruitment), not a fresh per-visit fetch. A club whose staff hasn't
  // been loaded yet (an old save mid-top-up) simply shows an empty list
  // until CareerContext's own async top-up completes.
  const staffRoster = career.staffRoster[club.id] ?? [];

  // HM-DATA-ALLSVENSKAN-1.1B Part 13: TRUE WORLD STATE -> MANAGER
  // KNOWLEDGE -> PLAYER-FACING VIEW, for the club/coach identity claims
  // specifically. Public facts above (name, city, table, squad names,
  // staff roster, fixtures/results) stay UNGATED, exactly as before --
  // only the deeper qualitative claims below (tactical heritage, coach
  // philosophy, internal strengths/weaknesses, financial-strategic
  // identity, ...) pass through resolveClubVisibility.
  const clubKnowledgePct = getClubKnowledgePct(career, club.id);
  const visibility = identity ? resolveClubVisibility(identity.clubIdentity, identity.coachIdentity, clubKnowledgePct) : null;

  // HM-CLUB-PARTNERSHIPS-1.0: a permanent B-team club or a club
  // exclusively bound to a DEVELOPMENT_PARTNERSHIP is visibly flagged
  // here -- the same relation data other managers would see reflected
  // in their own inability to select this club as a partner.
  const permanentParentClubId = getPermanentBTeamParentClubId(club.id);
  const activeDevelopmentPartner = getClubPartnerships(career, club.id).find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");

  return (
    <div className="hm-world-page">
      <ClubHero clubId={club.id} career={career}>
        <button type="button" className="hm-btn hm-btn-sm" onClick={() => router.back()}>Tillbaka</button>
      </ClubHero>
      <section className="hm-world-facts" aria-label="Klubbens säsong">
        <div><small>Tabellplacering</small><strong>{tablePosition ? `${svOrdinal(tablePosition)}` : "—"}</strong></div>
        <div><small>Poäng</small><strong>{tableRow?.points ?? "—"}</strong></div>
        <div><small>Trupp</small><strong>{squad.length}</strong></div>
        <div><small>Personal</small><strong>{staffRoster.length}</strong></div>
      </section>
      {permanentParentClubId ? <div className="hm-world-note">Permanent B-lag till {getClub(permanentParentClubId)?.name ?? permanentParentClubId} -- kan inte väljas som samarbetsklubb.</div> : activeDevelopmentPartner ? <div className="hm-world-note">Exklusivt samarbete med {getClub(activeDevelopmentPartner.clubAId)?.name ?? activeDevelopmentPartner.clubAId} -- inte tillgänglig för andra klubbar.</div> : null}
      <div className="hm-world-split">
        <div className="hm-world-main">
          <ClubContext clubId={club.id} />
                <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Trupp</span>
        </div>
        {squad.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Ingen truppdata tillgänglig för denna klubb ännu.</div>
        ) : (
          <div className="hm-scroll-x">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Nr</th>
                  <th>Spelare</th>
                  <th>Pos</th>
                  <th>Ålder</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="hm-shirt-number">{p.shirtNumber ?? "–"}</span>
                    </td>
                    <td className="hm-td-strong">
                      <PlayerCell player={p} />
                    </td>
                    <td title={positionLabel(p.position)}>{p.position}</td>
                    <td>{playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate) ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


                <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matcher</span>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{fixtures.length} matcher</span>
        </div>
        {fixtures.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Inga matcher registrerade för denna klubb ännu.</div>
        ) : (
          <div className="hm-scroll-x">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Omg</th>
                  <th>Datum</th>
                  <th>Hemma / Borta</th>
                  <th>Motstånd</th>
                  <th>Resultat</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((f) => {
                  const home = f.homeClubId === club.id;
                  const opponentId = home ? f.awayClubId : f.homeClubId;
                  const opponent = getClub(opponentId);
                  const result = career.results[f.id];
                  const gf = result ? (home ? result.homeGoals : result.awayGoals) : undefined;
                  const ga = result ? (home ? result.awayGoals : result.homeGoals) : undefined;
                  return (
                    <tr key={f.id}>
                      <td>{f.round}</td>
                      <td>{new Date(f.date).toLocaleDateString("sv-SE", { day: "2-digit", month: "2-digit" })}</td>
                      <td>{home ? "Hemma" : "Borta"}</td>
                      <td className="hm-td-strong">{opponent ? <ClubLink clubId={opponent.id}>{opponent.name}</ClubLink> : opponentId}</td>
                      <td>{result ? <Link className="hm-result-link" href={`/career/match-report/${f.id}`}>{gf}–{ga}</Link> : <Link href={`/career/fixtures/${f.id}`}>Förhandsvisa →</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

        </div>
        <aside className="hm-world-rail" aria-label="Organisation och klubbkännedom">
                <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Personal</span>
        </div>
        {staffRoster.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Ingen personaldata tillgänglig för denna klubb ännu.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Roll</th>
              </tr>
            </thead>
            <tbody>
              {staffRoster.map((m) => (
                <tr key={m.id}>
                  <td className="hm-td-strong">
                    <Link href={`/career/staff/${encodeURIComponent(m.id)}`}>{m.displayName}</Link>
                  </td>
                  <td>{m.roles.length > 0 ? m.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (m.officialRoleLabel ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


                <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Klubbidentitet</span>
          {visibility ? <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[visibility.tier]}</span> : null}
        </div>
        {identity === null ? (
          <div className="hm-panel-body hm-text-muted">Läser in…</div>
        ) : !identity.clubIdentity ? (
          <div className="hm-panel-body hm-text-muted">Ingen klubbidentitetsdata tillgänglig för denna klubb ännu.</div>
        ) : !visibility?.clubIdentity || Object.values(visibility.clubIdentity).every((claims) => Array.isArray(claims) && claims.length === 0) ? (
          <div className="hm-panel-body hm-text-muted">
            För lite kännedom om klubben för djupare insikter ännu. Scouting och möten mot klubben ökar kännedomen över tid.
          </div>
        ) : (
          <>
            <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {(Object.keys(CLUB_IDENTITY_DOMAIN_LABELS) as (keyof typeof CLUB_IDENTITY_DOMAIN_LABELS)[])
                .filter((field) => visibility.clubIdentity![field].length > 0)
                .map((field) => (
                  <div key={field}>
                    <div className="hm-eyebrow">{CLUB_IDENTITY_DOMAIN_LABELS[field]}</div>
                    {visibility.clubIdentity![field].map((claim) => (
                      <ClaimRow key={claim.id} claim={claim} />
                    ))}
                  </div>
                ))}
            </div>
            {visibility.hiddenClubClaimCount > 0 ? (
              <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingTop: 0 }}>
                {visibility.hiddenClubClaimCount} till, kräver bättre kännedom om klubben.
              </div>
            ) : null}
          </>
        )}
      </div>


                <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Tränarfilosofi</span>
          {visibility ? <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[visibility.tier]}</span> : null}
        </div>
        {identity === null ? (
          <div className="hm-panel-body hm-text-muted">Läser in…</div>
        ) : !identity.coachIdentity ? (
          <div className="hm-panel-body hm-text-muted">Ingen bedömd tränarfilosofi tillgänglig för nuvarande huvudtränare.</div>
        ) : !visibility?.coachIdentity || Object.values(visibility.coachIdentity).every((claims) => Array.isArray(claims) && claims.length === 0) ? (
          <div className="hm-panel-body hm-text-muted">
            För lite kännedom om tränaren för en bedömd filosofi ännu. Kräver minst måttlig kännedom om klubben.
          </div>
        ) : (
          <>
            <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {(Object.keys(COACH_CLAIM_LABELS) as (keyof typeof COACH_CLAIM_LABELS)[])
                .filter((field) => visibility.coachIdentity![field].length > 0)
                .map((field) => (
                  <div key={field}>
                    <div className="hm-eyebrow">{COACH_CLAIM_LABELS[field]}</div>
                    {visibility.coachIdentity![field].map((claim) => (
                      <ClaimRow key={claim.id} claim={claim} />
                    ))}
                  </div>
                ))}
            </div>
            {visibility.hiddenCoachClaimCount > 0 ? (
              <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingTop: 0 }}>
                {visibility.hiddenCoachClaimCount} till, kräver bättre kännedom om klubben.
              </div>
            ) : null}
          </>
        )}
      </div>


        </aside>
      </div>
    </div>
  );
}
