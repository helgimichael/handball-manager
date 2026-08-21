"use client";

// HM-UX-0.2: Schedule is now the one canonical fixture surface (Spec
// §5/§7) -- Matches' only unique value (the W/L/D outcome badge for
// completed fixtures) moved into Schedule's own completed-row
// rendering. This route is kept as a compatibility redirect rather than
// deleted outright: no EventDestination ever pointed here, but an old
// bookmark or browser history entry should still land safely rather
// than 404.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MatchesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/career/schedule");
  }, [router]);
  return null;
}
