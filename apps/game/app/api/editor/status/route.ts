import { NextResponse } from "next/server";
import { isEditorEnabled } from "@/lib/editor/env";

// The only editor endpoint that responds even when disabled -- it just
// reports the flag, so the client can decide whether to show the EDITOR
// nav link. Every OTHER editor route independently re-checks
// isEditorEnabled() itself; this endpoint is not what enforces the
// boundary (Spec S9: "Do not rely only on hiding a button").
export async function GET() {
  return NextResponse.json({ enabled: isEditorEnabled() });
}
