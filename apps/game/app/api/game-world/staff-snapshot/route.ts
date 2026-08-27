// Real staff snapshot endpoint (HM-STAFF-DATA-0.1), mirroring
// app/api/game-world/squad-snapshot/route.ts exactly.
//
// The one server boundary allowed to invoke gameWorld/staffIdentitySnapshot.ts
// (which touches the filesystem). Read-only, not gated behind
// HM_EDITOR_ENABLED, for the same reason squad-snapshot isn't: it only
// ever returns the same validated data New Game's club list already
// implies.
//
// HM-STAFF-CAREER-1.0: now also accepts `competitionId` (mirroring
// squad-snapshot's own param), returning EVERY REAL_WORLD club's staff
// in one call -- CareerContext.tsx uses this at career creation and for
// the existing-save top-up (staff is now career-persisted, browsable/
// recruitable at any club, not fetched per-club on demand). The original
// single-club `clubId` form is unchanged for any other caller.
import { NextResponse } from "next/server";
import { snapshotAllClubsStaff, snapshotClubStaff } from "@/lib/gameWorld/staffIdentitySnapshot";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const competitionId = params.get("competitionId");
  if (competitionId) {
    const clubs = snapshotAllClubsStaff(competitionId);
    return NextResponse.json({ clubs });
  }
  const clubId = params.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId or competitionId query param is required" }, { status: 400 });
  }
  const snapshot = snapshotClubStaff(clubId);
  return NextResponse.json({ people: snapshot?.people ?? [], assignments: snapshot?.assignments ?? [] });
}
