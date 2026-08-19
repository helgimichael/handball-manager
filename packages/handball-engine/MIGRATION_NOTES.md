# handball-engine migration notes (HM-0.2B)

Source: `starkvis-sim` @ commit `d62c7feb1952789af1ee259c75c3f4a95dd411c8` (branch `main`, clean working tree at time of copy).

All 38 files under `src/` (25 source files + 13 test files) are byte-for-byte identical to their `starkvis-sim` counterparts — verified with `diff -rq` against source at copy time. No import paths needed rewriting: the migrated slice used only relative imports in the source repo (the `@/` path alias is used exclusively by the excluded `src/ui/render/*` presentation files, which were not copied).

## What changed, and why (tooling only — zero logic changes)

- **Package tooling**: `tsconfig.json`/`tsconfig.test.json`/`eslint.config.mjs`/`package.json` are new files, not copies — the source repo's versions were Next.js-flavored (`eslint-config-next`, `next` plugin, `dom`/`jsx` libs) because SIM's repo also contains a React UI. This package has no React/Next/DOM dependency anywhere in the copied 38 files (confirmed: no `window`/`document`/`localStorage`/`navigator` references), so the new tsconfig drops the `dom`/`jsx` libs and the eslint config drops `eslint-config-next` in favor of plain `typescript-eslint`. Compiler options that affect program behavior (`target`, `strict`, `module`, `moduleResolution`, `esModuleInterop`, etc.) are preserved as-is from source.
- **`tsconfig.test.json`**: identical `include` pattern and `compilerOptions` overrides to source's version (same `outDir`, `module: commonjs`, `target: ES2022`), so the test-compilation behavior is unchanged.
- **`package.json` `test` script**: the exact same list of compiled test files, in the same order, as source's `package.json` — just re-rooted to this package.

## Deviations from the HM-0.1 manifest

None. All 38 files listed in the HM-0.1 audit's Section D.2 manifest were copied. `boardObjectVisuals.ts` was included per the manifest (it is a direct dependency of scenario construction) despite being marked REFERENCE ONLY for its STARKVIS-branded color values — those values were not touched, only carried along as-is since `scenarios/fieldFormationAdapter.ts`/`canonicals/fieldHandball/formations.ts` reference it.

## Verification result

- `node --test` (via `tsc -p tsconfig.test.json`): **163/163 passing** — matches the HM-0.1 audit baseline exactly.
- `tsc --noEmit`: clean.
- `eslint .`: clean, 0 errors / 0 warnings.
