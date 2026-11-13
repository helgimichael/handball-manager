// Club Identity C5: generates app/arena-overrides.css -- the Arena Nights mapping of the
// production "paper" stylesheets' hard-coded colours. Reproducible, reviewable, no runtime cost.
//
// For every rule of every stylesheet imported by app/globals.css (except the Arena files):
//   light backgrounds (paper, card, chip)      -> Arena solid surfaces (by lightness)
//   dark text on such surfaces                 -> Arena ink / ink-2 / muted (by lightness)
//   status-coloured text (green/red/amber/blue) -> Arena status colours (by hue)
//   light hairlines                            -> Arena lines
// Saturated mid-tone backgrounds (chips, badges, accents) and their text are left alone,
// as are gradients, images, the court and the club colours. Usage (apps/game):
//   node scripts/generate-arena-overrides.mjs [--check]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Every production stylesheet: the ones app/globals.css imports and the ones components import directly.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (["node_modules", ".next"].includes(e.name) ? [] : walk(path.join(dir, e.name))) : e.name.endsWith(".css") ? [path.join(dir, e.name)] : []);
const files = [...walk(path.join(appDir, "app")), ...walk(path.join(appDir, "components"))]
  .filter((f) => !/arena/.test(path.basename(f)))
  .map((f) => path.relative(path.join(appDir, "app"), f).split(path.sep).join("/"))
  .sort();

const hexRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; } return { h, s, l }; };
const parseColour = (v) => {
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (hex) return hexRgb(hex[0]);
  if (/^white$/i.test(v)) return [255, 255, 255];
  const rgb = v.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?\s*\)$/i);
  if (rgb && (rgb[4] === undefined || Number(rgb[4]) >= 0.85)) return [rgb[1], rgb[2], rgb[3]].map(Number);
  return null;
};
const surfaceFor = (c) => { const L = lum(c); return L > 0.86 ? "var(--arena-solid-1)" : L > 0.74 ? "var(--arena-solid-2)" : "var(--arena-solid-3)"; };
const statusFor = (c) => { const { h, s } = hsl(c); if (s < 0.25) return null; if (h < 20 || h >= 340) return "var(--arena-neg)"; if (h < 55) return "var(--arena-warn)"; if (h < 170) return "var(--arena-pos)"; if (h < 260) return "var(--arena-info)"; return null; };
const inkFor = (c) => { const st = statusFor(c); if (st) return st; const L = lum(c); return L < 0.03 ? "var(--arena-ink)" : L < 0.09 ? "var(--arena-ink-2)" : "var(--arena-muted)"; };

/** Tiny CSS reader: returns [{ media, selector, decls: [[prop, value]] }], skipping keyframes and font-face. */
function rules(css, media = null) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (/^@media/.test(head)) out.push(...rules(body, head));
    else if (/^@(supports|layer)/.test(head)) out.push(...rules(body, media));
    else if (!head.startsWith("@") && head) out.push({ media, selector: head, decls: body.split(";").map((d) => d.split(/:(.*)/s).map((x) => x && x.trim())).filter((d) => d[0] && d[1]) });
    i = j;
  }
  return out;
}

