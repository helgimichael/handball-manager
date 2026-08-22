// HM-EDITOR-0.2/HM-UX-0.3: proposed ratings + review state for one
// club's real roster. Read-only for the ca/pa/attribute/claim data
// (always recomputed fresh via the shared snapshotClubRatingProposals,
// the SAME helper the normal Player Profile's own API route uses --
// never persisted here); merges in whatever reviewer state already
// exists in rating-review.json.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { loadRatingReviewState } from "@/lib/editor/ratingReviewRepository";
import { snapshotClubRatingProposals } from "@/lib/gameWorld/ratingProposalSnapshot";
import { generatePlayerRatingProfile } from "@/lib/rating/generation/generationEngine";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { clubId } = await params;

  const snapshot = snapshotClubRatingProposals(clubId);
  if (snapshot.clubName === null) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }

  const reviewState = loadRatingReviewState(clubId);
  const players = snapshot.players.map(({ profile, matchedCalibration }) => {
    const defaultStatus = matchedCalibration ? "PROPOSED" : "UNASSESSED";
    const review = reviewState[profile.playerId];
    return {
      profile,
      matchedCalibration,
      defaultStatus,
      status: review?.status ?? defaultStatus,
      note: review?.note ?? null,
      reviewedAt: review?.updatedAt ?? null,
      // HM-RATINGS-0.4 Part G: a PREVIEW-only complete generated
      // profile for Rating Review -- never persisted, never the basis
      // for review status, and never surfaced on the normal Player
      // Profile (that stays evidence-only per HM-UX-0.3).
      generatedPreview: generatePlayerRatingProfile(profile),
    };
  });

  return NextResponse.json({
    clubId: snapshot.clubId,
    clubName: snapshot.clubName,
    players,
    unresolvedPositionCount: snapshot.unresolvedPositionCount,
    invalidProfileCount: snapshot.invalidProfileCount,
  });
}
