// HM-PLAYER-DATA-EDITOR-1.0 / 1.0A: the bulk calibration workspace's ONE
// save endpoint -- one row's worth of edits in a single round trip. The
// SOURCE write (identity/roster) and the RATING write (CA/PA) are
// independent canonical paths and are dispatched independently here:
// - identity/roster: lib/editor/playerRepository.ts's savePlayerEdit
//   (same atomic-write/backup/diff mechanism as app/editor/players/[playerId]),
//   invoked ONLY when the client actually sends `player`+`roster` (i.e. a
//   source field changed this save).
// - CA/PA: lib/editor/ratingCalibration.ts's calibratePlayerRating,
//   which composes setRatingOverride + the lock workflow exactly as
//   app/editor/ratings/[playerId]'s own override+lock buttons do,
//   invoked ONLY when the client sends `rating` (i.e. CA and/or PA
//   changed this save).
// A pure position/birth/status/tag edit therefore never touches the
// rating override/lock store, and a pure CA/PA edit never rewrites the
// source JSON files -- but both can be dispatched together, atomically
// from the caller's point of view, in one request when both changed.
// There is no third write path here.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { buildCatalog } from "@/lib/editor/catalog";
import { savePlayerEdit } from "@/lib/editor/playerRepository";
import { calibratePlayerRating, toRatingPosition } from "@/lib/editor/ratingCalibration";
import { CA_MIN, CA_MAX, PA_MIN, PA_MAX } from "@/lib/rating/types";

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
  const { clubId, primaryPosition, player, roster, rating } = body as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const sourceRequested = player !== undefined || roster !== undefined;
  const ratingRequested = rating !== undefined && rating !== null;
  if (!sourceRequested && !ratingRequested) {
    return NextResponse.json({ error: "nothing to save -- provide player+roster and/or rating" }, { status: 400 });
  }

  let saveResult: { ok: true; diff: unknown } | null = null;
  if (sourceRequested) {
    if (player === undefined || roster === undefined) {
      return NextResponse.json({ error: "player and roster must both be provided together to save source fields" }, { status: 400 });
    }
    const catalog = buildCatalog();
    const result = savePlayerEdit(catalog, clubId, playerId, player, roster);
    if (!result.ok) {
      return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 422 });
    }
    saveResult = result;
  }

  let ratingResult: { ok: boolean; errors: string[] } | null = null;
  if (ratingRequested) {
    if (typeof rating !== "object") {
      return NextResponse.json({ error: "rating, when present, must be an object" }, { status: 400 });
    }
    const { ca, pa } = rating as Record<string, unknown>;
    if (ca !== undefined && (typeof ca !== "number" || !Number.isFinite(ca) || ca < CA_MIN || ca > CA_MAX)) {
      return NextResponse.json({ error: `ca must be a number between ${CA_MIN} and ${CA_MAX}` }, { status: 400 });
    }
    if (pa !== undefined && (typeof pa !== "number" || !Number.isFinite(pa) || pa < PA_MIN || pa > PA_MAX)) {
      return NextResponse.json({ error: `pa must be a number between ${PA_MIN} and ${PA_MAX}` }, { status: 400 });
    }
    if (typeof ca === "number" && typeof pa === "number" && pa < ca) {
      return NextResponse.json({ error: "pa cannot be lower than ca" }, { status: 422 });
    }

    // The position needed to resolve the correct outcourt/goalkeeper
    // attribute branch is sent as its own top-level field -- independent
    // of whether `roster` is included in this save -- so a CA/PA-only
    // edit (no source change at all) still calibrates against the
    // player's correct, current position.
    if (typeof primaryPosition !== "string") {
      return NextResponse.json({ error: "primaryPosition is required to calibrate a rating" }, { status: 400 });
    }

    const calibration = calibratePlayerRating(
      clubId,
      playerId,
      toRatingPosition(primaryPosition as Parameters<typeof toRatingPosition>[0]),
      ca as number | undefined,
      pa as number | undefined,
      "Bulk calibration (Editor -> Spelare -> Kalibrering).",
    );
    if (!calibration.ok) {
      return NextResponse.json({ error: "rating calibration failed", errors: calibration.errors }, { status: 422 });
    }
    ratingResult = { ok: true, errors: [] };
  }

  return NextResponse.json({ ok: true, diff: saveResult?.diff ?? null, rating: ratingResult });
}
