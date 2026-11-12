# M6C/M6D — Assistant-led Training Planning

Status: **PASS — complete locally, not released.** Date: 2026-11-11 (Europe/Stockholm).

Branch: `feature/m6cd-assistant-training`. Worktree: `C:/DEV/WORKTREES/handball-manager/m6cd-assistant-training`.
Baseline main/Alpha commit: `455f3693788fced30428dc3e5ecc4d8731a8cbb2`. Main and origin/main remain at that commit. Existing Alpha Worker `06194a7c-b82d-4edc-bb60-0a10424d17c9` was not changed or redeployed. The local commit is recorded in the final delivery and `C:/DEV/QA/reports/handball-m6cd-training/local-commit.json`.

## Original approved scope

Read the original `C:/DEV/QA/reports/HM-ROADMAP-2026/ROADMAP-FINAL-v1.0.md`, M6C/M6D and its acceptance criteria, plus `NEXT-MILESTONE-RESULTS.md` on the retained roadmap-recovery branch. This delivery implements the selected training-planning responsibility, not a replacement roadmap or the other outstanding M6 responsibilities.

The original matrix defines Manager / Delegate / Advise, deterministic work, named responsibility, inbox audit and approval for important individual decisions. Existing training/development/medical execution, staff expertise, saved weeks, proposals and the M2 weekly manager loop were inspected and reused.

## Reused systems and missing connections

- Existing fixture-aware weekly templates and edit functions build the schedule. Matchdays stay empty and the day before a fixture is low-intensity preparation; the planner adds post-match recovery using the same day model.
- Existing training execution owns energy, workload, medical participation and responsible-coach resolution. Existing development stimulus and weekly resolution own progress and attribute changes. The planner never writes ratings, grants development or invents a new recovery model.
- Existing assistant/responsibility selection, proposals, approvals, audit entries and inbox events own the delegation workflow. Planning now occurs before daily training executes, so an automatically delegated Monday is effective that day.
- Existing optional delegation state stores drafts, selected individual recommendations and decisions. Optional week provenance records manual/assistant ownership. No save-schema bump, new persistence service or dependency was introduced.

## Implemented gameplay

1. **Three control modes.** Manager mode changes nothing automatically; the manager can still request advice. Advice produces a reviewable draft while retaining the active week. Delegate fills an unplanned week before execution. Existing stored/legacy/manually edited weeks are conservatively protected and require review.
2. **Staff-led assessment.** The actual responsible coach's physical coaching, match preparation and player-development expertise influence recovery thresholds and whether a targeted position-development session is selected. Session coaching uses the existing specialist quality and its existing bounds. Changing the assistant changes decisions and actual training consequences, not a fabricated growth coefficient.
3. **Squad needs.** The plan considers fixtures, energy, availability, the existing recovery ceiling from workload, positional depth, current individual focus and assessed development weaknesses. At most one normal session is redirected to eligible positional development; it does not add a free extra session.
4. **Important decisions stay with the manager.** Automatic targeted drills exclude KEY_PLAYER/FIRST_CHOICE players. Persistent individual load/focus changes are unchecked by default for every player and require explicit selection and approval, including protected players. Normal low/normal team training remains delegable.
5. **Review and edit.** The Training page displays the coach, reasons, week, individual advice, template/training objective, session type and intensity controls. Draft edits persist without changing the active schedule. The manager can select/edit individual instructions, approve or decline. The existing full schedule editor remains available after approval.
6. **Visible follow-through.** Responsibilities exposes training delegation and sends training proposals to their review screen. The weekly manager loop shows a pending training decision linked to Training. Decisions, applied weeks and named audit entries survive save/load. Training-session feedback continues to show what actually executed.
7. **Safety through normal rules.** Approval rechecks employer, week, fixture dates, selected players and standing instructions. Stale proposals fail atomically. Completed days/results are preserved; match/preparation constraints are enforced; departed staff cannot approve old proposals. Returning to Manager withdraws pending work without undoing executed training. Missing staff safely leaves control with the manager.

Individual load and focus remain standing instructions until the manager changes them; this is stated in the UI. Medical caps still apply even when a higher load is selected.

## Realistic multi-week career

A separate canonical IFK Tumba career began through the existing new-career initializer with four-week preseason, real squads/ratings/staff across the four Swedish leagues and the normal fixture package. The scripted manager used existing proposal edits/approval, assistant lineup selection, required conversations/board responses, press delegation, Continue and native V2 quick-result actions. No fixtures, results, budgets, players or development gains were injected. Repository saves and migration were exercised throughout.

