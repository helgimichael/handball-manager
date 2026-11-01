// HM-ALPHA3-M01: rendered backdrops owned by the shared experience system.
// court-moment: a regulation 40 x 20 m court at night, the far goal area in
// a pool of light and the left side dark for text. Rendered headlessly in
// Blender from scripts/visual/render_court_moment.py (procedural geometry,
// no external assets; 13 KB / 8 KB WebP). Re-run that script to regenerate.
import courtWide from "./assets/court-moment-1920.webp";
import courtNarrow from "./assets/court-moment-960.webp";
import { photoBackdrop } from "./visuals";

/** For promotions, titles and season achievements -- any Moment that belongs on the court rather than in an office. */
export const COURT_MOMENT_BACKDROP = photoBackdrop(courtWide, courtNarrow);
