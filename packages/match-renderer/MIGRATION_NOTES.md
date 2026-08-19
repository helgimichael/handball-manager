# match-renderer migration notes (HM-0.2C)

Source: `tacticalboard` @ commit `decdb226dc4d69b3a63fbc9a3c70c1fd839645aa` (branch `main`), the same commit HM-0.1's audit and Smiðja's own verified FIELD parity port (`smidja/docs/field/SMIDJA_FIELD_PARITY_REPORT.md`) traced. HEAD had not moved since HM-0.1 at time of this copy.

All 75 files under `src/ui/` are byte-for-byte identical to their `tacticalboard` `app/ui/` counterparts — verified with `diff -rq` against source at copy time. The relative directory structure (`ui/workspaces/tactics-board/**`, `ui/camera/`, `ui/design-system/`, `ui/theme/`) was preserved exactly to keep every internal relative import (e.g. `../../camera/Camera2D.ts`, `../../../design-system`) resolving unchanged.

## What changed, and why (tooling/environment only — zero source content changes)

- **`tsconfig.json`**: deliberately mirrors FIELD's own compiler options (`allowImportingTsExtensions: true`, no `noUncheckedIndexedAccess`, same `lib`/`target`/`jsx` settings) specifically so that **no import string needed rewriting** — unlike Smiðja's port (whose own tsconfig didn't set `allowImportingTsExtensions` and required stripping `.ts`/`.tsx` extensions plus ~7 non-null assertions), this package's tsconfig was set up to match FIELD's exactly, achieving a zero-edit copy.
- **`src/css-modules.d.ts`** (new file, not a copy): a standard ambient `declare module "*.module.css"` shim. FIELD's own repo gets this typing for free from Next.js's generated `next-env.d.ts`/global types; this package is a plain library (no Next app of its own), so it needs its own minimal type declaration for the 16 `.module.css` imports to typecheck. Does not affect runtime behavior.
- **`next` added as a devDependency**: solely so `next/image`'s type declarations resolve for `design-system/components.tsx`'s (unused-by-this-closure) `Avatar` component import — a typecheck-only requirement, not a runtime one. `next/image` is never invoked by any code path this closure actually exercises (only `StatusBadge` and `designSystemTheme` from that file are consumed downstream).
- **`eslint.config.mjs`**: plain `typescript-eslint` + `eslint-plugin-react-hooks` (registering `react-hooks/exhaustive-deps` so the source's own inline `// eslint-disable-next-line react-hooks/exhaustive-deps` comments resolve to a known rule instead of erroring as "rule not found") in place of FIELD's `eslint-config-next`, since this package has no Next-specific concerns of its own to lint against.
- **`package.json`**: new file, package metadata only.

No `.ts`/`.tsx`/`.css` file's content was modified in any way.

## Deviations from the HM-0.1 manifest

None. All 75 files from the HM-0.1 audit's Section D.1 manifest were copied verbatim (this corrected count already accounted for all 16 CSS Modules the original FIELD-agent pass under-counted at "72").

## Design-system/theme wiring

FIELD's own `TacticsBoardWorkspace.tsx` (explicitly excluded product-shell, not copied) applies `style={designSystemTheme}` on its root wrapper div — this is how the `--ds-color-*` CSS custom properties reach every CSS Module selector in the copied closure (`MasterCourt.module.css`'s `.floor { fill: var(--ds-color-surface) }`, etc.). Since that shell file isn't part of this package, **any consumer of this package must apply `designSystemTheme` (imported from `ui/design-system`) at its own root element**, exactly as FIELD's own shell does. The `apps/field-smoke-test` verification harness does this (see its `app/page.tsx`) and confirms it resolves correctly (`--ds-color-surface` computed as `#0A2A2B`, matching the SVG floor's rendered `rgb(10, 42, 43)`) — Smiðja's own port hit this exact failure mode once (commit `4d3fe60`, "black floor, invisible lines") before applying the same fix; this migration applied it proactively rather than discovering it live.

## Verification result

- `tsc --noEmit`: clean.
- `eslint .`: clean, 0 errors / 0 warnings.
- No test baseline exists in FIELD itself (0 test files at source) — see the verification harness (`apps/field-smoke-test`) for the DOM-level visual parity checks performed instead.
