// Portable coach identity snapshot endpoint (HM-COACH-IDENTITY-0.1),
// mirroring app/api/game-world/staff-snapshot/route.ts exactly.
//
// The one server boundary allowed to invoke
// gameWorld/coachIdentitySnapshot.ts (which touches the filesystem).
// Not yet consumed by any screen -- this milestone stops before
// gameplay/UI integration (HM-IDENTITY-0.2) -- but exists so the read
// layer is already in place, exactly like squad-snapshot/staff-snapshot.
// Never persisted into CareerState/save data.
import { NextResponse } from "next/server";
import { snapshotCoachIdentity } from "@/lib/gameWorld/coachIdentitySnapshot";

export async function GET(request: Request) {
  const personId = new URL(request.url).searchParams.get("personId");
  if (!personId) {
    return NextResponse.json({ error: "personId query param is required" }, { status: 400 });
  }
  const snapshot = snapshotCoachIdentity(personId);
  return NextResponse.json({ profile: snapshot?.profile ?? null });
}
