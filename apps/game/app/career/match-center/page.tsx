import { redirect } from "next/navigation";

// Arena Nights MDY-03 (A) "Direct redirect": former demo surface. Career matches are opened from
// Schedule; historical playback comes from saved match archives. One server redirect straight to the
// canonical schedule (no /career/matches hop).
export default function MatchCenter(): never {
  redirect("/career/schedule");
}
