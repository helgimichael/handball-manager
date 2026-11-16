// Club Identity C5: Arena Nights is the production theme and follows the active club identity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

test("Arena Nights is activated for the whole application and loads after every paper stylesheet", () => {
  assert.match(readFileSync(at("../../app/layout.tsx"), "utf8"), /<html lang="sv" data-theme="arena">/);
  const globals = readFileSync(at("../../app/globals.css"), "utf8");
  const imports = [...globals.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports.slice(-2), ["./arena-overrides.css", "./arena.css"]);
});

test("the generated Arena mapping of hard-coded paper colours is up to date", () => {
  const out = execFileSync(process.execPath, [at("../../scripts/generate-arena-overrides.mjs"), "--check"], { encoding: "utf8" });
  assert.match(out, /up to date/);
});

test("accent tokens resolve wherever a club identity is set (shell, wizard), never from a hard-coded club colour", () => {
  const css = readFileSync(at("../../app/arena.css"), "utf8");
  assert.match(css, /:root\[data-theme="arena"\] \[data-club-identity\] \{/);
  assert.match(css, /--hm-accent: var\(--club-neon\)/);
  assert.match(css, /--club-neon: #ff7a1a;/, "default (clubless / outside a career) is the orange fallback");
  const literals = [...css.matchAll(/--club-neon:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase());
  assert.deepEqual(literals, ["#ff7a1a"], "no club neon is hard-coded in the theme");
});
