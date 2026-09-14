# V2 adaptive offence ? continuation and Human QA

Version `2.7.0-adaptive-offence.1`. Preserve this uncommitted working tree. No commit or push. The existing full-match ecosystem remains; see ECOSYSTEM.md for referee/passive, medical, population, coaching and clock scope. Older proof files describe older versions.

## Research and model

[HF Mitt coaching guidance](https://svenskhandboll.se/download/18.6dc283ee18abc78ffd160260/1695644805753/UBTK%20-%20HFmitt%20-%20Att%20vara%20kapten.pdf) describes starts that allow players to choose a finish, continue the pattern or break it. V2 therefore stores intentions and participant relationships, never a prescribed successful sequence.

[IHF continuity analysis](https://archive.ihf.info/en-us/ihfcompetitions/worldchampionships/men%E2%80%99syouthworldchampionships/ivmensyouthworldchampionship-argentina2011/technicalcorner/continuityofplayduringattackinnumericalsupe.aspx) shows a crossing, unsuccessful pivot block, recycling, another interval attack and weak-side continuation. A failed screen is a possible attacking development, not permission to fabricate screen contact.

[BBK HF's club playbook](https://www.laget.se/bbkhandboll-ledare/Document/Download/1353121/7803066) supplies the Swedish four-phase teaching example: uppspel, uppf?ljning, uppbyggnad and avslutning. This is a primary club example, not a claim that every federation uses identical terminology. [IHF teaching material](https://www.ihf.info/sites/default/files/2020-07/H%40S%20Booklet.pdf) supports off-ball movement, crossing, width and local numerical relationships.

The four offensive subphases are explicit state beneath the existing transition/established/restart game phase. Progress, recovered defenders, supporting waves and actual finishing opportunities determine phase. Phases may be skipped or revisited. Following waves trail the advancing ball; phase affects support depth and receiving utility. There is no four-stage mandatory script or new shot clock. The passive-warning observation threshold remains the documented modelling choice in ECOSYSTEM.md.

`offence.ts` owns CROSS, PIVOT_SCREEN, WING_TRANSITION, STRETCH_SHIFT and FREE. Candidate utility uses current defensive depth and gaps, actual eligible partners, skill and energy, tactical identity, tempo, numerical context, late score pressure, recent use and decayed results from released shots. Selection consumes no random draws. Recency is one term, not the sole selector. Four identities are BALANCED, COMBINATION, WIDTH and DIRECT.

Entries anchor distinct spatial relationships to actual player IDs. Existing persistent actions execute movement and ball flight. Cross partners exchange relative sides; pivot screens bind an inside relationship; wing transitions create a second line player while another back widens; stretch starts engage one side and retain the opposite outlet. FREE keeps player-led support. Immediate finishing opportunities, safer receivers, defensive collapse, denied lanes and switches can break or branch the intention. Missing players and restarts retire it. Plans do not interrupt already committed actions.

Model constants: eight-second relationship expiry, 1.2-second reconsideration gap, 0.6-second defensive read interval, ten recent entry calls, six recent restart outlets, decayed geometry-based shot value. These are simulation choices, not handball rules. Defensive recognition currently covers repeated crossing movement: three observed exposures plus a visibly moving committed partner permit a small skill-scaled lateral anticipation. Calls alone do not count as observed exposure. Other families elicit existing marking/help/contact responses and attack-side continuation reads; they do not yet have separate learned defensive recognition policies.

Restart outlets now consider lane, receiver fitness/skill, identity, length and recent use. They no longer always open through the right back. Broader paths exposed and repaired stale receiver selection after participant changes, sideline taker-centre spacing, and a defender pinned at the sideline during dead-ball preparation. Readiness, collision and preparation budgets are retained.

## Evidence and limits

`variation-baseline.json` is preserved before-change evidence; do not overwrite it with the current engine. `variation-audit.json` contains four complete 2?30-minute matches, seeds 1/2025 in both directions. Dominant first-five-action opening share fell from 31?52% to 14?19%; current distinct paths are 31?41. This proxy counts action starts in possessions that produced a shot, including restart PASS actions. It is not a measure of every possession or proof of human-perceived tactical quality.

Physical events separately require body displacement, actual relative crossing, a stationary executing screen at its intended location, a wing reaching the line relationship, or a completed ball reversal. The four ordinary runs show 33?40 completed crossings, 3?7 stationary pivot-screen establishments, 7?13 wing arrivals and 2?5 reversals each. Screen establishment is distinct from actual SCREEN_CONTACT; a call is not either. The relatively low completed screen/reversal frequency remains a specific Human QA focus.

`variation-proof.json` is generated by `scripts/prove-v2-variation.cjs`: final state/event hashes, exact save continuation from observed defensive recognition, physical relationship snapshots, and WIDTH/DIRECT full-match branches. Trust its top-level complete flag. Proof is run sequentially to avoid concurrent full-history memory pressure. Current core tests also exercise historical seek and immutable replay.

## Human QA

Open `/scenario-lab/match`, generate seed 2025 (then 1), test both attacking directions, and inspect the full timeline. The inspector shows offensive subphase, entry participants, current defensive response, moved participant count, physical establishment and recognition. Jump to ATTACK_ENTRY_SELECTED, ATTACK_RELATIONSHIP_ESTABLISHED, ATTACK_RESPONSE and DEFENSIVE_ENTRY_RECOGNIZED. Start playback several seconds before the selected event to judge how it develops. Branch from an early active tick with different attacking identities using Apply tactics and continue. Existing defence, tempo, substitution, timeout and medical controls remain available.

Compare whether the crossing exchanges matchups, the pivot actually plants before contact, the wing's inside movement preserves outside width, and weak-side release follows convergence. Compare early and later recognized crossings. Watch failed starts and player-led attacks, not only successful examples. Judge the combination across whole halves, fatigue, changing ends and reduced numbers. Scores are observations, not calibration targets.

No connected browser was available for visual playback verification in this session. Human visual acceptance remains outstanding; engine checks and app typechecking do not substitute for that verdict.

## Exact continuation / verification

Do not redo the variation implementation. Files involved: offence.ts, offence.test.ts, state.ts, structure.ts, coaching.ts, restarts.ts, actions.ts, core.test.ts, test-core.cjs, the variation audit/proof scripts and scenario-lab/match/page.tsx. Preserve unrelated match-QA, season-audit, .claude and temporary benchmark work.

Run from repository root, sequentially:

```
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/test-v2.cjs
npx tsc --noEmit -p packages/handball-engine/tsconfig.json
npx tsc --noEmit -p apps/game/tsconfig.json
node packages/handball-engine/scripts/audit-v2-variation.cjs
node packages/handball-engine/scripts/prove-v2-variation.cjs
```

Final verification: 72/72 core tests, 9/9 M1 tests, engine and app TypeScript checks, and git diff --check pass. The full-match proof has complete:true for four ordinary matches and four WIDTH/DIRECT branches. Every ordinary match resumes from an observed recognition with identical final state and event hashes. Ordinary matches record 45?65 defensive recognitions. Width branches produced 67?77 stretch starts; direct branches produced 70?72 FREE starts (both teams combined, including the shared pre-branch history). This is contextual identity evidence, not a prescribed distribution.

Status: materially richer full-match Human QA checkpoint, awaiting the user's visual verdict. No commit or push. No unfinished implementation step remains in this checkpoint. Continue from this version after QA; use the physical moments and traces to diagnose the next concrete qualitative issue rather than restarting variation work.
