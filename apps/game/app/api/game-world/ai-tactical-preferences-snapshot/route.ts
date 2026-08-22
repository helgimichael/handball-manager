// AI tactical preferences snapshot endpoint (HM-IDENTITY-0.3).
//
// The one server boundary allowed to invoke
// gameWorld/serverSnapshot.ts's snapshotAiTacticalPreferences (which
// touches the filesystem via the identity loaders). Career creation is
// client-side (CareerContext.tsx, localStorage-backed) -- this route is
// what lets it fetch a typed, already-derived AI TeamTacticalProfile
// snapshot instead of ever reading data/real-world/*identity* itself.
// Read-only, same as squad-snapshot/staff-snapshot/coach-identity-snapshot.
import { NextResponse } from "next/server";
import { snapshotAiTacticalPreferences } from "@/lib/gameWorld/serverSnapshot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId");
  const season = url.searchParams.get("season");
  const seasonStartDate = url.searchParams.get("seasonStartDate");
  if (!competitionId || !season || !seasonStartDate) {
    return NextResponse.json({ error: "competitionId, season, and seasonStartDate query params are required" }, { status: 400 });
  }
  const aiTacticalPreferences = snapshotAiTacticalPreferences(competitionId, season, seasonStartDate);
  return NextResponse.json({ aiTacticalPreferences });
}
