/* HM Club Identity — kit colour → Arena Nights neon (deterministic; shared by browser and Node).
 *
 * Rule set (documented in HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md):
 *  1. Source colour = the home shirt's dominant colour, if it is chromatic.
 *     If the shirt is predominantly white/black/grey, use the documented secondary colour, then the trim colour.
 *     If no chromatic kit colour is documented, the club gets the MONOCHROME neon (ice silver) — no hue is invented.
 *     If the kit is UNKNOWN, the club gets the PENDING neon (steel) and is flagged for review.
 *  2. Conversion in OKLCH: keep the hue, set lightness to a fixed target (yellows higher so they stay yellow),
 *     set chroma to a target, reduced only as far as needed to stay inside sRGB.
 *  3. Accessibility gate: neon on the Arena night background and dark ink (#061018) on neon must both be ≥ 4.5:1;
 *     lightness is nudged upward until both pass.
 */
(function (root) {
  const BG = '#070b12', INK = '#061018';
  const MONOCHROME = '#d7e1ee'; // ice silver for white/black/grey kits without a documented accent
  const PENDING = '#9fb0c6';    // steel for clubs whose kit is not yet verified
  const CLUBLESS = '#ff7a1a';   // owner decision: clubless manager

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hexToRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
  const rgbToHex = (r) => '#' + r.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

  function hexToOklch(hex) {
    const [r, g, b] = hexToRgb(hex).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
  }
  function oklchToRgb(L, C, h) {
    const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(delin);
  }
  const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
  function luminance(hex) { const [r, g, b] = hexToRgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function isChromatic(hex) { if (!hex) return false; const [L, C] = hexToOklch(hex); return C >= 0.045 && L > 0.18 && L < 0.97; }

  // Lightness/chroma targets: identical for every club except where the hue needs it to stay recognisable.
  function targets(h) {
    if (h >= 85 && h < 115) return { L: 0.88, C: 0.17 };  // yellow: must stay light or it turns olive
    if (h >= 55 && h < 85) return { L: 0.78, C: 0.17 };   // orange/gold
    if (h >= 115 && h < 175) return { L: 0.82, C: 0.2 };  // greens
    if (h >= 175 && h < 215) return { L: 0.8, C: 0.14 };  // turquoise/teal
    if (h >= 215 && h < 285) return { L: 0.67, C: 0.2 };  // blues: saturated, not pastel
    if (h >= 285 && h < 345) return { L: 0.7, C: 0.22 };  // purples, magentas, pinks
    return { L: 0.665, C: 0.235 };                        // reds (345°–55°): saturated red, not coral
  }
  function neonFromHex(hex) {
    const [, , h] = hexToOklch(hex);
    let { L, C } = targets(h);
    let rgb;
    for (let i = 0; i < 40; i++) { // nudge lightness up until both contrast checks pass
      let c = C; rgb = oklchToRgb(L, c, h);
      while (!inGamut(rgb) && c > 0.01) { c -= 0.004; rgb = oklchToRgb(L, c, h); }
      const out = rgbToHex(rgb);
      if (contrast(out, BG) >= 4.5 && contrast(INK, out) >= 4.5) return out;
      L = Math.min(0.95, L + 0.01);
    }
    return rgbToHex(rgb);
  }

  /** kit: { primary, secondary, trim (hex or null), status } → { neon, rule, source } */
  function neonForKit(kit) {
    if (!kit) return { neon: PENDING, rule: 'pending', source: null };
    if (kit.override) return { neon: kit.override, rule: 'manual-override', source: kit.override };
    if (kit.status === 'UNKNOWN' || !kit.primary) return { neon: PENDING, rule: 'pending', source: null };
    if (isChromatic(kit.primary)) return { neon: neonFromHex(kit.primary), rule: 'primary', source: kit.primary };
    if (isChromatic(kit.secondary)) return { neon: neonFromHex(kit.secondary), rule: 'secondary (monochrome shirt)', source: kit.secondary };
    if (isChromatic(kit.trim)) return { neon: neonFromHex(kit.trim), rule: 'trim (monochrome shirt)', source: kit.trim };
    return { neon: MONOCHROME, rule: 'monochrome (no documented accent)', source: kit.primary };
  }

  const api = { neonForKit, neonFromHex, contrast, hexToOklch, isChromatic, BG, INK, MONOCHROME, PENDING, CLUBLESS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HMNeon = api;
})(typeof window !== 'undefined' ? window : globalThis);
