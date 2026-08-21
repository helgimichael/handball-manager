import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isEditorEnabled } from "@/lib/editor/env";

// Forces every /editor/* route to be server-rendered per-request rather
// than statically optimized at build time. Without this, Next could
// bake the isEditorEnabled() result for whatever env was present at
// `next build` time into a static page -- meaning a later runtime
// env change (e.g. someone flipping HM_EDITOR_ENABLED at deploy time)
// would never be re-evaluated. The guard below must run fresh on every
// request (Spec S10).
export const dynamic = "force-dynamic";

// Server-side route guard (HM-DATA-EDITOR-0.1, Spec S9/S29): this layout
// runs for every request under /editor/*, before any page component
// renders -- nested inside the app's existing root layout (app/layout.tsx),
// so it must not redeclare <html>/<body>. Direct URL access cannot bypass
// it -- there is no client-side check to work around. Disabled -> Next's
// real 404, not merely an empty/blocked screen.
export default function EditorLayout({ children }: { children: ReactNode }) {
  if (!isEditorEnabled()) {
    notFound();
  }
  return <div className="hm-editor-root">{children}</div>;
}
