import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isEditorEnabled } from "@/lib/editor/env";
import { DevShell } from "@/components/dev/DevShell";

// Arena Nights SYS-03 (A) "Gate under dev console": the engine V2 labs sit behind the same
// server gate as /editor (HM_EDITOR_ENABLED=true and not a production build) -- 404 otherwise,
// evaluated per request -- and render inside the dev shell, never the player product.
export const dynamic = "force-dynamic";

export default function ScenarioLabLayout({ children }: { children: ReactNode }) {
  if (!isEditorEnabled()) notFound();
  return <DevShell>{children}</DevShell>;
}
