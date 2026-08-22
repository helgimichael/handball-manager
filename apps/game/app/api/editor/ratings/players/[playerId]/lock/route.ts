// HM-RATINGS-0.5 Part K: LOCK (PUT) / UNLOCK (DELETE) one player's
// rating profile into/out of the persistent game rating database
// (lib/editor/ratingDatabaseRepository.ts). Locking recomputes the
// player's full workbench row fresh (source + CA estimate/calibration +
// any draft override + HM-RATINGS-0.4 generation) and snapshots exactly
// that -- it never invents a CA the workbench itself couldn't already
// produce, and it never auto-locks anything on its own (this route only
// runs when a human explicitly calls it). Also marks the review status
// LOCKED/REVIEWED via the existing review repository, so a locked
// player's status is visible through the same channel every other
// review state already uses.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { setReviewStatus } from "@/lib/editor/ratingReviewRepository";
import { lockPlayerRating, unlockPlayerRating } from "@/lib/editor/ratingDatabaseRepository";
import { buildLockedRecordFromRow, buildRatingWorkbenchRowForPlayer } from "@/lib/editor/ratingWorkbench";

export async function PUT(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { playerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const { clubId, note } = body as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }
  if (note !== undefined && typeof note !== "string") {
    return NextResponse.json({ error: "note, when present, must be a string" }, { status: 400 });
  }

  const row = buildRatingWorkbenchRowForPlayer(clubId, playerId);
  if (!row) {
    return NextResponse.json({ error: "unknown clubId or playerId" }, { status: 404 });
  }

  const record = buildLockedRecordFromRow(clubId, row, note as string | undefined);
  if (!record) {
    return NextResponse.json({ error: "cannot lock a player with unresolved CA" }, { status: 422 });
  }

  const lockResult = lockPlayerRating(clubId, record);
  if (!lockResult.ok) {
    return NextResponse.json({ error: "validation failed", errors: lockResult.errors }, { status: 422 });
  }

  setReviewStatus(clubId, playerId, "LOCKED", note as string | undefined);
  return NextResponse.json({ locked: true, record });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { playerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { clubId } = (body ?? {}) as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const result = unlockPlayerRating(clubId, playerId);
  if (!result.ok) {
    return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 422 });
  }
  setReviewStatus(clubId, playerId, "REVIEWED", "Unlocked -- reverted from LOCKED for further review.");
  return NextResponse.json({ unlocked: true });
}