const blocks = [];
for (const file of files) {
  const css = readFileSync(path.join(appDir, "app", file), "utf8");
  for (const r of rules(css)) {
    if (/(^|,)\s*(:root|html|body)\b/.test(r.selector)) continue;
    const decls = [];
    const bgDecl = r.decls.find(([p]) => p === "background" || p === "background-color");
    const bgColour = bgDecl ? parseColour(bgDecl[1].replace(/\s*!important$/, "")) : null;
    const bgLight = bgColour && lum(bgColour) > 0.42;
    const bgKept = (bgColour && !bgLight) || (bgDecl && /gradient\(/.test(bgDecl[1]) && ![...bgDecl[1].matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi)].every((m) => lum(hexRgb(m[0])) > 0.42)); // a mid/dark chip keeps its own text colour
    if (bgLight) decls.push([bgDecl[0], surfaceFor(bgColour)]);
    // Light paper gradients (every colour stop light) become the Arena card gradient.
    const gradient = bgDecl && /gradient\(/.test(bgDecl[1]) && !/url\(/.test(bgDecl[1]) ? bgDecl[1] : null;
    const stops = gradient ? [...gradient.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])|rgba?\([^)]*\)/gi)].map((m) => parseColour(m[0])) : [];
    if (gradient && stops.length && stops.every((c) => c && lum(c) > 0.42)) decls.push([bgDecl[0], "linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02)), var(--arena-solid-1)"]);
    // An ink block (dark emphasis on paper) becomes a raised Arena block; ink itself turns light in Arena.
    const bgValue = bgDecl ? bgDecl[1].replace(/\s*!important$/, "") : "";
    if (/^var\(--(game-ink|hm-text-primary|game-ink-soft)\)$/.test(bgValue)) decls.push([bgDecl[0], "var(--arena-raised)"]);
    // Text on the accent (now the club neon) must be the dark neon ink (Arena contrast rule).
    const onAccent = /^var\(--(game-signal|hm-accent|hm-accent-strong|club-neon)\)$/.test(bgValue);
    if (onAccent) {
      const colour = r.decls.find(([p]) => p === "color");
      if (colour && (/^(#fff(fff)?|white|#fff[0-9a-f]{3}|var\(--hm-accent-text\)|var\(--game-paper\))$/i.test(colour[1].replace(/\s*!important$/, "")))) decls.push(["color", "var(--club-neon-ink)"]);
    }
    for (const [prop, value] of r.decls) {
      const v = value.replace(/\s*!important$/, "");
      // Text painted with a paper/navy TOKEN was light-on-navy or dark-on-paper; in Arena both become dark.
      if (prop === "color" && /^var\(--(game-paper|game-card|hm-bg-app|hm-surface-\d|game-navy[\w-]*)\)$/.test(v)) { decls.push([prop, "var(--arena-ink)"]); continue; }
      const c = parseColour(v);
      if (!c) continue;
      if (prop === "color" && !bgKept && lum(c) < 0.32) decls.push([prop, inkFor(c)]);
      if (/^border(-(top|right|bottom|left))?-color$/.test(prop) && lum(c) > 0.42) decls.push([prop, "var(--arena-line)"]);
      if (prop === "fill" && lum(c) > 0.8) decls.push([prop, "var(--arena-solid-2)"]);
      // Component-local colour tokens (e.g. --xp-tone-ink, --kh-paper): ink/text tokens follow the ink mapping, surface tokens the surface mapping.
      if (prop.startsWith("--") && /(ink|text|fg)/.test(prop) && lum(c) < 0.32) decls.push([prop, inkFor(c)]);
      if (prop.startsWith("--") && /(bg|surface|paper|card|panel)/.test(prop) && lum(c) > 0.42) decls.push([prop, surfaceFor(c)]);
    }
    // Shorthand borders with a light colour (e.g. "1px solid #e2dfd4").
    for (const [prop, value] of r.decls) {
      if (!/^border(-(top|right|bottom|left))?$/.test(prop)) continue;
      const m = value.match(/(#[0-9a-f]{3,6})\b/i);
      if (m && lum(hexRgb(m[1])) > 0.42) decls.push([prop, value.replace(m[1], "rgba(255, 255, 255, 0.1)")]);
    }
    if (!decls.length) continue;
    // Keep !important wherever the paper rule used it, or the override could not win.
    for (const d of decls) if (r.decls.some(([p, v]) => p === d[0] && /!important$/.test(v)) && !/!important$/.test(d[1])) d[1] += " !important";
    const selector = r.selector.split(",").map((s) => `:root[data-theme="arena"] ${s.trim()}`).join(",\n");
    blocks.push({ media: r.media, text: `${selector} {\n${decls.map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`, file });
  }
}
let out = `/* GENERATED by apps/game/scripts/generate-arena-overrides.mjs -- do not edit by hand.\n   Arena Nights mapping of hard-coded paper-theme colours (${blocks.length} rules from ${files.length} stylesheets).\n   Hand-tuned Arena rules live in app/arena.css, which loads after this file. */\n`;
let last = null;
for (const b of blocks) {
  if (b.file !== last) { out += `\n/* ${b.file} */\n`; last = b.file; }
  out += b.media ? `${b.media} {\n${b.text.replace(/^/gm, "  ")}\n}\n` : `${b.text}\n`;
}
const target = path.join(appDir, "app/arena-overrides.css");
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== out) { console.error("arena-overrides.css is stale"); process.exit(1); }
  console.log("arena-overrides.css is up to date");
} else { writeFileSync(target, out); console.log(`${blocks.length} Arena override rules -> ${target}`); }
