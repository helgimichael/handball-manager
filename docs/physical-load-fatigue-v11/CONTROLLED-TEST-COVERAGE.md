# Controlled acceptance coverage

All 50 requested categories are mapped below. They are covered by 45 new physical tests, retained rotation/Intelligence tests, real execution trials, and full canonical proofs. Test counts and exit receipts are in VERIFICATION.json; rows are requirements, not a claim of 50 newly added unit tests.

| # | Requested category | Evidence |
|---:|---|---|
| 1 | stronger relevant endurance profile consumes less long-term reserve under same sustained workload | physical-load.test.ts: `endurance reduces reserve cost for identical absolute movement`.  |
| 2 | better recovery-relevant profile clears acute load faster if supported | physical-load.test.ts: `endurance and repeat sprint improve acute recovery at identical starting reserve`.  |
| 3 | stronger relevant physical profile tolerates repeated contact better where supported | physical-load.test.ts: `strength and contact balance tolerate the same actual contact better`.  |
| 4 | unrelated physical attribute does not magically protect all workload | physical-load.test.ts: `jump ability does not protect contact costs`.  |
| 5 | sprint costs more than low-intensity movement | physical-load.test.ts: `sprinting costs more than quiet movement`.  |
| 6 | hard acceleration/deceleration costs appropriately | physical-load.test.ts: `actual acceleration braking and direction change accumulate distinct work`.  |
| 7 | repeated sprint costs accumulate | physical-load.test.ts: `repeated sprints accumulate recent work and repeat exposure`.  |
| 8 | contact contributes load | physical-load.test.ts: `contact and jump impulses spend energy with no movement or position tax`.  |
| 9 | jump actions contribute where supported | physical-load.test.ts: `better jump ability lowers only actual takeoff cost`.  |
| 10 | low-intensity period permits recovery | physical-load.test.ts: `quiet live activity clears acute exertion without a reserve reset`.  |
| 11 | position itself does not directly apply energy tax | physical-load.test.ts: `position names cannot tax identical action history`.  |
| 12 | role action history creates actual workload difference | physical-load.test.ts: `wing transition history and pivot contact history have different measured channels`.  |
| 13 | M6/contact-heavy sequence behaves through contact load | physical-load.test.ts: `wing transition history and pivot contact history have different measured channels`.  |
| 14 | wing transition sequence behaves through sprint load | physical-load.test.ts: `wing transition history and pivot contact history have different measured channels`.  |
| 15 | backcourt duel sequence behaves through explosive load | physical-load.test.ts: `backcourt acceleration and direction history creates explosive exposure`.  |
| 16 | QUICK only costs more if it produces greater actual workload | physical-load.test.ts: `tactic labels alone never change condition under the same work`.  |
| 17 | aggressive defensive activity produces greater load through movement/actions | physical-load.test.ts: `larger defensive closeout activity costs more through physical work`.  |
| 18 | tactic label is never used as direct fatigue penalty | physical-load.test.ts: `tactic labels alone never change condition under the same work`.  |
| 19 | controlled style can preserve capacity through lower actual workload | physical-load.test.ts: `sprinting costs more than quiet movement`.  |
| 20 | clear unpressured chance remains high quality despite fatigue | physical-load.test.ts: `clear chances receive no additional difficulty fatigue loss`.  |
| 21 | difficult pressured shot is more affected by severe physical state | physical-load.test.ts: `severe repeated-state difficult execution is stronger than v1`.  |
| 22 | elite shooting ability still matters | physical-load.test.ts: `shooting technique protects difficult fatigued execution`.  |
| 23 | physical fatigue does not directly force miss | physical-load.test.ts: `fatigue does not directly force a shot outcome or consume randomness`.  |
| 24 | shot outcome remains probabilistic | physical-load.test.ts: `fatigued difficult throws remain stochastic and worsen spatial error without relabeling outcomes`. EXECUTION-TRIALS.json also retains canonical probabilistic shot outcomes. |
| 25 | simple unpressured pass remains robust | physical-load.test.ts: `simple short unpressured passes stay robust`.  |
| 26 | difficult pressured execution is more fatigue-sensitive | physical-load.test.ts: `difficult passing is more fatigue-sensitive than simple delivery`.  |
| 27 | strong technique protects execution | physical-load.test.ts: `elite technique protects reception under the same physical state`.  |
| 28 | low fatigue alone does not guarantee error | physical-load.test.ts: `low reserve alone never inserts a technical error`.  |
| 29 | fatigue error recorded with correct event semantics | physical-load.test.ts: `fatigued difficult throws remain stochastic and worsen spatial error without relabeling outcomes`. EXECUTION-TRIALS.json exercises actual PASS_RECEIVED / RECEPTION_FAILED; blocks, saves and offensive fouls are rejected as catch losses. |
| 30 | tired defender repeat recovery is weaker | physical-load.test.ts: `tired repeat recovery takes more real arrival time`.  |
| 31 | physically strong defender retains recovery longer | physical-load.test.ts: `physically strong defender retains recovery at the same fatigue state`.  |
| 32 | tired helper can arrive later through movement | physical-load.test.ts: `slower helper closes less space without changing duties or beaten flags`.  |
| 33 | fatigue never directly sets defender-beaten flag | physical-load.test.ts: `slower helper closes less space without changing duties or beaten flags`.  |
| 34 | handoff/recovery architecture remains intact | intelligence.test.ts: geometric handoff, persistent recovery purpose and unique line ownership; frozen defence/intelligence modules verified in SOURCE-PRESERVATION.json. |
| 35 | bench recovery clears acute load | physical-load.test.ts: `five bench minutes clear acute load but only restore limited reserve`.  |
| 36 | long-term energy recovery remains bounded | physical-load.test.ts: `halftime uses the same bounded rest exactly once`.  |
| 37 | substitute uses own physical profile | physical-load.test.ts: `incoming player retains own identity physical profile energy and history`.  |
| 38 | re-entry retains player identity/state | physical-load.test.ts: `incoming player retains own identity physical profile energy and history`.  |
| 39 | rolling substitutions deterministic | rotation-fatigue.test.ts: rolling exchange staging is deterministic and clears stale perception; N30 uses canonical rolling-rest commands. |
| 40 | free carrier acceptance preserved | rotation-fatigue.test.ts: a tired carrier still exploits an empty lane; intelligence.test.ts A free-carrier tests. |
| 41 | bind/pass preserved | intelligence.test.ts B help-arrival bind/pass and C helper-stays-home tests. |
| 42 | 2v1 preserved | intelligence.test.ts D: recognizing 2v1 does not itself force premature passing. |
| 43 | 3v2 preserved | intelligence.test.ts E: 3v2 retains a direct route rather than hardcoding a passing sequence. |
| 44 | intent persistence preserved | intelligence.test.ts: repeat reads preserve intention identity; decision tick alone does not break commitment; hysteresis tests. |
| 45 | deterministic | physical-load.test.ts: `full physical memory and RNG resume exactly through JSON`.  |
| 46 | save/load | physical-load.test.ts: `full physical memory and RNG resume exactly through JSON`.  |
| 47 | archive | Both league canonical proofs: exact archive hash after replay and JSON resume, idempotent result commit. |
| 48 | Match Center energy truth | Both league canonical proofs: Match Center energy, minutes, score, player and keeper facts equal archive truth. |
| 49 | no direct no-sub penalty | physical-load.test.ts: `score minute no-sub and empirical labels cannot change physical state`.  |
| 50 | no tactic fatigue multiplier shortcut | physical-load.test.ts: `tactic labels alone never change condition under the same work`.  |
