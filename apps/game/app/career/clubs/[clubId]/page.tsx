"use client";
// Arena Nights CLB-04 C "Peek-first Scout Card": most lookups end in the club Peek (crest, table, form, next game,
// head-to-head, knowledge); this full page is the opponent's portrait. Who they are (a headline sentence from the
// table and form) -> how they play (identity in words, coach philosophy as quotes; CLB-04a B) -> what you don't
// know yet (fogged lines that lead to "Scouta klubben"). Then their story (CLB-02a B), squad and fixtures.
//
// HM-UX-0.3 rules kept: the manager's own club redirects to /career/club; public facts (name, table, squad names,
// staff, fixtures/results) stay ungated; identity and coach claims pass through resolveClubVisibility
// (HM-DATA-ALLSVENSKAN-1.1B Part 13) and are rendered with presentClaim, never raw keys. No ratings are shown for a
// club the manager does not run.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ClubCrest from "@/components/ClubCrest";
import FormDots from "@/components/FormDots";
import { PlayerCell, clubColorVars } from "@/components/game/Identity";
import { ScoutAssignButton } from "@/components/manager/ScoutAssignButton";
import { ClubStory } from "@/components/club/ClubStory";
import { ClubLink } from "@/components/entityLinks";
import { ENVIRONMENTS } from "@/components/clubhq/environments";
import { COMPETITIONS, getClub, positionLabel } from "@/lib/game-data";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { useCareer } from "@/lib/career/CareerContext";
import { canAccessClubInternals } from "@/lib/manager/employment";
import { getCareerClubSquad } from "@/lib/career/careerWorld";
import { clubCompetitionId } from "@/lib/career/competitionMembership";
import type { ClubIdentityProfile, CoachIdentityProfile } from "@/lib/identity";
import { getClubKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolveClubVisibility } from "@/lib/knowledge/clubVisibility";
import { knowledgeTier, KNOWLEDGE_TIER_LABEL_SV } from "@/lib/knowledge/types";
import { getClubPartnerships, getPermanentBTeamParentClubId } from "@/lib/career/clubPartnerships";
import { fixtureHref, matchReportHref } from "@/lib/career/fixtureRoutes";
import { clubPortrait, type PortraitLine } from "@/lib/club/clubPortrait";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";

type Identity = { clubIdentity: ClubIdentityProfile | null; coachIdentity: (CoachIdentityProfile & { personId: string }) | null };

