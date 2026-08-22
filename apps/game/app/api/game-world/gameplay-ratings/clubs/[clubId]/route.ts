// HM-RATINGS-0.6: non-gated read path for the COMPLETE gameplay rating
// database -- every real player, LOCKED-wins-else-computed, per
// lib/gameWorld/gameplayRatingSnapshot.ts. Not gated by isEditorEnabled
// -- like /api/game-world/rating-proposals and /api/game-world/
// locked-ratings, this is meant to become real game data, so it must
// work in production. Not wired into any gameplay surface yet (Part Q
// boundary) -- this route exists to prove the complete-coverage read
// path, for HM-MATCH-RATINGS-0.1 to consume next.
import { NextResponse } from "next/server";
import { snapshotGameplayRatingsForClub } from "@/lib/gameWorld/gameplayRatingSnapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const snapshot = snapshotGameplayRatingsForClub(clubId);
  if (snapshot.clubName === null) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
