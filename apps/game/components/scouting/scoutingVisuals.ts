// HM-ALPHA3-M06: the Scouting Centre / discovery backdrop -- an away arena
// seen from the stand, a regulation court under the lights, rendered
// headlessly in Blender from scripts/visual/render_scouting_moment.py
// (procedural, no external assets). Re-run that script to regenerate.
import scoutingWide from "./assets/scouting-moment-1920.webp";
import scoutingNarrow from "./assets/scouting-moment-960.webp";
import { photoBackdrop } from "@/components/experience/visuals";

/** Rekryteringsrummet and the "new talent" discovery Moment. */
export const SCOUTING_BACKDROP = photoBackdrop(scoutingWide, scoutingNarrow);
