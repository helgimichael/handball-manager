# Match Engine Realism v2 checkpoint

Started from `aedf868` (Game Experience v1.1 acceptance), without restarting or redesigning the approved game. The original working tree contained twelve V2 ecology files and three unrelated QA files. Their binary diff and SHA-256 inventory were saved locally before any edit, in `.tmp/match-realism-v2/pre-existing-working-tree.patch` and `pre-existing-file-hashes.json`.

The exact twelve pre-existing engine files were reviewed and preserved in local commit `39e1dae` before realism implementation: `actions.ts`, `core.test.ts`, `defence.test.ts`, `defence.ts`, `ecology.test.ts`, `engage.ts`, `interactions.ts`, `offence.ts`, `pivot.ts`, `restarts.ts`, `space.ts`, `structure.ts`. The baseline was measured on these bytes; its source fingerprints preserve the dirty starting state even though its recorded HEAD was `aedf868`.

Original unrelated changes in `apps/game/app/match-qa/page.tsx`, `apps/game/lib/matchQa/qaHarness.ts`, and `apps/game/scripts/season-audit.ts` stay outside this batch. Original untracked `.claude/`, `apps/game/.tmp-final-benchmark.ts`, and `docs/audit/` also stay outside it.

The Motion worktree at `C:/Users/helgi/Documents/STARKVIS-HELA/handball-motion-lab`, checkpoint `197d2a8`, is read-only donor context. Both pre-existing stashes are retained. Motion is not imported as a runtime or exposed as an engine switch. Game Experience v1.1 layout/components are frozen; the only production application change is its canonical V2 session/profile/archive bridge.

Commits are local. No push is authorized or performed. Git automatic maintenance is disabled for these commits so unrelated stashes and worktree maintenance stay untouched.

## Baseline

Fifty independent actual Allsvenskan career fixtures, fixed save-seed recipes and pinned real squad/rating inputs. All completed. The canonical session creates observed frames and events; no fast engine or synthetic result is substituted. Input SHA-256: `37b2f9ee4648ede1a422549fb680bad5c172ebdf70c77f65334d2e6487ab0347`.

The baseline's 81.24 goals/game included 455 goals from 1,715 attempts beyond 15 m. A goalkeeper temporarily away from its area was treated as an empty goal even while still on court. That defect and very rapid recycling made aggregate scores look lively while producing implausible play. The first corrective pilot also exposed stalled loose-ball responsibility; that evidence is retained rather than excluded.
