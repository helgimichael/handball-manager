# Ball-loss taxonomy and canonical presentation truth

This audit separates an attacking possession ending, a physical pass/catch incident, and a technical rule violation. They are different units. Final HBL/Allsvenskan cohort values belong in [ECONOMY.json](ECONOMY.json) and [POSSESSION-ECONOMY.md](POSSESSION-ECONOMY.md); this document defines their meaning and records the reader bugs found before the final cohorts.

## What Match Center's Bollförluster counts

`apps/game/lib/career/productionMatch.ts:resultFromSession` reads `core/ledger.ts:ledger`. For each team, `turnovers` is the number of played ledger records belonging to that team whose final `ending` maps through `lossClassOf` to a loss class. The result reader also creates exactly one aggregate `TURNOVER` timeline item per such record. Match Center's **Bollförluster** displays this stored/live result value.

It is therefore a **broad attacking possession-loss count**, including intercepted passes and open-play loose-ball losses. It is not a count of every failed reception, every defensive touch, every possession-change event, or official registered technical errors.

One actual interception may produce `POSSESSION_CHANGED`, `BALL_CONTROLLED`, `INTERCEPTION` and contest facts. Those facts explain one transfer; they do not add several losses. The terminal transfer is recorded against the losing possession ID. The later `INTERCEPTION` event is recorded against the winning team's new ID. The corrected reader respects that ordering, including events sharing the same tick.

An attack can shoot, recover its rebound, and subsequently lose a pass. Its final loss counts once in the broad UI total. `ledger.nonShotLoss` deliberately excludes records with any earlier `SHOT_RELEASED`; it is a narrower **lost-without-a-shot** diagnostic. Adding broad losses to shots is not a valid possession counter because shots can be retained and these units can overlap.

Goals, held saves, defensive recoveries of shot rebounds, blocks and wide shots are shot outcomes, not broad ball losses merely because the defending side next controls the ball. A defensive free throw retaining the attacking team's ball is not a loss. Halftime/fulltime are not losses.

### Existing ledger classes

| Ledger loss class | Terminal endings mapped into it | What it establishes |
| --- | --- | --- |
| `TECHNICAL_TURNOVER` | `TECHNICAL_VIOLATION`, `PASSIVE_PLAY`, `OFFENSIVE_FOUL` | A rule/attacking-foul category in the reader; the last member has no current canonical producer. |
| `INTERCEPTION` | `INTERCEPTION` | Confirmed opponent control of a pass, established by the outgoing transfer reason `Intercepted`. |
| `DUEL_LOSS` | `DUEL_LOSS` | An open-play loose ball recovered by the opponent. This label does not establish a dribble error or a failed one-on-one action. |
| `RECEPTION_FAILURE` | `RECEPTION_FAILED` | A residual non-shot opponent-control ending. The ending label alone does not prove that the named `RECEPTION_FAILED` event occurred. |
| `BAD_PASS_OUT` | `BAD_PASS_OUT`, `OUT_OF_COURT` | A non-shot boundary ending. Specific defensive deflection/fumble provenance is retained separately when supported. |

The player table's **Fel** is another definition: `model.ts:playerRows` counts explicit `TECHNICAL_VIOLATION` and `OFFENSIVE_FOUL` events for a player. Current technical rule violations are represented through restart/transfer reasons, and neither named event has a current core producer. Zero in that column is not evidence that the player committed no pass/reception error, nor that the team committed no rule violation. No additional player-error attribution is invented in this audit.

## Developer decomposition: exclusive causes of confirmed losses

`apps/game/scripts/lib/possessionEconomy.ts` independently checks terminal ownership evidence. It partitions canonical IDs at actual period endings, excludes and reports no-touch procedural fragments, and records raw-ledger comparisons and classification disagreements. A same-team free throw/restart or retained rebound stays within its attacking episode. The taxonomy assigns at most one cause to each reconstructed loss.

| Developer category | Required evidence / interpretation | Availability |
| --- | --- | --- |
| `INTERCEPTION` | Outgoing confirmed opponent-control transfer with reason `Intercepted`. Global pass-action linkage can find the incoming interception fact despite its different possession ID. | Supported. |
| `BAD_PASS_OUT` | Confirmed non-shot boundary loss without a more specifically supported terminal fumble/deflection cause. | Supported boundary outcome; not proof of exclusively poor throwing execution. |
| `DROPPED_RECEPTION` | Named `RECEPTION_FAILED` in the terminal ball episode followed by confirmed opponent transfer, with no intervening same-team control. | Supported reception-fumble loss. |
| `DEFLECTED_PASS_RECOVERED` | Named defensive `PASS_DEFLECTED` in the terminal ball episode followed by opponent transfer. An earlier retained deflection does not qualify. | Supported defensive deflection followed by loss. |
| `BALL_CONTROL_LOSS_UNSPECIFIED` | Confirmed open-play loose-ball transfer with insufficient specific fumble/deflection provenance. | Supported transfer; exact technical cause remains unspecified. |
| `FAILED_RECEIVE_UNSPECIFIED` | Residual confirmed non-shot opponent control, including a goalkeeper collecting a pass/loose pass rather than a shot. | Supported transfer; a missed receiving offer, poor throw and other control causes cannot always be separated. |
| `TECHNICAL_RULE_VIOLATION` | Confirmed restart awarded against the attacking team for a supported technical reason, such as excessive steps, holding time, illegal takeoff/grounded shot, landing with the ball, or restart delay/organisation. | Supported rule ending. Not a pass-execution-error measure. |
| `PASSIVE_PLAY` | Actual passive-play event/transfer reason. | Supported; reported separately from execution errors. |
| `OFFENSIVE_FOUL` | Would require explicit offensive-foul evidence and an opponent transfer. | **Not currently modeled by a canonical producer.** A zero is an integration gap, not a measured low rate. |
| `OTHER` | A supported loss whose cause cannot be classified more specifically. | An explicit residual category, not permission to invent a technical cause. |

