// Canonical gameplay-ratings snapshot endpoint (HM-MATCH-RATINGS-0.1).
//
// The one server boundary allowed to invoke gameWorld/serverSnapshot.ts's
// snapshotGameplayRatings (which touches the filesystem via the rating
// pipeline's real-world loader). Career creation is client-side
// (CareerContext.tsx, localStorage-backed) -- this route is what lets it
// fetch a typed, already-resolved canonical CA/PA/attribute snapshot
// instead of ever reading data/real-world/* or the rating pipeline
// itself. Read-only, same pattern as squad-snapshot/
// ai-tactical-preferences-snapshot.
import { NextResponse } from "next/server";
import { snapshotGameplayRatings } from "@/lib/gameWorld/serverSnapshot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId query param is required" }, { status: 400 });
  }
  const gameplayRatings = snapshotGameplayRatings(competitionId);
  return NextResponse.json({ gameplayRatings });
}
