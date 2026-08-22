// HM-EDITOR-0.2/HM-UX-0.3/HM-RATINGS-0.5: the full Rating Review
// workbench for one club's real roster -- source evidence, CA proposal
// (calibrated or HM-RATINGS-0.5-estimated), draft overrides, locked
// state, and the HM-RATINGS-0.4 generated attribute preview, all
// composed by lib/editor/ratingWorkbench.ts. Everything except the
// locked-rating database and draft overrides is recomputed fresh on
// every request -- never persisted here.
import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";
import { buildRatingWorkbenchForClub } from "@/lib/editor/ratingWorkbench";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  if (!isEditorEnabled()) {
    return NextResponse.json({ error: "editor disabled" }, { status: 403 });
  }
  const { clubId } = await params;

  const workbench = buildRatingWorkbenchForClub(clubId);
  if (!workbench) {
    return NextResponse.json({ error: "unknown clubId" }, { status: 404 });
  }

  return NextResponse.json({
    clubId: workbench.clubId,
    clubName: workbench.clubName,
    players: workbench.rows,
  });
}