| Result | Observed |
| --- | --- |
| Dates | 2026-08-20 → 2026-10-15 (56 days, nine ISO weeks touched) |
| Weekly plan reviews/edits/approvals | 9 |
| Native V2 manager matches | 10 |
| Repository save/load checks | 45 |
| Executed training/recovery days | 57 |
| Executed sessions | 39 |
| Recorded ordinary coaching quality | 0.907895–1.065789 |
| Immutable native archives checked repeatedly | 10, every hash retained |
| Persistent identities | All originals retained by ID; no duplicate IDs |
| Visible attribute increases | 0 |

The manager initially used advice, edited a session to low intensity and explicitly selected a reduced-load/technical focus instruction; later weeks used delegation. No visible attribute increase is promised simply for approving a plan. Existing fractional development accumulated and resolved weekly:

| Player | Sum of existing attribute-progress units | Last weekly resolution | Visible changes |
| --- | ---: | --- | ---: |
| David Blazevic | 52.5073 | 2026-10-11 | 0 |
| Jakob Magnusson | 13.7389 | 2026-10-11 | 0 |
| Gabriel Helgason | 51.2637 | 2026-10-11 | 0 |

These are development accumulators across attributes, not CA/PA changes or attribute points. They include ordinary match/training exposure; this single career is not a causal claim that every unit came from the new planner. A separate controlled staff comparison at 77% initial energy verifies a recovery-oriented competent planner preserves more energy than a weak planner's balanced week through the existing execution model. The tradeoff is fewer development sessions; no universal bonus was added.

## Production UI and existing-save compatibility

A separate local QA browser career, created through the normal wizard, verified advice, template and intensity edits, explicit individual selection, approval, responsibility settings, unchanged unselected instructions, fixtures/results, and actual save/reload. The final production build was rechecked on that same local QA career, including saving/reloading an edited draft before approval and saving/reloading the approved schedule. Screenshots cover 1600px and 960px. Zero browser page/console/hydration errors were observed. No existing tester career or browser profile was modified.

The retained M1.2 QA state from 2027/28 was also loaded as an in-memory copy only. Default training responsibility remained MANAGER. Training weeks/instructions, squads, contracts, ratings, fixtures, results, competition memberships, season history and 29 archive references remained identical. Original source SHA256 `500e9dc60981e04daf436514951613b165dab3b115d9d59527e33314e7cc23c6` was unchanged. This was not a live Alpha migration or deployment test.

## Validation

| Gate | Result | Evidence under C:/DEV/QA/logs/2026-11/ |
| --- | --- | --- |
| Focused regressions | **105/105 PASS**, including 14 new planner cases | m6cd-final-regressions.log |
| Workspace TypeScript | PASS | m6cd-workspace-typecheck-final.log |
| Scoped ESLint | PASS, 0 errors; 3 pre-existing unused-import warnings | m6cd-eslint-final.log |
| Final production build | PASS, 58 pages | m6cd-production-build-final.log |
| Realistic eight-week career | PASS | m6cd-career-scenario-final.log |
| Final production browser | PASS | m6cd-browser-final.log |
| Existing M1.2 save copy | PASS | m6cd-existing-career.log |
| Whitespace and scope | PASS; no data, package, engine or deployment configuration changes | git diff --check / changed-file review |

Focused suites cover new planning, existing delegation, weekly management, training scheduling/execution, development integration, daily tick, save repository, native V2 sessions and cooperation restrictions. The controlled congested-week case verifies both fixtures, their preparation days and post-match recovery. Other cases cover draft editing, medical limits, stale rejection, staff departure, replay guards, delayed approval, protected players, old saves and required manager stops.

Early QA harness corrections were staff snapshot import/type setup, JSON omission of undefined fields, normal wizard required fields, archive-reader argument order and identity comparison by ID rather than roster order after transfers. These were validation-tool corrections, not evidence of a game regression. The final completed runs above use the corrected harness. Failed exploratory logs/screenshots remain distinguishable from final PASS evidence.

Evidence: `C:/DEV/QA/reports/handball-m6cd-training/` contains career-scenario.json, compressed checkpoints, immutable archive files, browser-result.json, browser-final-result.json, screenshots and existing-career-compatibility.json. The repeatable source scenario is `apps/game/scripts/assistant-training-career.ts`.

## Remaining limitations and boundaries

- Only the approved training responsibility is delivered; opponent analysis, youth-intake, friendly/loan delegation and manager mobility remain separate original-roadmap residuals.
- Planning is a deterministic game assessment, not a calibrated human coaching model. Staff quality influences the existing execution model; no new development/rating coefficients were introduced.
- Only the current week is reviewed. Future weeks are assessed when they begin. Manually stored weeks are never silently replaced; request a fresh proposal after changing their fixture or instruction baseline.
- The career validation covers eight weeks, not a new full-season or multi-season audit. Visible attribute improvements did not occur during this run; accumulated development and weekly resolution were verified.
- No live Alpha verification is claimed. No push, merge, deployment, competition engine change, researched database edit or tester-career reset occurred. The task-owned local browser server was stopped after validation.
