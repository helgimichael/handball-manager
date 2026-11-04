#!/usr/bin/env node
import { existsSync, renameSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptsDir, "..");
const repoRoot = path.resolve(appDir, "../..");

console.log("=== Building Handball Manager Cloudflare Worker ===");
console.log(`App directory: ${appDir}`);

// 1. Set required build environment variables
process.env.NEXT_PUBLIC_ALPHA_ACCESS_CODE = process.env.NEXT_PUBLIC_ALPHA_ACCESS_CODE || "HBL-ALPHA-2026";
process.env.NEXT_PUBLIC_ALPHA_FEEDBACK_URL = process.env.NEXT_PUBLIC_ALPHA_FEEDBACK_URL || "";
process.env.HM_EDITOR_ENABLED = process.env.HM_EDITOR_ENABLED || "false";
process.env.HM_REAL_WORLD_DATA = process.env.HM_REAL_WORLD_DATA || "bundled";
process.env.WRANGLER_SEND_METRICS = "false";

// 2. Ensure canonical real-world dataset bundle is generated
console.log("Generating canonical real-world dataset bundle...");
execSync(`node "${path.join(scriptsDir, "generate-real-world-bundle.mjs")}"`, {
  cwd: appDir,
  stdio: "inherit",
});

// 3. Phase 1: Build Next.js standalone application (requires sharp for webp blur generation)
console.log("Running Next.js standalone production build...");
process.env.NEXT_PRIVATE_STANDALONE = "true";
process.env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT = repoRoot;

execSync("npm run build", {
  cwd: appDir,
  stdio: "inherit",
  env: process.env,
});

// 4. Phase 2: OpenNext bundling without native Node C++ binary addons
// On Windows, sharp includes a native .node binary which workerd and esbuild cannot bundle.
function findSharpPaths() {
  const candidates = [
    path.join(repoRoot, "node_modules"),
    path.join(appDir, "node_modules"),
    "C:/DEV/WORKTREES/handball-manager/alpha-release-03/node_modules",
    "C:/DEV/WORKTREES/handball-manager/hm-playtest-improvement-03/node_modules",
    "C:/DEV/PROJECTS/handball-manager/node_modules",
  ];
  const realDirSet = new Set();
  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        realDirSet.add(realpathSync(c));
      } catch {
        realDirSet.add(path.resolve(c));
      }
    }
  }
  const toDisable = [];
  for (const nm of realDirSet) {
    for (const name of ["sharp", "@img"]) {
      const p = path.join(nm, name);
      if (existsSync(p)) {
        toDisable.push(p);
      }
    }
  }
  return [...new Set(toDisable)];
}

const sharpTargets = findSharpPaths();
const disabledPairs = [];

for (const target of sharpTargets) {
  const disabledTarget = `${target}.disabled`;
  try {
    renameSync(target, disabledTarget);
    disabledPairs.push([disabledTarget, target]);
  } catch (err) {
    console.warn(`Could not rename ${target}:`, err);
  }
}

try {
  console.log("Running OpenNext Cloudflare packaging (--skipNextBuild)...");
  const openNextCli = path.join(appDir, "cloudflare/node_modules/@opennextjs/cloudflare/dist/cli/index.js");
  execSync(`node "${openNextCli}" build --config wrangler.jsonc --skipNextBuild`, {
    cwd: appDir,
    stdio: "inherit",
    env: process.env,
  });
} finally {
  // Always restore any disabled sharp paths
  for (const [from, to] of disabledPairs) {
    if (existsSync(from)) {
      try {
        renameSync(from, to);
      } catch (err) {
        console.warn(`Warning restoring ${to}:`, err);
      }
    }
  }
}

// 5. Post-build middleware manifest verification and bypass
/**
 * Cloudflare workerd runtime compatibility for Next.js getMiddlewareManifest:
 *
 * In Next.js 16+, NextNodeServer.getMiddlewareManifest() executes:
 *   require(this.middlewareManifestPath);
 *
 * In Cloudflare Workers (workerd), esbuild compiles this to an unsupported dynamic require:
 *   Error: Dynamic require of "/.next/server/middleware-manifest.json" is not supported
 *
 * When an application genuinely has NO custom middleware (manifest.middleware is empty),
 * returning null from getMiddlewareManifest() eliminates the runtime crash while preserving
 * standard routing and RSC streaming hydration.
 *
 * Safety boundary: If custom middleware is ever introduced, Object.keys(manifest.middleware)
 * will be non-empty, and this bypass will safely skip to prevent silently breaking middleware.
 */
function patchOpenNextMiddlewareManifestBypass(targetDir) {
  const middlewareManifestPath = path.join(targetDir, ".next", "server", "middleware-manifest.json");
  if (!existsSync(middlewareManifestPath)) {
    throw new Error(`Cannot locate middleware manifest at: ${middlewareManifestPath}`);
  }

  const raw = readFileSync(middlewareManifestPath, "utf-8");
  const manifest = JSON.parse(raw);
  const middlewareEntries = manifest && typeof manifest === "object" && manifest.middleware
    ? Object.keys(manifest.middleware)
    : [];

  if (middlewareEntries.length > 0) {
    console.log(
      `[OpenNext Cloudflare] Application has active middleware (${middlewareEntries.join(", ")}); skipping bypass.`
    );
    return;
  }

  const handlerPath = path.join(
    targetDir,
    ".open-next",
    "server-functions",
    "default",
    "apps",
    "game",
    "handler.mjs"
  );

  if (!existsSync(handlerPath)) {
    throw new Error(`Cannot locate handler.mjs at: ${handlerPath}`);
  }

  let code = readFileSync(handlerPath, "utf-8");
  const target = "getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}";
  const replacement = "getMiddlewareManifest(){return null}";

  if (code.includes(target)) {
    code = code.replace(target, replacement);
    writeFileSync(handlerPath, code, "utf-8");
    console.log(
      "[OpenNext Cloudflare] Successfully applied getMiddlewareManifest() bypass (verified application has 0 custom middlewares)."
    );
  } else if (code.includes(replacement)) {
    console.log("[OpenNext Cloudflare] getMiddlewareManifest() bypass already in place.");
  } else {
    console.warn("[OpenNext Cloudflare] Note: target getMiddlewareManifest pattern not found in handler.mjs");
  }
}

patchOpenNextMiddlewareManifestBypass(appDir);

// 6. Verify built artifacts integrity
const handlerPath = path.join(appDir, ".open-next/server-functions/default/apps/game/handler.mjs");
const workerPath = path.join(appDir, ".open-next/worker.js");

if (!existsSync(handlerPath) || !existsSync(workerPath)) {
  throw new Error("Build verification failed: missing .open-next artifacts.");
}

const handlerCode = readFileSync(handlerPath, "utf-8");
const problematicDynamicRequire = "getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}";

if (handlerCode.includes(problematicDynamicRequire)) {
  throw new Error("Build verification failed: handler.mjs still contains unsupported dynamic require for middleware-manifest.");
}

console.log("=== Cloudflare Worker Build Successfully Verified ===");
