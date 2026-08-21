import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { buildCatalog } from "@/lib/editor/catalog";
import { loadPlayerRecord, savePlayerEdit } from "@/lib/editor/playerRepository";

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { playerId } = await params;
  const clubId = new URL(request.url).searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId query parameter is required" }, { status: 400 });
  }

  const record = loadPlayerRecord(buildCatalog(), clubId, playerId);
  if (!record) {
    return NextResponse.json({ error: "player not found" }, { status: 404 });
  }
  return NextResponse.json({ record });
}

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
  const { clubId, player, roster } = body as Record<string, unknown>;
  if (typeof clubId !== "string") {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const result = savePlayerEdit(buildCatalog(), clubId, playerId, player, roster);
  if (!result.ok) {
    return NextResponse.json({ error: "validation failed", errors: result.errors }, { status: 422 });
  }
  return NextResponse.json({ saved: true, diff: result.diff });
}
