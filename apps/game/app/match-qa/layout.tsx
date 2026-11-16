import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isEditorEnabled } from "@/lib/editor/env";
import { DevShell } from "@/components/dev/DevShell";

// Arena Nights SYS-04 (A) "Gated QA harness": same server gate as /editor (HM_EDITOR_ENABLED=true
// and not a production build), 404 otherwise, evaluated per request; rendered in the dev shell.
export const dynamic = "force-dynamic";

export default function MatchQaLayout({ children }: { children: ReactNode }) {
  if (!isEditorEnabled()) notFound();
  return <DevShell>{children}</DevShell>;
}
