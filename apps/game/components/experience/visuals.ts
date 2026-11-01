// HM-ALPHA3-M01: shared visual vocabulary for career Moments.
import type { CSSProperties } from "react";

/** The five tones every Moment primitive understands (see experience.css). */
export type ExperienceTone = "success" | "gold" | "signal" | "loss" | "ink";

/** A responsive photographic backdrop as CSS custom properties: the wide image above 900 px, the narrow one below. Sets both the shared (`--xp-*`) and the Transfer Management (`--tc-*`) variables, so one helper serves both systems. */
export function photoBackdrop(wide: { src: string }, narrow: { src: string } = wide): CSSProperties {
  return {
    ["--xp-photo-wide" as string]: `url(${wide.src})`,
    ["--xp-photo-narrow" as string]: `url(${narrow.src})`,
    ["--tc-photo-wide" as string]: `url(${wide.src})`,
    ["--tc-photo-narrow" as string]: `url(${narrow.src})`,
  };
}
