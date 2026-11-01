// HM-ALPHA2-05E: the Transfer Centre's court line-art backdrop. Since
// HM-ALPHA3-M01 the drawing lives in the shared experience system; this
// keeps Transfer Management's own `tc-backdrop` placement.
import { CourtBackdrop as SharedCourtBackdrop } from "@/components/experience/CourtBackdrop";

export function CourtBackdrop({ accent }: { accent?: string }) {
  return <SharedCourtBackdrop accent={accent} className="tc-backdrop" />;
}
