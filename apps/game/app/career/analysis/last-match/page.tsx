"use client";
// Arena Nights -- ANL-05 C "Merge into report": the latest-match deep dive is the match report now
// (halves split, scoring runs and the filterable event timeline live in its Statistik tab). This route
// stays as a redirect so old links land on the latest report.
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { getLastPlayedPlayerFixture } from '@/lib/career/calendar';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { SceneEmpty } from '@/components/game/Secondary';

export default function AnalysisLastMatchRedirect() {
  const router = useRouter();
  const { career } = useCareer();
  const last = getLastPlayedPlayerFixture(career);
  const target = last ? matchReportHref(last.fixture.id) : null;
  useEffect(() => { if (target) router.replace(target); }, [router, target]);
  if (target) return <p role="status">Öppnar senaste matchrapporten… <Link href={target}>Gå dit direkt →</Link></p>;
  return <SceneEmpty title="Säsongens första match väntar" actions={<><Link className="hm-btn hm-btn-sm" href="/career/analysis/matches">Alla matcher →</Link><Link className="hm-btn hm-btn-sm" href="/career/schedule">Kommande matcher →</Link></>}>Det finns ingen spelad match för ditt lag den här säsongen ännu. Matchrapporten skapas efter slutsignalen.</SceneEmpty>;
}
