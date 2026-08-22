// HM-UX-0.3: rating proposals for one real-world club's roster, for the
// NORMAL Player Profile screen (not the Editor). Not gated behind
// HM_EDITOR_ENABLED -- a player must be able to see their own real
// players' proposed ratings during ordinary play, same as
// squad-snapshot/staff-snapshot aren't editor-gated. Read-only: never
// accepts a write, and returns exactly the same profile data
// app/api/editor/ratings/clubs/[clubId] shows (both call
// gameWorld/ratingProposalSnapshot.ts) -- no review-status merging here,
// since review workflow is an Editor-only concern.
import { NextResponse } from "next/server";
import { snapshotClubRatingProposals } from "@/lib/gameWorld/ratingProposalSnapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const snapshot = snapshotClubRatingProposals(clubId);
  if (snapshot.clubName === null) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