export default function ClubProfilePage() {
  const router = useRouter();
  const params = useParams<{ clubId: string }>();
  const { career } = useCareer();
  const club = getClub(params.clubId);
  const [identity, setIdentity] = useState<Identity | null>(null);
  // Employment states: only the club he runs opens as his own house; a former club shows its public portrait.
  const isOwnClub = canAccessClubInternals(career, params.clubId);

  useEffect(() => { if (isOwnClub) router.replace("/career/club"); }, [isOwnClub, router]);
  useEffect(() => {
    if (!club || isOwnClub) return;
    let cancelled = false;
    fetch(`/api/game-world/club-identity-snapshot?clubId=${encodeURIComponent(club.id)}&asOfDate=${encodeURIComponent(career.gameDate)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setIdentity({ clubIdentity: data.clubIdentity ?? null, coachIdentity: data.coachIdentity ?? null }); })
      .catch(() => { if (!cancelled) setIdentity({ clubIdentity: null, coachIdentity: null }); });
    return () => { cancelled = true; };
  }, [club, isOwnClub, career.gameDate]);

  const knowledgePct = club ? getClubKnowledgePct(career, club.id) : 0;
  const visibility = useMemo(() => (identity ? resolveClubVisibility(identity.clubIdentity, identity.coachIdentity, knowledgePct) : null), [identity, knowledgePct]);
  const portrait = useMemo(() => (club && !isOwnClub ? clubPortrait(career, club.id, visibility, { club: !!identity?.clubIdentity, coach: !!identity?.coachIdentity }) : null), [career, club, isOwnClub, visibility, identity]);

  if (!club) return <div className="hm-panel"><div className="hm-panel-body hm-text-muted">Klubben hittades inte. <Link href="/career/competitions">Till tävlingarna →</Link></div></div>;
  if (isOwnClub || !portrait) return null; // redirecting

  const squad = getCareerClubSquad(career, club.id);
  const competitionId = clubCompetitionId(career, club.id) ?? club.competitionId;
  const competition = COMPETITIONS.find((c) => c.id === competitionId);
  const upcoming = career.fixtures.filter((f) => (f.homeClubId === club.id || f.awayClubId === club.id) && !career.results[f.id]).sort((a, b) => a.date.localeCompare(b.date));
  const staffRoster = career.staffRoster[club.id] ?? [];
  const tier = knowledgeTier(knowledgePct);
  const permanentParentClubId = getPermanentBTeamParentClubId(club.id);
  const activeDevelopmentPartner = getClubPartnerships(career, club.id).find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");
  const h = portrait.h2h;
  const loading = identity === null;

  return (
    <div className="cp-page" style={clubColorVars(club)}>
      <nav className="cp-back" aria-label="Tillbaka"><Link href={competitionId ? `/career/competitions/${encodeURIComponent(competitionId)}` : "/career/competitions"}>← {competition?.name ?? "Tävlingarna"}</Link></nav>
      <div className="cp-top">
        <header className="cp-portrait xp-photo-hero" style={ENVIRONMENTS["arena-club"].backdropStyle}>
          <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={96} />
          <div className="cp-portrait-copy">
            <small>{[club.city, competition?.name, club.founded ? `Grundad ${club.founded}` : null].filter(Boolean).join(" · ")}</small>
            <h1>{club.name}</h1>
            <p className="cp-headline">{portrait.headline}</p>
            {portrait.standfirst ? <p className="cp-standfirst">{portrait.standfirst}</p> : !loading && <p className="cp-standfirst cp-fog">Hur de spelar vet du inte än.</p>}
            <div className="cp-form"><span>Senaste fem</span><FormDots results={(career.clubForm[club.id] ?? []).slice(-5)} /></div>
          </div>
        </header>
        <aside className="cp-scout" aria-label="Snabbfakta och kännedom">
          <div className="cp-h2h">
            <small>Inbördes mot er</small>
            <strong>{h.played ? `${h.won}–${h.drawn}–${h.lost}` : "Inga möten"}</strong>
            <span>{h.played ? `${h.goalsFor}–${h.goalsAgainst} i mål på ${h.played} ${h.played === 1 ? "match" : "matcher"}` : "Ni har inte mötts i din tid."}</span>
            {h.recent.length > 0 && <ol aria-label="Senaste mötena">{h.recent.map((m) => <li key={m.fixtureId} data-outcome={m.outcome}><Link href={matchReportHref(m.fixtureId)}>{m.goalsFor}–{m.goalsAgainst}</Link></li>)}</ol>}
            {h.next && <Link href={fixtureHref(h.next.fixtureId)}>Nästa möte {h.next.date}, {h.next.home ? "hemma" : "borta"} →</Link>}
          </div>
          <div className="cp-knowledge" data-tier={tier}>
            <small>Kännedom om klubben</small>
            <strong>{KNOWLEDGE_TIER_LABEL_SV[tier]}</strong>
            <div className="cp-knowledge-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(knowledgePct)} aria-label="Kännedom"><i style={{ width: `${Math.round(knowledgePct)}%` }} /></div>
            {portrait.hidden > 0 && <span>{portrait.hidden} uppgifter till kräver bättre kännedom.</span>}
            <ScoutAssignButton kind="CLUB" targetId={club.id} label="Scouta klubben" />
          </div>
        </aside>
      </div>
      {permanentParentClubId ? <p className="hm-world-note">Permanent B-lag till {getClub(permanentParentClubId)?.name ?? permanentParentClubId}. Kan inte väljas som samarbetsklubb.</p> : activeDevelopmentPartner ? <p className="hm-world-note">Exklusivt samarbete med {getClub(activeDevelopmentPartner.clubAId)?.name ?? activeDevelopmentPartner.clubAId}. Inte tillgänglig för andra klubbar.</p> : null}

      <section className="cp-words" aria-label="Klubben och tränaren i ord">
        <div className="cp-col">
          <h2>Klubben</h2>
          {loading ? <p className="cp-muted">Läser in…</p> : portrait.noIdentityData ? <p className="cp-muted">Ingen klubbidentitet finns registrerad för klubben ännu.</p> : <Lines lines={portrait.identity} />}
        </div>
        <div className="cp-col">
          <h2>Tränaren</h2>
          {loading ? <p className="cp-muted">Läser in…</p> : portrait.noCoachData ? <p className="cp-muted">Ingen bedömd tränarfilosofi för nuvarande huvudtränare.</p> : <Quotes lines={portrait.coach} />}
        </div>
      </section>

      <ClubStory clubId={club.id} limit={4} />

      <div className="cp-grid">
        <section className="cp-panel" aria-labelledby="cp-squad">
          <header><h2 id="cp-squad">Trupp</h2><small>{squad.length} spelare</small></header>
          {squad.length === 0 ? <p className="cp-muted">Ingen truppdata tillgänglig för klubben ännu.</p> : (
            <ul className="cp-squad">{squad.map((p) => (
              <li key={p.id}><span className="hm-shirt-number">{p.shirtNumber ?? "–"}</span><PlayerCell player={p} /><abbr title={positionLabel(p.position)}>{p.position}</abbr><span className="cp-age">{playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate) ?? "–"} år</span></li>
            ))}</ul>
          )}
        </section>
        <section className="cp-panel" aria-labelledby="cp-fixtures">
          <header><h2 id="cp-fixtures">Kommande matcher</h2><small>{upcoming.length} kvar</small></header>
          {upcoming.length === 0 ? <p className="cp-muted">Inga fler matcher inbokade. Spelade matcher finns i berättelsen ovan.</p> : (
            <ul className="cp-fixtures">{upcoming.slice(0, 8).map((f) => { const home = f.homeClubId === club.id; const opp = home ? f.awayClubId : f.homeClubId; return (
              <li key={f.id}><time>{f.date}</time><span>{home ? "Hemma" : "Borta"} mot <ClubLink clubId={opp}>{getClub(opp)?.shortName ?? opp}</ClubLink></span><Link href={fixtureHref(f.id)}>Förhandsvisa →</Link></li>
            ); })}</ul>
          )}
          <h3 className="cp-sub">Ledarstab</h3>
          {staffRoster.length === 0 ? <p className="cp-muted">Ingen personaldata tillgänglig för klubben ännu.</p> : (
            <ul className="cp-staff">{staffRoster.map((m) => <li key={m.id}><Link href={`/career/staff/${encodeURIComponent(m.id)}`}>{m.displayName}</Link><small>{m.roles.length > 0 ? m.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (m.officialRoleLabel ?? "—")}</small></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** CLB-04a B: one line per domain in words; a domain you don't know yet is a fogged line that leads to scouting. */
function Lines({ lines }: { lines: PortraitLine[] }) {
  return <dl className="cp-lines">{lines.map((l) => (
    <div key={l.key} data-known={l.known}>
      <dt>{l.label}</dt>
      <dd>{l.known ? l.sentences.join(" ") : <Link className="cp-fog" href="/career/scouting">Okänt – scouta för att veta mer</Link>}</dd>
    </div>
  ))}</dl>;
}

function Quotes({ lines }: { lines: PortraitLine[] }) {
  const known = lines.filter((l) => l.known);
  const unknown = lines.filter((l) => !l.known);
  return <>
    {known.map((l) => <blockquote key={l.key} className="cp-quote"><p>{l.sentences.join(" · ")}</p><footer>{l.label}</footer></blockquote>)}
    {unknown.length > 0 && <p className="cp-fog-row"><span className="cp-fog">{unknown.map((l) => l.label).join(" · ")}</span> <Link href="/career/scouting">Okänt – scouta för att veta mer →</Link></p>}
  </>;
}
