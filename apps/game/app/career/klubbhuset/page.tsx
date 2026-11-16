// Arena Nights (CLB-01 C "Merged into Club Journal"): Klubbhuset is no longer a page of its own. Its facility-tier
// art and department hotspots head the Klubben front page, and identity, supporters, rivals and honours live in
// the journal's almanac. Old links and bookmarks land there.
import { redirect } from "next/navigation";

export default function KlubbhusetPage() {
  redirect("/career/club");
}
