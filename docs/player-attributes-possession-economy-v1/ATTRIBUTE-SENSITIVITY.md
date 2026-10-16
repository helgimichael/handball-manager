# Controlled attribute sensitivity

This developer evidence uses retained Allsvenskan production rating inputs, observed per-key p10/p50/p90 values and identical seeds. The JSON contains exact raw values, input/source hashes and every comparison. Rating provenance includes generated priors; real roster identity does not make those values measured athlete data.

Only the named attribute/group changes. The equal-physical technical profiles keep all eleven physical ratings fixed. Geometry, fatigue, technique and keeper changes are explicitly separated. Finite outcome rates are observations, with no forced monotonic target. No production source is changed.

Released shots advance through full canonical ticks, including released-shot perception, keeper flight reading, commitment, movement and deflections. The earlier development harness used only direct keeper movement and ball advancement after release; its flat keeper cells omitted canonical re-aiming and cannot establish attribute weakness. Those cells are superseded here. Final shot outcomes are mutually exclusive, and unresolved trajectories are excluded from conversion denominators. The JSON distinguishes parry events from parry outcomes and subsequent goals.

## Shooting

| Case | Tier | Context | Tired | Goals / resolved | Unresolved / trials | Spread | Pace |
|---|---|---|---|---:|---:|---:|---:|
| shootingTechnique | low | clear | false | 59/64 | 0/64 | 0.6974 | 24.526 |
| shootingTechnique | mid | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| shootingTechnique | high | clear | false | 64/64 | 0/64 | 0.4868 | 24.526 |
| shootingTechnique | low | clear | true | 51/64 | 0/64 | 0.8079 | 23.938 |
| shootingTechnique | mid | clear | true | 58/64 | 0/64 | 0.7026 | 23.938 |
| shootingTechnique | high | clear | true | 59/64 | 0/64 | 0.6395 | 23.938 |
| shootingTechnique | low | medium | false | 50/64 | 0/64 | 0.8381 | 24.526 |
| shootingTechnique | mid | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| shootingTechnique | high | medium | false | 58/64 | 0/64 | 0.5851 | 24.526 |
| shootingTechnique | low | medium | true | 49/64 | 0/64 | 1.0083 | 23.938 |
| shootingTechnique | mid | medium | true | 50/64 | 0/64 | 0.8863 | 23.938 |
| shootingTechnique | high | medium | true | 52/64 | 0/64 | 0.8122 | 23.938 |
| shootingTechnique | low | difficult | false | 53/64 | 0/64 | 0.8673 | 24.526 |
| shootingTechnique | mid | difficult | false | 55/64 | 0/64 | 0.7091 | 24.526 |
| shootingTechnique | high | difficult | false | 59/64 | 0/64 | 0.6143 | 24.526 |
| shootingTechnique | low | difficult | true | 49/64 | 0/64 | 1.0533 | 23.938 |
| shootingTechnique | mid | difficult | true | 51/64 | 0/64 | 0.9331 | 23.938 |
| shootingTechnique | high | difficult | true | 53/64 | 0/64 | 0.8599 | 23.938 |
| shootingPower | low | medium | false | 55/64 | 0/64 | 0.6800 | 22.789 |
| wingTechnique | low | wing | false | 64/64 | 0/64 | 0.8517 | 24.526 |
| shootingPower | mid | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| wingTechnique | mid | wing | false | 61/64 | 0/64 | 0.7780 | 24.526 |
| shootingPower | high | medium | false | 55/64 | 0/64 | 0.6800 | 25.684 |
| wingTechnique | high | wing | false | 58/64 | 0/64 | 0.7043 | 24.526 |

## Equal physical capacity, different technical profiles

| Case | Tier | Context | Tired | Goals / resolved | Unresolved / trials | Spread | Pace |
|---|---|---|---|---:|---:|---:|---:|
| equalPhysicalTechnicalProfile | low | clear | false | 57/64 | 0/64 | 0.6974 | 22.789 |
| equalPhysicalTechnicalProfile | low | clear | true | 50/64 | 0/64 | 0.8079 | 22.243 |
| equalPhysicalTechnicalProfile | low | difficult | false | 49/64 | 0/64 | 0.8794 | 22.789 |
| equalPhysicalTechnicalProfile | low | difficult | true | 45/64 | 0/64 | 1.0681 | 22.243 |
| equalPhysicalTechnicalProfile | mid | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| equalPhysicalTechnicalProfile | mid | clear | true | 58/64 | 0/64 | 0.7026 | 23.938 |
| equalPhysicalTechnicalProfile | mid | difficult | false | 55/64 | 0/64 | 0.7091 | 24.526 |
| equalPhysicalTechnicalProfile | mid | difficult | true | 51/64 | 0/64 | 0.9331 | 23.938 |
| equalPhysicalTechnicalProfile | high | clear | false | 64/64 | 0/64 | 0.4868 | 25.684 |
| equalPhysicalTechnicalProfile | high | clear | true | 59/64 | 0/64 | 0.6395 | 25.068 |
| equalPhysicalTechnicalProfile | high | difficult | false | 59/64 | 0/64 | 0.6058 | 25.684 |
| equalPhysicalTechnicalProfile | high | difficult | true | 54/64 | 0/64 | 0.8479 | 25.068 |

