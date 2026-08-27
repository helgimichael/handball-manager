// Real club identity snapshot endpoint (HM-DATA-ALLSVENSKAN-1.0),
// mirroring app/api/game-world/staff-snapshot/route.ts exactly.
//
// The one server boundary allowed to invoke
// gameWorld/clubIdentitySnapshot.ts (which touches the filesystem). Any
// club-profile screen is client-side and fetches on demand -- identity
// data is never persisted into CareerState/save data, same rule as
// staff-snapshot. Read-only, not gated behind HM_EDITOR_ENABLED or
// Club.dataSource, for the same reason staff-snapshot isn't.
import { NextResponse } from "next/server";
import { snapshotClubIdentity } from "@/lib/gameWorld/clubIdentitySnapshot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clubId = url.searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId query param is required" }, { status: 400 });
  }
  const asOfDate = url.searchParams.get("asOfDate") ?? new Date().toISOString().slice(0, 10);
  const snapshot = snapshotClubIdentity(clubId, asOfDate);
  return NextResponse.json({
    clubIdentity: snapshot?.clubIdentity ?? null,
    coachIdentity: snapshot?.coachIdentity ?? null,
  });
}
