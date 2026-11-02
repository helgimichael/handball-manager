// HM-ALPHA3-M05: the departure Moment backdrop -- an empty locker room with a
// packed kit bag, rendered headlessly in Blender from
// scripts/visual/render_departure_moment.py (procedural, no external assets;
// 33 KB / 18 KB WebP). Re-run that script to regenerate.
import departureWide from "./assets/departure-moment-1920.webp";
import departureNarrow from "./assets/departure-moment-960.webp";
import { photoBackdrop } from "@/components/experience/visuals";

/** Sales, releases and players leaving on a pre-contract. */
export const DEPARTURE_BACKDROP = photoBackdrop(departureWide, departureNarrow);
