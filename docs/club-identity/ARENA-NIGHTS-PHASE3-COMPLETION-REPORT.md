# Arena Nights Phase 3 — Completion Report (The Living Club)

## Summary

| Area | Priority | Status | What the manager gets |
|---|---|---|---|
| A Club World | P0 | **Implemented** (CLB-02 C, CLB-02b A) | One page that says where the club stands, what is going well or badly, and what needs attention, with the season-by-season trajectory, board mood and three economy figures |
| B Player management | P0 | **Implemented** (SQD-01f B) | A half-court depth chart that shows squad gaps physically and filters the squad |
| C Scouting & recruitment | P0 | **Implemented** (REC-02 C) | One funnel from discovery to signature, with fog of war drawn as uncertainty and squad needs tagged |
| D Transfers & contracts | P0 | **Partial** (REC-04b A) | The bid placed against the scouts' value range, the club's counter and the budget. The deal drawer (REC-03c), market saved views (REC-03b) and the full Term Sheet (REC-04) remain |
| F Competition centre | P1 | **Implemented** (CMP-01a A) | Every table position carries its meaning (SM-slutspel, promotion, kval, relegation), with movement and gaps |
| G News & inbox | P1 | **Partial** (WLD-01 C) | A pinned "Att göra" tray of unresolved decisions |
| E Staff & delegation | P1 | **Deferred** | Staff appear in the Club Journal briefs; the org matrix (STF-01 A) needs a dedicated pass over the M6 delegation queues |

| | |
|---|---|
| Baseline | `ba61fd4` (stabilization), clean worktree verified |
| Commits | `cbf2279`, `bec4f84`, `f280ca9`, `fed9331`, `e491402`, plus the final reports commit |
| Pushed / merged / deployed | **No / no / no**. No production data touched, no career reset, no worktree deleted |
| Unchanged | Match engine, player development, competition rules and transitions, transfer economics and negotiation rules, scouting accuracy, CPU fairness, archives, B-team and cooperation rules, the six hubs and Week Spine, the Player Dossier, Tactical Board, Matchday and Live Match |

Reports: `ARENA-NIGHTS-PHASE3-RESEARCH.md`, `ARENA-NIGHTS-PHASE3-DESIGN-DIRECTIONS.md`, `ARENA-NIGHTS-PHASE3-IMPLEMENTATION-REPORT.md`.

## Canonical traceability (231 recommendations / 551 alternatives)

Every recommendation and alternative remains in `design-lab/experience-2027/data/surfaces.js`; nothing was deleted or simplified. The traceability table was regenerated (`ARENA-NIGHTS-SURFACE-TRACEABILITY.md`).

| | Before Phase 3 | After Phase 3 |
|---|---|---|
| Implemented | 34 | **40** |
| P0 implemented (of 55) | 21 | **24** |
| Intentionally deferred | 197 | 191 |
| Blocked | 0 | 0 |

| Status | Recommendations (this phase) |
|---|---|
| Implemented | CLB-02 (Club Journal, without the tiered clubhouse header art), CLB-02b, SQD-01f, REC-02 (without drag between lanes), CMP-01a (without the Hemma/Borta toggle), REC-04b |
| Partial | WLD-01 (tray only; threads and inline resolution remain) |
| Deferred | STF-01 family (staff), REC-03 / REC-03b / REC-03c / REC-04 / REC-04c / REC-04d (transfer centre and term sheet), CLB-01 / CLB-05 / CLB-06 families, CMP-01b–h, WLD-01a/b |
| Blocked | none |

No theme-only change is counted as implemented.

## Validation

| Gate | Baseline (`ba61fd4`) | Final |
|---|---|---|
| Full bounded node regression | 3,019 tests: 3,007 pass, 12 fail | **3,025 tests: 3,013 pass, 12 fail, 0 cancelled**; failures **identical** to `baseline-failures.txt`; +6 new tests, all passing |
| TypeScript | clean | clean |
| Scoped ESLint (all new and changed files) | — | no findings |
| `generate-arena-overrides --check` | up to date | up to date (new CSS uses tokens such as `--club-neon-ink`, so no paper-theme override touches the new surfaces) |
| Production build | exit 0 | exit 0 |
| Worker packaging | verified | verified (same 3 non-fatal `sharp` notices) |
| Wrangler `deploy --dry-run` | 17,538.67 / 2,677.07 KiB | exit 0, **17,572.14 KiB / gzip 2,686.07 KiB** (+33 KiB / +9 KiB gzip); nothing deployed |
| Playwright (full) | 32 tests: 17 passed | **33 tests: 28 executed, 18 passed, 11 failed, 1 skipped by design, 3 never ran**. The 11 failures are the same tests with the same causes as the stabilization baseline (classified in the E2E report); none is new |
| Phase 3 journey (`phase3-club-world.spec.ts`) | — | **pass** on the final build: club situation → squad need → recruitment pipeline → standings → inbox → home, then all five surfaces at 375 px with no overflow and no page errors |
| Arena journey | pass | **pass** on the final build |

**Browser QA on the existing "Stabilization QA" career (dev):**
- **Club Journal:** briefs ranked with real data. All 19 contracts end 2027-05-31 in the source data, so contracts is flagged red. "Tunt på H9" is amber; the board shows 65/100; the KPI trio and revenue mix render.
- **Squad:** the depth court filters the matrix (H9 → Blazevic).
- **Recruitment:** the pipeline shows real lanes and a "Ger bredd · högernia" tag.
- **Negotiation:** a real negotiation showed the range band (scouts 1 363–4 089 €, budget 34 690 €); the slider drove the fee field. The negotiation was then withdrawn.
- **Standings:** Allsvenskan zones and the legend render.
- **Phone (375 px):** all five surfaces have no horizontal overflow.

Screenshots: `docs/club-identity/phase3-screenshots/` (desktop and phone).

## Data integrity

- New models are pure, and the tests assert the career state is unchanged after reading: `clubJournal`, `pipeline`, `standingsZones`.
- No save-schema change. Existing careers open unchanged; the "Stabilization QA" career was used throughout and not reset.
- Fog of war: the recruitment board and range band read only knowledge-gated ranges. A test asserts that CA/PA are absent from the board's source.
- Competition zones come only from the verified rules; leagues without verified zones show none.

## Known limitations and next steps

1. **Transfer Centre (REC-03) and the full Term Sheet (REC-04):** the next P0 pass. Deal drawer, saved market views, and package builder with total cost.
2. **Staff (STF-01):** the org and responsibility matrix over the existing M6 delegation, with a staff regression pass.
3. **Inbox (WLD-01):** threads per entity and inline resolution of offers and decisions.
4. **Club Journal header art** at facility tiers: an asset pipeline (Blender is a candidate; not started to avoid unreviewed assets).
5. **Standings:** points ladder (CMP-01a B) and race chart (C) as toggles; the Hemma/Borta split.
6. **Pipeline:** drag between lanes, mapped to real actions only.
7. Eleven Playwright failures remain, all pre-existing and classified, with an owner decision needed on the match-speed specs.

**No production release without separate owner approval.**
