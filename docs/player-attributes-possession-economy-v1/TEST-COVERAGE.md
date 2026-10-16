# Requested test-intent coverage

This maps the 39 intents in Parts 62–66 of the audit request to concrete regressions, controlled measurements and the canonical proof. A supported reader category is not evidence that a gameplay producer exists. Unsupported categories are marked explicitly rather than simulated by inventing outcomes.

## Receipt status and overlapping runs

The retained focused receipts and completed final engine checks show:

| Receipt | Recorded result | Scope and interpretation |
|---|---:|---|
| [focused-attributes.log](verification/focused-attributes.log) | 12/12, exit 0 | Original twelve attribute cases, before the two additional direct contracts described below. |
| [focused-economy.log](verification/focused-economy.log) | 133/133, exit 0 | Earlier combined focused run. Reuse its unchanged regression evidence; it predates subsequent pure-reader corrections. |
| [focused-reader-final.log](verification/focused-reader-final.log) | 43/43, exit 0 | Earlier reader subset, before the final recovery cases. |
| [focused-reader-recovery.log](verification/focused-reader-recovery.log) | 54/54, exit 0 | Current reader/economy cases after the recovery corrections. |
| [focused-presentation-recovery.log](verification/focused-presentation-recovery.log) | 11/11, exit 0 | Current Match Center presentation and result-event regression cases. |
| [core-final.log](verification/core-final.log) | 467/467, exit 0 | Complete standard core run, including all fourteen current attribute cases and both new direct contracts. |
| [v2-final.log](verification/v2-final.log) | 9/9, exit 0 | Standard V2 suite. |
| [domain-final.log](verification/domain-final.log) | 180/180, exit 0 | Standard engine/domain suite. |

These are overlapping suite runs, not independent sets of tests. **Do not add their counts to obtain a unique-test total.** The current attribute file contains fourteen tests: its original twelve plus direct assertions for intents 2 and 39. All fourteen names have passing markers in [core-final.log](verification/core-final.log), with exit 0 in `core-final.exit.txt`. The earlier 12/12 receipt remains historical subset evidence rather than a separate current fourteen-test run.

The controlled sensitivity CLI already completed with exit 0: [attribute-sensitivity.log](verification/attribute-sensitivity.log). [ATTRIBUTE-SENSITIVITY.json](ATTRIBUTE-SENSITIVITY.json) contains the actual paired outcomes and hashes. That measured experiment is separate from the number of regression tests.

## Source and proof key

| Key | Source |
|---|---|
| A | [attribute-economy.test.ts](../../packages/handball-engine/src/v2/core/attribute-economy.test.ts): fourteen specific attribute/workload contracts. |
| L | [ledger-economy.test.ts](../../packages/handball-engine/src/v2/core/ledger-economy.test.ts): actual transfer primitives, last-release/recovery classification and narrowly proven recalled-advantage continuation. |
| E | [possessionEconomy.test.ts](../../apps/game/scripts/lib/possessionEconomy.test.ts): independent episode/cause reconstruction, duplicate handling and passive observation. |
| F | [freeThrows.test.ts](../../apps/game/lib/matchCenter/freeThrows.test.ts): ordinary whistle definition, owner, identity, exclusions and provenance. |
| P | [presentation.test.ts](../../apps/game/lib/matchCenter/presentation.test.ts): live/cached/archive Frikast truth, rendered Statistics and turnover timestamp. |
| V | [physical-load.test.ts](../../packages/handball-engine/src/v2/core/physical-load.test.ts): retained physical-work, specific capacity, technique and fatigue contracts. |
| I | [identity.test.ts](../../packages/handball-engine/src/v2/core/identity.test.ts) and [productionMatch.test.ts](../../apps/game/lib/career/productionMatch.test.ts): specific rating bridge, CA/PA independence and passive wrapper observation. |
| S | [prove-attribute-sensitivity.ts](../../apps/game/scripts/prove-attribute-sensitivity.ts), with measured [JSON](ATTRIBUTE-SENSITIVITY.json): observed per-key p10/p50/p90, equal-physical technical profiles, actual canonical shot/keeper/catch/duel encounters and specific spatial/error signals. |
| C | [prove-economy-truth.ts](../../apps/game/scripts/prove-economy-truth.ts): completed [HBL proof](verification/hbl-canonical-proof.json) and [Allsvenskan proof](verification/allsv-canonical-proof.json), both exit 0. Complete observed/plain/resumed sessions, current results, archives and presentation facts agree; JSON continuation resumes at natural active ordinary free throws, HBL tick 3755/HOME and Allsvenskan tick 661/AWAY. |

## Attribute intents 1–10

