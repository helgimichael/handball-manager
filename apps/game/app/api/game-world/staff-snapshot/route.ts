// Real staff snapshot endpoint (HM-STAFF-DATA-0.1), mirroring
// app/api/game-world/squad-snapshot/route.ts exactly.
//
// The one server boundary allowed to invoke gameWorld/staffIdentitySnapshot.ts
// (which touches the filesystem). The Staff screen is client-side and
// fetches on demand for the manager's current club -- staff data is
// never persisted into CareerState/save data (Spec: keep old saves
// safe; no migration needed since nothing about the save shape
// changes). Read-only, not gated behind HM_EDITOR_ENABLED, for the same
// reason squad-snapshot isn't: it only ever returns the same validated
// data New Game's club list already implies.
import { NextResponse } from "next/server";
import { snapshotClubStaff } from "@/lib/gameWorld/staffIdentitySnapshot";

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "clubId query param is required" }, { status: 400 });
  }
  const snapshot = snapshotClubStaff(clubId);
  return NextResponse.json({ people: snapshot?.people ?? [], assignments: snapshot?.assignments ?? [] });
}
