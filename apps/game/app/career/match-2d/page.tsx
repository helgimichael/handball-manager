'use client';
// Arena Nights -- MDY-04 C: replays live in the match report's "Repris" tab (ANL-01). This standalone
// page (and its broken encoding) is retired; old links land on the schedule, where every played match
// opens its report.
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MatchReplaysRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/career/schedule'); }, [router]);
  return <p role="status">Matchrepriserna finns nu i varje matchrapport under fliken Repris. Öppnar matchprogrammet… <Link href="/career/schedule">Gå dit direkt →</Link></p>;
}