| # | Requested intent | Concrete coverage and limit |
|---:|---|---|
| 1 | Relevant passing attribute affects a difficult pass | A: “PASSING specifically changes canonical delivery scatter and pace without changing shooting or running.” S: individual PASSING cells and coherent technical passing cells measure seeded execution error, spread, capability and pace. |
| 2 | Unrelated shooting attribute does not improve a pass | A: “unrelated shooting ratings cannot improve the same seeded difficult pass.” Only shooting power, placement and finishing change; the complete difficult-pass execution and RNG must remain equal. **Direct case passed within core 467/467.** |
| 3 | Relevant receiving attribute affects a difficult reception, if supported | A: “BALL_HANDLING protects the same difficult catch without changing pass skill or shot placement.” V: elite technique protects reception under the same physical state. S: actual reached catches produce PASS_RECEIVED or RECEPTION_FAILED; finite outcomes are retained without a monotonic-success target. |
| 4 | Ball-control attribute affects pressured control, if supported | **N/A for a dedicated dribble/breakthrough control-loss mechanism: no canonical producer exists.** BALL_HANDLING affects supported catch control and perception; A and S cover that narrower behavior. A failed catch is not relabelled as a dribble error. |
| 5 | Shooting attributes affect shot execution | A: actual shooting-power release pace; technique changes spatial execution in a fatigued difficult window. S: clear/medium/difficult, wing and fatigue cells retain real release/goal/save outcomes. |
| 6 | Keeper attributes affect saves | A: keeper branch specificity and reaction-limited flight reach. S: keeper cells use full canonical ticks and all 1,728 keeper trials emit KEEPER_FLIGHT_READ. Reaction goals allowed are 63/64, 62/64 and 61/64 across the measured tiers. Flat subtype cells are finite-context observations, not proof that those attributes are unused. |
| 7 | Defensive attributes affect containment/recovery | A: footwork changes the actual paired feint margin; reached legal frontal contact remains a spatial contract. S: positioning/covering alter approach/helper geometry. V: stronger physical capacity retains recovery arrival and actual helper movement under equal fatigue. No contact-success dice roll is claimed. |
| 8 | Physical attributes retain fatigue effects | V: endurance/work cost, repeat recovery, turning, contact/jump tolerance and bounded rest. S: each of the eleven existing physical keys is varied separately under the same locomotor/turning history. Contact/jump cost evidence is supplied by V and the retained v1.1 evidence, not inferred from a running-only trial. |
| 9 | Decisions differentiate players, if supported | A: “decision making changes option evaluation through a pure current-state read.” S: capability/risk and reaction/read time differ at identical geometry. The tested best option remains ATTACK_NEXT_DEFENDER at all three tiers; no changed-choice claim is made. |
| 10 | No hidden overall replaces specific attributes | I: “career capabilities use the actual attribute sheet and retain a neutral missing-data fallback independent of CA/PA”; CA/PA 1 versus 200 with empty attribute sheets yields identical profiles. I also verifies the engine consumes derived capacities rather than a raw overall block. Source coverage documents absent/unread schema keys. |

## Possession intents 11–20

| # | Requested intent | Concrete coverage and limit |
|---:|---|---|
| 11 | Normal free throw preserves possession | E: same-team ordinary free throws preserve the actual canonical ID. L: ordinary defensive free throw and completion retain the same attack. C resumes inside a natural active free throw and checks owner, ID, ledger attack and completion. |
| 12 | Goal changes possession | E: goal and opponent control form two episodes, with one goal ending. Existing production/core regressions execute goals; C checks complete canonical goals, session and result truth. |
| 13 | Turnover changes possession | E: a real opponent change transfers once, while repeating it is a no-op. L: actual technical restart transfer terminates the outgoing attack and does not stamp the benefiting attack with its opponent's violation. |
| 14 | Interception changes possession exactly once | L: actual interception transfer ends the losing ID; the following interception fact belongs to the winner. E: repeating the same-team change does not create another transfer. |
| 15 | Bad pass plus interception is one loss | E: “bad pass, interception and ownership change are one loss.” L verifies actual acquisition/transfer chronology. |
| 16 | Retained rebound preserves possession | E: retained shot rebound remains one possession with another shot. L: actual own physical recovery preserves both parried and blocked shot-bearing attacks. |
| 17 | Offensive foul transfers possession once | **N/A as modeled gameplay: OFFENSIVE_FOUL has no canonical producer.** Zero cohort entries cannot prove offensive-foul behavior or a successful transfer contract. No producer was added for this audit. |
| 18 | 7m possession semantics are correct | E: a seven-metre whistle creates neither an ordinary Frikast nor an extra attack; goal is one terminal, with a separate 7m flag. Existing core contact cases execute actual 7m awards. C checks canonical attempt/goal and archive denominators. |
| 19 | Half-end closes possession correctly | E: a half-end partitions a reused canonical ID, produces HALF_END and never awards a turnover. Existing continuous-match tests cover actual horns/final throws. |
| 20 | No duplicate possession transfer | E: real repeated change is a no-op; duplicate explanatory transfer events retain one terminal and are surfaced as integrity issues. L confirms outgoing-versus-incoming event ownership. |

## Loss-classification intents 21–28

