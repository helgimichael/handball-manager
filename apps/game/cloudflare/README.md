# Handball Manager Alpha — Cloudflare deployment

The canonical dataset now loads in both Node and workerd. Local browser verification created, persisted and reloaded a complete Alingsås HK career through the Swedish access gate.

## Architecture and boundary

- The existing application uses Next.js 16.3.1 with `next build --webpack` and `next start`. `next.config.ts` sets neither `output: "export"` nor `output: "standalone"`.
- Browser saves do not make the application a static SPA. New Game calls query-dependent `/api/game-world/*` routes; the game also has dynamic route segments. A static Pages upload of `.next`, `.next/static`, or a guessed `out/` directory would lose required behavior.
- This configuration uses OpenNext on an independent **Worker**, `handball-manager-alpha`. OpenNext prepares standalone server output during its own build and writes `.open-next/worker.js` plus `.open-next/assets`.
- `nodejs_compat` is enabled. There are no custom-domain routes, account identifiers, KV/R2/D1 bindings, service bindings, or changes to any other Worker.
- Saves remain in the tester's browser. Choose a stable deployment origin; saves do not automatically move between different origins.
- Before builds, `scripts/generate-real-world-bundle.mjs` packages the 827 canonical JSON files under `data/real-world` into an ignored server-only TypeScript module. Invalid JSON or an empty source directory fails the build. Source data files are never rewritten.
- `HM_REAL_WORLD_DATA=bundled` in Wrangler selects immutable bundled reads. Ordinary Node development keeps live filesystem reads, including the existing editor workflow. All snapshot resolvers retain their existing calculations, date handling, and response shapes.

## Tooling and monorepo resolution

Run the commands below from `apps/game`, unless a different directory is stated. Use Node.js 22 or newer. A Linux build environment is preferable: OpenNext warns that native Windows is not fully supported, although this local Windows build succeeded.

The separate `cloudflare/package.json` and lockfile hold deployment tools only. The root lockfile and game dependency versions are unchanged. The game's prebuild, predev, pretest and pretypecheck hooks regenerate the server dataset. Install workspace dependencies from the repository root first:

```powershell
# Repository root
npm ci
# Then apps/game
npm ci --prefix ./cloudflare --workspaces=false --omit=peer
```

`--omit=peer` lets the adapter resolve Next/React from the existing workspace instead of installing a second application framework in the tooling directory. OpenNext detected the repository root and all six `@handball-manager/*` workspace dependencies built successfully.

The adapter is pinned to `@opennextjs/cloudflare@1.20.0`, whose declared Next.js range includes the installed 16.3.1. The latest adapter checked during setup, 1.20.12, requires `>=15.5.28 <16 || >=16.4.1`. The current game dependency is retained. Wrangler is pinned to 4.151.2.

The tooling lockfile was generated against npm's dependency graph at `2026-10-19T12:00:00.000Z`, avoiding an incomplete SDK publication later that day. Normal installs should use `npm ci` and the committed lockfile; no transitive version overrides are configured.

## Build variables and verification

`NEXT_PUBLIC_*` variables are compiled into the browser JavaScript. Set them in the **build** environment, not only in Wrangler runtime `vars`. The access code is a public client-side barrier, not a secret. Configure the reporting URL with an `https://` or `mailto:` destination, or leave it empty for the existing invitation-contact instruction.

```powershell
$env:NEXT_PUBLIC_ALPHA_ACCESS_CODE = 'HBL-ALPHA-2026'
$env:NEXT_PUBLIC_ALPHA_FEEDBACK_URL = ''
$env:HM_EDITOR_ENABLED = 'false'
$env:WRANGLER_SEND_METRICS = 'false'

# Standard game build (audit check)
npm run build

# Deployment build; invokes the existing game build with standalone output enabled
node cloudflare/node_modules/@opennextjs/cloudflare/dist/cli/index.js build --config wrangler.jsonc

# Local packaging verification only: does not upload or deploy
node cloudflare/node_modules/wrangler/bin/wrangler.js deploy --config wrangler.jsonc --dry-run --outdir cloudflare/dry-run

# Optional local runtime verification; no remote bindings
node cloudflare/node_modules/wrangler/bin/wrangler.js dev --config wrangler.jsonc --local --ip 127.0.0.1 --port 8787
```

