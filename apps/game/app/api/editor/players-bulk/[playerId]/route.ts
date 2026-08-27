// HM-PLAYER-DATA-EDITOR-1.0: the bulk calibration workspace's ONE save
// endpoint -- one row's worth of edits (identity + roster fields, and
// optionally a CA/PA calibration) in a single round trip, so "save row"
// in the UI is one network call, not several. Reuses the exact SAME
// write paths the pre-existing single-player editors already use:
// - identity/roster: lib/editor/playerRepository.ts's savePlayerEdit
//   (same atomic-write/backup/diff mechanism as app/editor/players/[playerId]).
// - CA/PA: lib/editor/ratingCalibration.ts's calibratePlayerRating,
//   which composes setRatingOverride + the lock workflow exactly as
//   app/editor/ratings/[playerId]'s own override+lock buttons do.
// There is no third write path here -- both are the same canonical
// mechanisms fresh careers already read, just called together.
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
  const { clubId, player, roster, rating } = body as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const catalog = buildCatalog();
  const saveResult = savePlayerEdit(catalog, clubId, playerId, player, roster);
  if (!saveResult.ok) {
    return NextResponse.json({ error: "validation failed", errors: saveResult.errors }, { status: 422 });
  }

  let ratingResult: { ok: boolean; errors: string[] } | null = null;
  if (rating !== undefined && rating !== null) {
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

    // Uses the roster position the client is ABOUT TO SAVE (or already
    // had, if position wasn't touched this call) -- never a stale
    // pre-edit position -- so a same-row position + CA/PA edit locks
    // against the correct branch (outcourt vs goalkeeper) in one save.
    const rosterPayload = roster as { primaryPosition?: unknown } | undefined;
    const primaryPosition = typeof rosterPayload?.primaryPosition === "string" ? rosterPayload.primaryPosition : undefined;
    if (!primaryPosition) {
      return NextResponse.json({ error: "roster.primaryPosition is required to calibrate a rating" }, { status: 400 });
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

  return NextResponse.json({ ok: true, diff: saveResult.diff, rating: ratingResult });
}
