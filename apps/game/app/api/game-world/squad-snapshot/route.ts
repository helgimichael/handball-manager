// Real-world squad snapshot endpoint (HM-DATA-0.2).
//
// The one server boundary allowed to invoke gameWorld/serverSnapshot.ts
// (which touches the filesystem). Career creation is client-side
// (CareerContext.tsx, localStorage-backed) -- this route is what lets it
// fetch a typed, already-validated squad snapshot instead of ever
// reading data/real-world/* itself. Read-only: never accepts or writes
// anything -- unlike the Development Editor's routes, this is not
// gated behind HM_EDITOR_ENABLED, since it only ever returns the same
// validated, publicly-selectable club data New Game already lists.
import { NextResponse } from "next/server";
import { snapshotWorldSquads } from "@/lib/gameWorld/serverSnapshot";

export async function GET(request: Request) {
  const competitionId = new URL(request.url).searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId query param is required" }, { status: 400 });
  }
  const worldSquads = snapshotWorldSquads(competitionId);
  return NextResponse.json({ worldSquads });
}
