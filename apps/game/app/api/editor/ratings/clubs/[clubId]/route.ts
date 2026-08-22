// HM-EDITOR-0.2: proposed ratings + review state for one club's real
// roster. Read-only for the ca/pa/attribute/claim data (always
// recomputed fresh from lib/rating/pipeline -- never persisted); merges
// in whatever reviewer state already exists in rating-review.json.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { loadRatingReviewState } from "@/lib/editor/ratingReviewRepository";
import { runRatingPipelineForClub } from "@/lib/rating/pipeline";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { clubId } = await params;

  const result = runRatingPipelineForClub(clubId);
  if (result.clubName === null) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }

  const reviewState = loadRatingReviewState(clubId);
  const players = result.profiles.map((profile) => {
    const matchedCalibration = result.matchedCalibrationPlayerIds.has(profile.playerId);
    const defaultStatus = matchedCalibration ? "PROPOSED" : "UNASSESSED";
    const review = reviewState[profile.playerId];
    return {
      profile,
      matchedCalibration,
      defaultStatus,
      status: review?.status ?? defaultStatus,
      note: review?.note ?? null,
      reviewedAt: review?.updatedAt ?? null,
    };
  });

  return NextResponse.json({
    clubId: result.clubId,
    clubName: result.clubName,
    players,
    unresolvedPositionCount: result.unresolvedPositionCount,
    invalidProfileCount: result.invalidProfileCount,
  });
}
