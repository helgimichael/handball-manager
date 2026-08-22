// HM-RATINGS-0.5 Part M: non-gated read path for LOCKED player ratings
// -- proves the game-loading boundary exists and round-trips, without
// wiring it into any actual gameplay surface yet. Unlike the Editor's
// own routes, this one is NOT behind isEditorEnabled(): locked ratings
// are meant to become real game data eventually, so reading them must
// work in production, exactly like /api/game-world/rating-proposals
// already does for the (unlocked) proposal snapshot.
import { NextResponse } from "next/server";
import { snapshotLockedRatingsForClub } from "@/lib/gameWorld/lockedRatingSnapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const snapshot = snapshotLockedRatingsForClub(clubId);
  if (snapshot.clubName === null) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
