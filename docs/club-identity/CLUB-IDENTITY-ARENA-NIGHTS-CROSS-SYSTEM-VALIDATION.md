# Club Identity & Arena Nights — Cross-System Validation (C6)

**Status: PASS.** 25 of 25 items are validated with production lifecycle and competition logic. No match results were mocked.

## How each item was validated

| Mode | What it covers | Evidence |
|---|---|---|
| **Quick sim** | Every fixture, including the manager's own, played by the production quick simulator (`simulateMatch` through the career lifecycle). Used for multi-season validation. | The soaks and season-transition tests |
| **Live** | A manager match played through the real UI: preview → kick-off → live Match Center → full time → press conference → front page → match report. | IFK Tumba vs V.Irsta, Svenska Cupen, 2026-08-20; final 29–26 to V.Irsta |
| **Unit / integration** | Production functions on real careers built by `createNewCareerState` from the bundled world snapshots | Named test files |
| **Browser** | The dev server with a QA career "Arena Testare" (IFK Tumba) in the local browser profile only | Responsive QA and live match |

**QA data separation:** QA saves were kept separate from tester and production data. The QA career exists only in the local browser profile on `localhost:3763`, and tests use in-memory careers. No production database, Alpha environment or tester save was touched.

## Results

| # | Item | How | Evidence | Result |
|---|---|---|---|---|
| 1 | New career | Browser + unit | New Game wizard → IFK Tumba career created (28 playable clubs offered, no B-team); `arenaShell.test.ts` and `bTeamHumanManager.test.ts` build careers via `createNewCareerState` | PASS |
| 2 | Existing v8 career | Quick sim | `clubIdentitySoak.test.ts` "LEGACY v8 career keeps its world, switches at its first rollover and survives 5 seasons"; save-compatibility suites (`saveMigration`, `alpha3SaveCompatibility`, `m10SaveIntegrity`, `clubWorldMembership`) in the full regression | PASS |
| 3 | Five-season progression | Quick sim | NEW (seed `club-identity-soak-new-b`) and LEGACY: 5 rollovers each, save/load after every rollover. Example NEW path: Tumba (Handbollsligan) → club change → Redbergslid (Allsvenskan) through 2031/32 | PASS |
| 4 | Promotion | Quick sim + unit | Soaks (9–12 promotions per rollover); `parentPrioritySeason` (next eligible club promoted); `transition.test.ts`, `gameContinuity*.test.ts` | PASS |
| 5 | Relegation | Quick sim + unit | Soaks; "A-team relegated into its B-team's division…" | PASS |
| 6 | Multiple B-team conflicts | Unit | "multiple B-teams in one division and two parent clubs…"; "cascading displacement through three divisions…" | PASS |
| 7 | B-team re-entry | Unit | "re-entry: …", "full cycle: … never oscillating" (C4.1) | PASS |
| 8 | Active cooperation restrictions | Unit | `cooperationEligibility.test.ts` (sha-locked rules unchanged); "next eligible is also ineligible: … the cooperation rule…" | PASS |
| 9 | Terminated cooperation | Unit | "only restricting relationships count: terminated, expired…"; re-entry after a TERMINATED restriction | PASS |
| 10 | International league membership | Unit | `worldPoolIntegration`, `worldCompetitions`, `clubWorldMembership` (full regression, all pass); B-team rules apply only to the Swedish pyramid | PASS |
| 11 | Club selection | Browser + unit | New Game club step (no B-teams); test 17 | PASS |
| 12 | Club change | Unit + quick sim | `m7dCareer.test.ts` (club change, guards); `clubChangeBlocker` refuses B-teams (tests 18–19); soak club change with unemployment window | PASS |
| 13 | Resignation | Unit | `m7dCareer.test.ts` (resignation, unemployment with a running calendar) | PASS |
| 14 | New appointment | Unit | `m7dCareer.test.ts` (offers, `acceptJobOffer`, handover); B-team appointment refused (18–19) | PASS |
| 15 | Dynamic club identity | Browser + unit | Club neon follows the managed club across the rail, Spine, front page, palette and matrix; clubless → orange; `activeClubIdentity` and `arenaTheme` tests pass | PASS |
| 16 | Save / load | Browser + unit | After a dev-server restart, "Fortsätt" on the title screen restored the QA career mid-season; the live match resumed at its state after navigating away and back; JSON round-trips in soaks and `parentPrioritySeason`; `saveRepository` and `portableCareerBackup` tests pass | PASS |
| 17 | Historical match integrity | Live + unit | The live match result (29–26) appears unchanged in the front-page lead, the Spine result pin and the match report; history tests (`clubHistoryCareerIntegration`, `matchHistory`) pass; soaks assert history intact across rollovers | PASS |
| 18 | Player identity integrity | Unit | Identity suites pass, except 4 player-data baseline failures that exist on the baseline commit and are unchanged (listed in the complete report); nothing in this work touches player data | PASS (baseline failures unchanged) |
| 19 | League sizes | Quick sim + unit | Sizes asserted after every allocation and rollover; `INVALID_TARGET_SIZE` guard in `seasonTransition` never triggered | PASS |
| 20 | Desktop UI | Browser | 26 routes at 1440: no overflow, no error overlay | PASS |
| 21 | Mobile UI | Browser | 26 routes at 375 (one pre-existing defect fixed) and 26 at 768 | PASS |
| 22 | Matchday | **Live** | Continue routed to tactics until the squad was set, then "Starta match" → preview → kick-off. During the match: shell `data-game-state=live`, Spine hidden, Continue locked ("Match pågår"), front-page lead "Matchen pågår" linking back, header banner "MATCH PÅGÅR · V.Irsta 0–0 IFK Tumba". Played to full time → Continue moved to "Presskonferens"; front page led with "Förlust · Cup — V.Irsta 29–26 IFK Tumba" | PASS |
| 23 | Training | Browser + unit | `assistantTraining.test.ts` (M6C/M6D assistant proposals) and all training suites pass; squad tray "Vila" / "Full belastning" wrote the real training-load setting and was reverted; the training route renders at all three widths | PASS |
| 24 | Scouting | Browser + unit | Scouting suites pass; scouting completions appear as Spine pins; the route renders at all three widths | PASS |
| 25 | Transfers | Browser + unit | Transfer suites pass; the transfer window open/close and agreed transfers appear on the Spine and season strip; the tray transfer-list uses the existing `listPlayer`, with confirmation; the route renders at all three widths | PASS |

## Prohibited actions: confirmation

None of the following happened during this work:

- push to origin;
- merge into main;
- deployment to Alpha or production (the wrangler run was `--dry-run`);
- changes to a production database;
- career resets or tester-save overwrites;
- deletion of unrelated worktrees;
- rewriting of historical results;
- changes to match-engine logic;
- removal of design recommendations (`verify-amendment.cjs`: 0 issues; `verify-club-identity.cjs`: 0 issues).
