import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { buildCatalog } from "@/lib/editor/catalog";
import { listClubPlayers } from "@/lib/editor/playerRepository";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { clubId } = await params;
  const rows = listClubPlayers(buildCatalog(), clubId);
  if (!rows) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }
  return NextResponse.json({ players: rows });
}
