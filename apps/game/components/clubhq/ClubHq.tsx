// HM-ALPHA3-M09 (9D): the club's home at dusk, one render per tier
// (Blender, scripts/visual/render_klubbhuset.py).
import { photoBackdrop } from "@/components/experience/visuals";
import type { HqTier } from "@/lib/clubhq/clubhq";
import localWide from "./assets/klubbhuset-local-1920.webp";
import localNarrow from "./assets/klubbhuset-local-960.webp";
import proWide from "./assets/klubbhuset-pro-1920.webp";
import proNarrow from "./assets/klubbhuset-pro-960.webp";
import eliteWide from "./assets/klubbhuset-elite-1920.webp";
import eliteNarrow from "./assets/klubbhuset-elite-960.webp";

export const HQ_BACKDROP: Record<HqTier, ReturnType<typeof photoBackdrop>> = {
  local: photoBackdrop(localWide, localNarrow),
  pro: photoBackdrop(proWide, proNarrow),
  elite: photoBackdrop(eliteWide, eliteNarrow),
};
