// HM-EDITOR-0.2: sets ONE player's rating-review status/note. Never
// accepts or writes a ca/pa/attribute value -- this route's request
// body has no field for one, so there is no way to "invent" a rating
// through this endpoint even by accident.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { REVIEW_STATUSES, setReviewStatus } from "@/lib/editor/ratingReviewRepository";

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
  const { clubId, status, note } = body as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }
  if (typeof status !== "string" || !(REVIEW_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of ${REVIEW_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (note !== undefined && typeof note !== "string") {
    return NextResponse.json({ error: "note, when present, must be a string" }, { status: 400 });
  }

  const result = setReviewStatus(clubId, playerId, status as (typeof REVIEW_STATUSES)[number], note as string | undefined);
  if (!result.ok) {
    return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 422 });
  }
  return NextResponse.json({ saved: true });
}
