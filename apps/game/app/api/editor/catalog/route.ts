import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { buildCatalog } from "@/lib/editor/catalog";

export async function GET() {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const catalog = buildCatalog();
  return NextResponse.json({
    clubs: catalog.clubs.map((c) => ({
      clubId: c.clubId,
      clubName: c.clubName,
      competitionId: c.competitionId,
      nation: c.nation,
      season: c.season,
      competitionSlug: c.competitionSlug,
      playerCount: c.playerCount,
    })),
  });
}
