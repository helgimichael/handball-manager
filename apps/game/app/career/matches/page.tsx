// HM-UX-0.2 + Arena Nights CMP-03 A: Schedule is the one canonical fixture surface. This legacy route is kept
// only so an old bookmark lands safely -- now as a server redirect (no client flash, no double redirect).
import { redirect } from "next/navigation";

export default function MatchesRedirectPage(): never {
  redirect("/career/schedule");
}
