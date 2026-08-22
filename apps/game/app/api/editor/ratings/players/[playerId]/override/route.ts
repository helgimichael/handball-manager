// HM-RATINGS-0.5 Part J: sets (PUT) or clears (DELETE) one player's
// draft CA/PA/attribute override. Never touches source evidence or the
// model proposal -- only lib/editor/ratingOverrideRepository.ts's own
// sibling file. A locked player's underlying override can still be
// edited here (the lock snapshot itself is untouched until re-locked).
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { clearRatingOverride, setRatingOverride } from "@/lib/editor/ratingOverrideRepository";
import type { Position } from "@/lib/rating/types";

const VALID_POSITIONS: readonly string[] = ["M9", "V9", "H9", "M6", "V6", "H6", "GK"];

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
  const { clubId, position, ca, pa, attributeOverrides } = body as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }
  if (typeof position !== "string" || !VALID_POSITIONS.includes(position)) {
    return NextResponse.json({ error: `position must be one of ${VALID_POSITIONS.join(", ")}` }, { status: 400 });
  }
  if (ca !== undefined && typeof ca !== "number") {
    return NextResponse.json({ error: "ca, when present, must be a number" }, { status: 400 });
  }
  if (pa !== undefined && typeof pa !== "number") {
    return NextResponse.json({ error: "pa, when present, must be a number" }, { status: 400 });
  }
  if (attributeOverrides !== undefined && (typeof attributeOverrides !== "object" || attributeOverrides === null || Array.isArray(attributeOverrides))) {
    return NextResponse.json({ error: "attributeOverrides, when present, must be an object" }, { status: 400 });
  }

  const result = setRatingOverride({
    clubId,
    playerId,
    position: position as Position,
    ca: ca as number | undefined,
    pa: pa as number | undefined,
    attributeOverrides: attributeOverrides as Record<string, number> | undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 422 });
  }
  return NextResponse.json({ saved: true });
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

  const result = clearRatingOverride(clubId, playerId);
  if (!result.ok) {
    return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 422 });
  }
  return NextResponse.json({ cleared: true });
}
