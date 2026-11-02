// HM-ALPHA3-M07: the Boardroom backdrop -- a small club's boardroom late at
// night, the lit sports hall across the car park, rendered headlessly in
// Blender from scripts/visual/render_boardroom_moment.py (procedural, no
// external assets). Re-run that script to regenerate.
import boardroomWide from "./assets/boardroom-moment-1920.webp";
import boardroomNarrow from "./assets/boardroom-moment-960.webp";
import { photoBackdrop } from "@/components/experience/visuals";

/** The Boardroom, board verdicts, dismissal and appointment Moments. */
export const BOARDROOM_BACKDROP = photoBackdrop(boardroomWide, boardroomNarrow);