There is no separate current canonical event or probability path for a generic dribble/breakthrough control error. Physical breakthrough, feint, contact and loose-ball mechanisms must not be relabeled as such a path. Likewise, “dropped reception” and “failed receive” are not two errors to add for one incident. Unsupported distinctions stay unspecified.

### A fumble is not automatically a loss

`interactions.ts:advanceBall` evaluates reception risk only after a reachable catch. On failure it emits `RECEPTION_FAILED` and physically deflects the ball. Possession does not transfer at that event. Either team may recover it. `PASS_DEFLECTED` similarly records a defensive touch without automatically awarding the defence possession.

The audit follows the ball through subsequent acquisition. A same-team recovery is a retained incident, even if the attack later loses a different ball. Only the terminal unrecovered incident can explain that eventual loss. Pass incident flags may overlap—for example a fumble and a later recovery—but the exclusive possession-loss total does not.

Direct flight events retain the original pass `actionId`. Once the ball becomes `LOOSE`, `engine.ts:collectLoose` may record control/rebound facts under the claimant's receiving action instead. The developer report therefore also links the next chronological control event; absence of an original pass action on the recovery is not itself an unresolved ball or an additional loss. Cohort integrity and unresolved-outcome fields remain visible for inspection.

The developer `technicalExecutionCandidate` subset contains terminal `BAD_PASS_OUT + DROPPED_RECEPTION`. It is a candidate subset, not an established translation of official technical errors: a poor decision, difficult target, pressure or defensive involvement can contribute. Rule violations, passive play, interceptions and deflected-pass losses remain separate. The project's HBL registered-technical-error reference must not be compared directly to the broad UI total or declared equivalent to this candidate subset.

## Reader defects found and corrected

All changes below are pure event/result reading in `core/ledger.ts`, with a bounded turnover-timestamp fallback in `productionMatch.ts`. They do not change physical actions, decisions, RNG draws, trajectories, fatigue, fouls, shot/keeper probabilities, score or event production. Result turnover totals and downstream reporting may change because the same events are classified correctly. Historical stored archive results remain historical; the audit does not silently rewrite them.

1. **Winning interception stamped as a losing ending.** `acquire` first records the outgoing transfer and opens the winner's ID; `INTERCEPTION` follows under that new ID. The old reader treated that incoming fact as the new attack's ending. The reader now uses the outgoing transfer as the loss authority and ignores the incoming fact as an ending. This also prevents a stale interception tag from masking a later technical violation.
2. **Opponent's violation attached to the restart beneficiary.** `POSSESSION_AWARDED` is recorded under the losing ID, followed by `RESTART_AWARDED` under the new owner. A restart awarded to the team whose attack is being read no longer labels that team with its opponent's violation. Supported outgoing technical/passive reasons override stale prior shot tags.
3. **Retained shot context survived into later ball losses.** A new actual pass or confirmed own rebound control now clears the unresolved shot context. A subsequent pass out, interception, loose-ball loss or technical transfer is classified by its own terminal evidence; the earlier shot still exists in the record's shot count.
4. **Blocked shot collected by the goalkeeper falsely became a reception failure.** The first real HBL pilot exposed three definite instances: the last release was a shot, the ball was blocked, and the defending goalkeeper then obtained `Goalkeeper rebound control`. The keeper branch previously preserved wide/saved-shot endings but omitted blocked shots. It now preserves `SHOT_BLOCKED_REBOUND_LOST`; recovery of an actual pass by the goalkeeper remains a genuine non-shot loss.
5. **A provisional technical award reversed by recalled advantage split one protected attack.** Retained HBL full events exposed an already pending foul followed by a three-second award to the opponent and an immediate same-tick recall restoring the original team's free throw. The opponent never touched or played the ball. Shared pure `readPossessionContinuations` accepts only the exact foul-linked assessment/pending/recall/whistle/award-return chain, with identical tick and clocks and no intervening play. It aliases the restored ID to the original attack, excludes the superseded provisional award events from the read view, and assigns the whistle to that protected attack. It preserves the original canonical events and exposes accepted aliases, voided provisional IDs and ignored event IDs. Unrelated IDs, elapsed time or intervening opponent control do not qualify for this narrow rule.