| # | Requested intent | Concrete coverage and limit |
|---:|---|---|
| 21 | Bad pass classified correctly | E: bad pass out is one terminal cause. L: a new pass going out after a retained parry/off-target touch is a bad pass, rather than the earlier shot's outcome. |
| 22 | Interception classified correctly | E: one interception loss; L: actual winning control/event ordering, followed by a separate later technical loss if one occurs. |
| 23 | Failed reception classified correctly | E: fumble plus confirmed opponent loose recovery is one DROPPED_RECEPTION; own recovery retains the ball. A fumble incident alone is not a terminal loss. |
| 24 | Ball-control loss classified correctly | L: confirmed own shot recovery clears rebound context before a later opponent loose-control transfer. E distinguishes BALL_CONTROL_LOSS_UNSPECIFIED. **No attributed dribble/mistouch mechanism is claimed.** |
| 25 | Offensive foul separate | **N/A for an exercised canonical offensive-foul category.** The reader vocabulary reserves the category, but the engine supplies no authentic producer; it must not be manufactured from ordinary control losses or used to explain the cohort totals. |
| 26 | No double counting in aggregate losses | E: one terminal per episode; duplicate events and duplicate explanatory transfers do not add losses. L: last actual release/recovery determines the ending. Reconciled cohort guards require independent broad losses to equal canonical UI losses. |
| 27 | Retained-ball event is not a loss | E: retained fumble and retained rebound cases. L: actual parry/block recovery retains the attack; direct opponent recovery of the shot stays a shot outcome rather than an execution loss. |
| 28 | Match Center aggregate equals canonical broad loss count | Reconciled cohort guards compare economy and canonical result-reader counts. P verifies an aliased continuation's later turnover count and timestamp without mutation. C compares actual archived Match Center results to the finished canonical economy. |

## Free-throw intents 29–34

| # | Requested intent | Concrete coverage and limit |
|---:|---|---|
| 29 | Ordinary defensive free throw counted once | F: ordinary whistle credits details.owner exactly once; FOUL and FOUL_ASSESSED are evidence, not extra awards. Duplicated event/foul identities are deduplicated and conflicts become unavailable. |
| 30 | Repeated free throws in one possession count separately | F: two distinct foul whistles within one possession. E: two free throws remain one played possession and produce a two-throw chain. |
| 31 | Free throw creates no new possession | E: actual same-team award; L: ordinary free throw and completion retain the ID. C checks natural restart continuation after JSON. |
| 32 | Free throw followed by shot remains the same possession | E: repeated free throws followed by a shot/goal stay one attack. C checks a real played continuation after the naturally paused restart. |
| 33 | Free throw followed by turnover stays the same attack until turnover | E: “free throw after the last shot is in a shot-bearing episode but not before a later shot” follows the free throw with a later pass/transfer; it asserts one free throw before the actual loss and no fictitious later shot. L separately verifies actual transfer boundaries. |
| 34 | Exposed Match Center metric is canonical | P: live, incremental and archived Frikast counts match; the Statistics row appears once; unavailable legacy data hides the row; Overview gets no extra metric. C checks actual full-match archive totals and exact JSON continuation. |

## Fatigue/error intents 35–39

| # | Requested intent | Concrete coverage and limit |
|---:|---|---|
| 35 | Severe fatigue increases difficult technical-action risk where intended | V: difficult passing is more fatigue-sensitive than simple delivery; same-seed difficult throws remain stochastic and worsen spatial error. S separates fatigue, geometry and technique in real short encounters. |
| 36 | Simple unpressured pass remains robust | V: short unpressured pass has zero difficulty and bounded scatter. A: a centred simple unpressured catch has zero catch risk despite low reserve. S does not equate centre-risk probes with every real contact alignment. |
| 37 | Technical quality protects under fatigue | V: shooting technique and reception control protection at the same physical state. A: difficult tired catch and shot placement/spread. S: coherent technical passing error improves, but actual coupled catch rates are not uniformly monotonic. |
| 38 | Fatigue alone does not force an error | V: low reserve inserts no technical-error event; shot planning consumes no RNG and assigns no outcome. S retains actual stochastic catches/throws without forced success or failure targets. |
| 39 | Physical load does not directly increment turnovers | A: “physical work changes condition without directly creating a possession loss, event or random draw.” Repeated locomotor work and contact/jump load must consume reserve while preserving ownership, events, RNG and canonical broad-loss count. **Direct case passed within core 467/467.** |

## Canonical proof and limits

The proof chooses the first real ordinary WHISTLE_RESTART from retained fixture-zero core data, advances the actual production wrapper to that exact tick, and requires a live checkpoint inside its active dead-ball restart. It checks full JSON roundtrip identity, owner/current attack/canonical ledger/RNG/restart/free-throw counts, then compares uninterrupted observed, uninterrupted plain and resumed play. Event prefixes/suffixes, restart completion, the same attack's next played touch, final attack, counters, full session/result/archive hashes and Match Center facts must agree.

Both league receipts are complete and pass these checks. Their recorded source fingerprints match the current files. They also record observed/plain/resumed timings with the three developer observers and checkpoint overhead clearly identified. The separate [PERFORMANCE.json](PERFORMANCE.json) receipt is complete; these timing observations are not a claim of uniform device-wide responsiveness.

Passing a reader test does not establish official HBL technical-error equivalence, measured athlete skill accuracy, guaranteed superiority of every finite sample, or a gameplay producer for absent categories. Reused physical/identity cases and overlapping focused receipts remain regression evidence, not additional independent experiments.
