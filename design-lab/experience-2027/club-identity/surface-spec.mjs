// Prints the canonical Design Lab spec for one or more surface IDs (read-only).
// Usage (repo root): node design-lab/experience-2027/club-identity/surface-spec.mjs REC-03 REC-03b
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(here, "..", "data", "surfaces.js"), "utf8"), ctx);
const surfaces = ctx.window.LAB_DATA.surfaces;
for (const id of process.argv.slice(2)) {
  const s = surfaces.find((x) => x.id === id);
  if (!s) { console.log(`# ${id}: not in the canonical inventory`); continue; }
  const rec = (s.alternatives || []).find((a) => a.key === s.recommendation);
  const { alternatives, ...rest } = s;
  console.log(`# ${id} — ${s.name} (${s.priority}, ${s.kind}) recommended ${s.recommendation}: ${rec?.name ?? "?"}`);
  console.log(JSON.stringify({ ...rest, recommended: rec, otherAlternatives: (alternatives || []).filter((a) => a !== rec).map((a) => `${a.key}: ${a.name}`) }, null, 1));
}