For Cloudflare dashboard builds, set the root directory to the repository root so workspace packages and the root lockfile are available. The build command would be:

```sh
npm ci --prefix apps/game/cloudflare --workspaces=false --omit=peer && cd apps/game && node cloudflare/node_modules/@opennextjs/cloudflare/dist/cli/index.js build --config wrangler.jsonc
```

Use a clean build environment without unrelated local `.env.local` credentials. Do not skip the dataset generation step if invoking Next directly rather than through `npm run build`. For direct Node test commands, run `node scripts/generate-real-world-bundle.mjs` first on a fresh checkout.

## Observed verification — 2026-10-19

| Check | Result |
| --- | --- |
| Existing `npm run build` | Passed, including TypeScript |
| OpenNext build, Next 16.3.1 / adapter 1.20.0 | Passed; monorepo detected correctly |
| Wrangler 4.151.2 `deploy --dry-run` | Passed; 214 static assets; Worker 14,817.05 KiB raw / 2,088.05 KiB gzip |
| Local workerd `GET /` | HTTP 200; alpha gate title present |
| Local workerd `GET /api/editor/status` | HTTP 200; `enabled: false` |
| Native Node `snapshotWorldSquads("se_handbollsligan_herr")` | 14 clubs / 268 players |
| Local workerd squad snapshot for the same competition | HTTP 200; 14 clubs / 268 players |
| Local workerd gameplay-ratings snapshot | HTTP 200; 14 clubs / 268 matching rating profiles |
| Node/bundled parity regressions | Passed; squads, ratings, staff, tactics, dated identity and all recruitment pool squads |
| Full game suite | 2,429 tests passed |
| Chromium against local workerd | 8 tests passed, including New Game, IndexedDB persistence, reload, gate and feedback export |
| Live HTTP verification | Gate, editor status, squad and rating endpoints HTTP 200; full squad/rating JSON equals canonical Node JSON |
| Chromium against live Cloudflare | 2 tests passed; complete league data plus career creation, persistence and reload |

The server loaders still use canonical logical paths from `apps/game/lib/editor/paths.ts`. The `dataFiles.ts` read adapter normalizes these paths to dataset-relative bundle keys under workerd, so no repository files or `process.cwd()` layout are required on the deployed host. Directory discovery, source rosters, locked ratings, manual overrides, staff and identity files all use the same boundary. Paths outside the canonical dataset and missing files are rejected in bundled mode.

The generated JSON contents remain server-side; no raw dataset asset or browser import is added. Build and preview outputs, generated data, credentials and local tooling remain ignored.

## Deployment

Authenticate to the intended independent Cloudflare account, then deploy the rebuilt artifact explicitly with this configuration:

```powershell
node cloudflare/node_modules/wrangler/bin/wrangler.js login
node cloudflare/node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc
```

The target is `handball-manager-alpha` on the selected account's `workers.dev` subdomain. No custom-domain routing is configured. Re-run the snapshot and New Game browser checks after changing the canonical dataset or deployment toolchain.

Deployed and verified on 2026-10-19:

- URL: https://handball-manager-alpha.helgimichael.workers.dev
- Version: `1ede8292-64b6-4c4d-9304-c0a25af6ff12`
- Reported Worker startup time: 21 ms.

Re-run browser verification against either origin:

```powershell
$env:HM_QA_URL = 'http://127.0.0.1:8787' # Or the live URL above
npx playwright test e2e/worker-snapshots.spec.ts --workers=1
```

Sources: [Cloudflare OpenNext configuration](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/), [OpenNext CLI](https://opennext.js.org/cloudflare/cli), [Workers filesystem](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/).
