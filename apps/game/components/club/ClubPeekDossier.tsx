'use client';
// Arena Nights -- CLB-04 C: what the club Peek adds for another club -- head-to-head with your club and how well
// you know them (knowledge tier). Public results only; the knowledge figure is the manager's own scouting state.
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { headToHead } from '@/lib/club/clubTimeline';
import { getClubKnowledgePct } from '@/lib/knowledge/knowledgeIntegration';
import { knowledgeTier, KNOWLEDGE_TIER_LABEL_SV } from '@/lib/knowledge/types';
import { matchReportHref } from '@/lib/career/fixtureRoutes';

export function ClubPeekDossier({ clubId }: { clubId: string }) {
  const { career } = useCareer();
  if (clubId === career.playerClubId) return null;
  const h = headToHead(career, clubId);
  const pct = getClubKnowledgePct(career, clubId);
  const tier = knowledgeTier(pct);
  return (
    <div className="cp-peek-dossier">
      <div><span className="cc-peek-label">Inbördes mot er</span>
        {h.played ? <p><b>{h.won}–{h.drawn}–{h.lost}</b> <small>({h.goalsFor}–{h.goalsAgainst} i mål, {h.played} {h.played === 1 ? 'match' : 'matcher'})</small>{h.recent[0] && <> · <Link href={matchReportHref(h.recent[0].fixtureId)}>senast {h.recent[0].goalsFor}–{h.recent[0].goalsAgainst}</Link></>}</p> : <p><small>Ni har inte mötts i din tid.</small></p>}
      </div>
      <div><span className="cc-peek-label">Kännedom</span><p data-tier={tier}><b>{KNOWLEDGE_TIER_LABEL_SV[tier]}</b> <small>{Math.round(pct)} %</small></p></div>
    </div>
  );
}
