import { notFound, redirect } from "next/navigation";
import { isEditorEnabled } from "@/lib/editor/env";

// Arena Nights SYS-05 (A) "Move under dev gate": the CPU recruitment debug view now lives in the dev
// console (/editor/cpu-recruitment). This old player-route URL is a 404 when the editor gate is off and
// a server redirect for developers, so nothing internal stays reachable under /career.
export const dynamic = "force-dynamic";

export default function CpuRecruitmentMovedPage(): never {
  if (!isEditorEnabled()) notFound();
  redirect("/editor/cpu-recruitment");
}
