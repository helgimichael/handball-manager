import { redirect } from "next/navigation";

// Arena Nights MGR-04 (B) "Move to Design Lab": the Moment library was a developer component gallery
// reachable inside the player product. Its specimens belong in the Design Lab (with mock data); this
// old URL now lands on Idag with a server redirect.
export default function MomentLibraryMovedPage(): never {
  redirect("/career");
}
