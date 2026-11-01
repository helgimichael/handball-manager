// HM-ALPHA3-M01: colours for the generated fallback shield. Pure, so the
// contrast rules are unit-testable without rendering.

export interface CrestPalette {
  /** Shield body: the club's primary colour. */
  fill: string;
  /** Initials: the secondary colour when it reads clearly on the fill, else white or ink. */
  text: string;
  /** Inner rule, rules and dot: the text colour, softened. */
  line: string;
  /** Outer edge, so a dark shield never melts into a navy surface (or a white one into paper). */
  edge: string;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const WHITE = "#ffffff";
const INK = "#111318";

function rgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** `undefined` when there is no usable club colour (e.g. "" or a CSS variable) -- the caller then keeps the neutral themed shield. */
export function crestPalette(primary: string | undefined, secondary: string | undefined): CrestPalette | undefined {
  if (!primary || !HEX.test(primary)) return undefined;
  const candidates = [secondary && HEX.test(secondary) ? secondary : undefined, WHITE, INK].filter(Boolean) as string[];
  // The secondary colour wins whenever it is legible for large initials (WCAG 3:1); otherwise the stronger of white and ink.
  const text = candidates.find((c, i) => i === 0 && contrastRatio(c, primary) >= 3) ?? (contrastRatio(WHITE, primary) >= contrastRatio(INK, primary) ? WHITE : INK);
  const dark = luminance(primary) < 0.08;
  return { fill: primary, text, line: withAlpha(text, 0.62), edge: dark ? "rgb(255 255 255 / .22)" : "rgb(17 19 24 / .18)" };
}