The same coherent low/median/high technical profiles also execute passing and catch/control encounters. All eleven physical ratings stay identical. Passing-signal cells vary the passer's technical group. Catch cells vary that group for both passer and receiver, holding their physical profiles and states equal. Actual release pace/scatter, catch risk, received/fumbled outcomes and sample counts are retained separately in JSON. Higher passing technique can also change delivery pace, so the catch outcome is a coupled execution observation.

| Tier | Difficult | Tired | Passing spread | Mean pass error | Catches / n | Failed catches | Centre catch risk |
|---|---|---|---:|---:|---:|---:|---:|
| low | false | false | 0.1134 | 0.0628 | 128/128 | 0 | 0.0000 |
| low | false | true | 0.1317 | 0.0730 | 128/128 | 0 | 0.0000 |
| low | true | false | 0.5684 | 0.3148 | 124/128 | 4 | 0.0063 |
| low | true | true | 0.7471 | 0.4137 | 122/128 | 6 | 0.0063 |
| mid | false | false | 0.0945 | 0.0523 | 128/128 | 0 | 0.0000 |
| mid | false | true | 0.1166 | 0.0646 | 128/128 | 0 | 0.0000 |
| mid | true | false | 0.4520 | 0.2503 | 125/128 | 3 | 0.0062 |
| mid | true | true | 0.6617 | 0.3664 | 124/128 | 4 | 0.0071 |
| high | false | false | 0.0661 | 0.0366 | 126/128 | 2 | 0.0000 |
| high | false | true | 0.0938 | 0.0520 | 124/128 | 4 | 0.0000 |
| high | true | false | 0.2773 | 0.1536 | 124/128 | 4 | 0.0059 |
| high | true | true | 0.5297 | 0.2933 | 117/128 | 11 | 0.0082 |

## Goalkeepers

| Case | Tier | Context | Tired | Goals / resolved | Unresolved / trials | Spread | Pace |
|---|---|---|---|---:|---:|---:|---:|
| keeperReaction | low | clear | false | 63/64 | 0/64 | 0.5658 | 24.526 |
| keeperReaction | mid | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperReaction | high | clear | false | 61/64 | 0/64 | 0.5658 | 24.526 |
| keeperExplosiveness | low | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| keeperExplosiveness | mid | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| keeperExplosiveness | high | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| keeperPositioning | low | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperPositioning | mid | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperPositioning | high | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperReading | low | clear | false | 63/64 | 0/64 | 0.5658 | 24.526 |
| keeperReading | mid | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperReading | high | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperHeight | low | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| keeperHeight | mid | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| keeperHeight | high | medium | false | 55/64 | 0/64 | 0.6800 | 24.526 |
| keeperClose | low | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperClose | mid | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperClose | high | clear | false | 62/64 | 0/64 | 0.5658 | 24.526 |
| keeperLong | low | difficult | false | 55/64 | 0/64 | 0.7091 | 24.526 |
| keeperLong | mid | difficult | false | 55/64 | 0/64 | 0.7091 | 24.526 |
| keeperLong | high | difficult | false | 55/64 | 0/64 | 0.7091 | 24.526 |
| keeperWing | low | wing | false | 61/64 | 0/64 | 0.7780 | 24.526 |
| keeperWing | mid | wing | false | 61/64 | 0/64 | 0.7780 | 24.526 |
| keeperWing | high | wing | false | 61/64 | 0/64 | 0.7780 | 24.526 |
| keeperPenalty | low | penalty | false | 60/64 | 0/64 | 0.4301 | 24.526 |
| keeperPenalty | mid | penalty | false | 59/64 | 0/64 | 0.4301 | 24.526 |
| keeperPenalty | high | penalty | false | 60/64 | 0/64 | 0.4301 | 24.526 |

Each cell records how many trials emitted an actual KEEPER_FLIGHT_READ. The preflight reach probe is a separate deterministic signal; it does not stand in for the actual save response.

## Passing and control

Individual PASSING cells record canonical executePass scatter/error. BALL_HANDLING and coherent technical-profile catch cells resolve actual released flights with fixed staged catch bodies. Failed catches remain RECEPTION_FAILED; interceptions remain INTERCEPTION. No shot block or offensive foul is relabelled as a technical error. Simple unpressured catch cells can have zero risk in every tier because difficulty remains below the existing control threshold. These catch cells isolate execution rather than collective moving-receiver AI.

## Defence and decisions

Feints resolve the real duel against paired defenders. BALL_WINNING is tested across the same absolute lane offsets and throw seeds with a ready PRESS defender. Reached frontal containment is a legal/spatial contract; the same legal contact can hold at every attribute tier. Defensive positioning/covering change the approach/helper destination. Decision cells expose option capability/risk and reading time; a changed rating need not change the best option. Pure decision reads are checked for non-mutation.

## Physical capacity and real roster examples

Each existing physical key is varied individually under the same 120-second velocity history, the same fatigued recovery task and ten-second rest. Real roster examples select the ID-sorted median of each position, preserve their own complete attribute profile, and run the same clear/difficult encounters. These descriptive examples do not isolate one attribute.

## Limits

There is no dedicated dribble-mistouch or lost-dribble uncertainty category to test. BALL_HANDLING supports reception control and perception, while rule handling remains state based. Contact ability is not a contact-success dice roll. Keeper-positioning comparisons start in the same set body position, so they chiefly expose the existing reading/anticipation link. Source ratings absent from the bridge are reported separately by the attribute-path audit. These short cases establish specific implementation effects, not empirical league calibration or guaranteed scoring, error or win rates.

Run from apps/game: `node --import tsx scripts/prove-attribute-sensitivity.ts --trials 64`.
