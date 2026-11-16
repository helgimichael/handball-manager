/** ENT-06: inside a career and on match routes the host shell hides behind a corner pill; elsewhere the reveal edge stays. */
export function hostShellScope(pathname: string | null): "career" | "match" | null {
  if (!pathname) return null;
  if (pathname === "/career" || pathname.startsWith("/career/")) return "career";
  if (pathname === "/match-qa" || pathname.startsWith("/match-qa/")) return "match";
  return null;
}