The observed continuation was HBL fixture 9: original `possession-61503`, no-touch provisional `possession-63798`, restored `possession-63804`, foul `foul-63718`, tick 21932. The raw recall remains visible in integrity output with its reconciliation status. The correction applies to both the canonical result ledger and developer counter, so this recalled restart does not add a false UI technical loss or a second attacking possession.

If a merged attack eventually loses the ball under its restored ID, its turnover timeline minute now uses the record's final canonical tick. The result reader keeps its existing ID index and falls back to that tick only when the indexed event is earlier. This avoids incorrectly timestamping the later loss at the superseded provisional award; no global per-tick index or canonical-state change is added.

The independent terminal reader was also corrected after HBL inspection: a shot outcome is read only from the latest released shot's action and following evidence. An earlier retained save/block cannot turn a later distinct wide attempt into a saved/blocked ending; off-target keeper touches remain wide. This changes diagnostic terminal detail, not shot physics or keeper save totals. Final reconciled results are generated offline from retained full-event cores; the original replay reports and historical reader results remain available.

The superseded pilot is retained at [development/hbl-first-reader-pilot/match-000.json](development/hbl-first-reader-pilot/match-000.json). Its three disagreement keys were `1:possession-2520`, `1:possession-38625` and `1:possession-80422`. These are evidence of the defect and its discovery, not final cohort acceptance figures. The source-changing pilot was invalidated and final evidence must come from the corrected reader.

Focused coverage in `ledger-economy.test.ts` uses actual `changePossession`, `acquire`, `awardRestart` and `completeRestart` functions, preserving their real event ordering. It covers the incoming interception boundary, restart beneficiary, retained parry/block followed by later loss, direct rebound outcomes, goalkeeper block recovery versus pass recovery, ordinary free-throw continuation and non-mutation. The parent-controlled reader-final run passed **43/43**: 23 new ledger cases and 20 possession-economy cases. Final full-suite receipts belong in `VERIFICATION.json`.

No turnover probability, match pace, defensive aggression, technical rating, fatigue coefficient or empirical target was tuned to produce these corrections.

## Frikast is an ordinary defensive whistle, not every FREE_THROW award

One ordinary defensive free throw is one canonical `WHISTLE_RESTART` whose `details.kind` is `FREE_THROW`, credited to attacking `details.owner`. The event includes `foulId`, defender actor, attacker related ID, contact/contest identity, reason and assessed tick. `referee.ts:whistle` guards against issuing a second whistle for the same foul.

Count it once by event/foul identity. Two distinct whistles in one attacking possession count as two free throws and still one possession. `FOUL`, `FOUL_ASSESSED` and an advantage allowed to continue do not independently count. `SEVEN_METRE` whistles, administrative timeout/medical restarts, technical/passive rule awards to the opponent, and a final-signal retake of an existing throw do not add an ordinary defensive free throw.

`matchCenter/freeThrows.ts` performs this pure canonical read. Unknown/legacy provenance, incomplete mixed old/new foul protocols, invalid ownership, or conflicting duplicate facts return **unavailable**, not a fabricated zero. A revision marker alone is insufficient because resuming an older session updates the marker. A proven modern no-foul record can truthfully show zero.

The compact **Frikast** row appears only in Match Center → Statistik → Matchstatistik when the canonical count is available. Overview, other Match Center layout and archive/save/result schemas remain unchanged. The broad-loss explanation explicitly states that Bollförluster is wider than registered technical errors.

## Archive and Human-QA limits

Current played archives retain `PASS_RELEASED`, `PASS_RECEIVED`, `RECEPTION_FAILED`, `PASS_DEFLECTED`, `INTERCEPTION`, rebound/shot outcomes and explicit foul/advantage/whistle facts. That supports the carefully gated Frikast metric.

They omit the full `POSSESSION_CHANGED`, `POSSESSION_AWARDED`, `BALL_CONTROLLED`, `BALL_OUT`, `BALL_LOOSE`, `RESTART_AWARDED` and `RESTART_COMPLETED` stream. A compact archive alone therefore cannot reliably reconstruct every historical possession boundary, terminal technical reason, retained boundary/restart or loose-pass recovery chain. Stored broad result totals can be read, but they do not restore the omitted evidence.

The specific **Torslanda 20–33 IFK Tumba** archive/save was unavailable to this session: no enabled browser surface or exported workspace save/archive was found. [HUMAN-QA.json](HUMAN-QA.json) preserves that inspection and the user-supplied 43/49 shots and 27/20 broad losses. Exact team possessions, Frikast and subtype counts for that match are **unavailable**. Neither `43 + 27` nor `49 + 20` establishes its possession count.

The final source-identical full-event HBL/Allsvenskan replays can explain which mechanisms generate the same engine's broad-loss volume. They cannot establish exactly how many of the Human-QA match's 47 displayed losses arose from each mechanism or reader defect. That distinction must remain explicit in the closeout.
