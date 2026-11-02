// HM-ALPHA3 release readiness: the trophy Moment backdrop -- a generic cup on
// a plinth at the edge of a regulation court, rendered headlessly in Blender
// from scripts/visual/render_trophy_moment.py (procedural, no external
// assets; 11 KB / 6 KB WebP). Re-run that script to regenerate.
import trophyWide from "./assets/trophy-moment-1920.webp";
import trophyNarrow from "./assets/trophy-moment-960.webp";
import { photoBackdrop } from "@/components/experience/visuals";

/** Season-end Moments for titles and a decided season. */
export const TROPHY_MOMENT_BACKDROP = photoBackdrop(trophyWide, trophyNarrow);
/** The narrow still, used as a small accent behind champion badges. */
export const TROPHY_STILL = trophyNarrow.src;
