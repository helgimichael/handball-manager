# Actual database player differentiation

Selections preserve actual database identities, complete raw branches and generated-prior/derived provenance. Archetypes are selected by relevant named attributes only; no ratings are changed. These are gameplay profiles, not verified real-athlete rankings. Each non-keeper has384 controlled passes/catches/carries/defensive and decision tasks,128 medium shots and one120-second physical work task. The keeper has128 identical medium shots faced.

| Profile | Player / position | Before → after goals /128 | Before → after difficult pass error m | After failed tired catches /384 | After challenged touches /384 | After recovery ticks |
|---|---|---|---|---|---|---|
| creator | Jim Gottfridsson / M9 | 125 → 126 | 0.0769 → 0.0976 | 12 | 5 | 21.000 |
| shooter | Gustaf Wedberg / H9 | 128 → 128 | 0.1507 → 0.1340 | 12 | 5 | 22.250 |
| defender | Marcus Ekman / M9 | 126 → 126 | 0.1823 → 0.1969 | 15 | 6 | 23.250 |
| physical | Melker Norrman / M6 | 115 → 116 | 0.2139 → 0.1993 | 17 | 6 | 23.625 |
| weakerTechnical | Albin Brauer / M9 | 93 → 90 | 0.3088 → 0.3612 | 32 | 26 | 29.625 |
| balanced | Oskar Orwallius / M6 | 102 → 99 | 0.2772 → 0.2345 | 29 | 13 | 27.125 |
| keeper | Adam Krantz / GK | 93 → 87 | N/A | N/A | N/A | N/A |

For the keeper, goals are conceded; for other profiles they are scored. Outcourt shot comparisons use the same central medium corpus, not each position’s normal shot mix. Profiles vary together, so these comparisons demonstrate roster identity and tradeoffs rather than identifying one causal attribute.

## Jim Gottfridsson — creator

Selected using PASSING, DECISION_MAKING, PLAYMAKING. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: PASSING=17; DECISION_MAKING=20; PLAYMAKING=20.

Same physical work gives reserve 0.949206 and acute 0.324364; after10 seconds rest, reserve 0.951079 and acute 0.193555. These are engine state units, not physiology. The physical result is exact before/after.

## Gustaf Wedberg — shooter

Selected using SHOOTING_PLACEMENT, SHOOTING_POWER, FINISHING. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: SHOOTING_PLACEMENT=20; SHOOTING_POWER=20; FINISHING=16.

Same physical work gives reserve 0.952116 and acute 0.336792; after10 seconds rest, reserve 0.954021 and acute 0.201533. These are engine state units, not physiology. The physical result is exact before/after.

## Marcus Ekman — defender

Selected using LATERAL_DEFENCE, DEFENSIVE_POSITIONING, COVERING. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: LATERAL_DEFENCE=14; DEFENSIVE_POSITIONING=16; COVERING=16.

Same physical work gives reserve 0.942921 and acute 0.368473; after10 seconds rest, reserve 0.944700 and acute 0.239727. These are engine state units, not physiology. The physical result is exact before/after.

## Melker Norrman — physical

Selected using ENDURANCE, REPEAT_SPRINT_ABILITY, STRENGTH. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: ENDURANCE=17; REPEAT_SPRINT_ABILITY=16; STRENGTH=19.

Same physical work gives reserve 0.952327 and acute 0.316872; after10 seconds rest, reserve 0.954232 and acute 0.186927. These are engine state units, not physiology. The physical result is exact before/after.

## Albin Brauer — weakerTechnical

Selected using PASSING, BALL_HANDLING, FINISHING. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: PASSING=9; BALL_HANDLING=9; FINISHING=9.

Same physical work gives reserve 0.928264 and acute 0.489289; after10 seconds rest, reserve 0.929885 and acute 0.353008. These are engine state units, not physiology. The physical result is exact before/after.

## Oskar Orwallius — balanced

Selected using PASSING, BALL_HANDLING, DEFENSIVE_POSITIONING. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: PASSING=13; BALL_HANDLING=12; DEFENSIVE_POSITIONING=14.

Same physical work gives reserve 0.943040 and acute 0.382313; after10 seconds rest, reserve 0.944850 and acute 0.251574. These are engine state units, not physiology. The physical result is exact before/after.

## Adam Krantz — keeper

Selected using REACTION, SHOOTER_READING, GK_POSITIONING. The diagnostic selection score is not consumed by gameplay. Relevant raw inputs: REACTION=15; SHOOTER_READING=16; GK_POSITIONING=18.

Existing tactical instructions and role tendencies create actions; specific attributes determine how those actions are valued and executed. There are no tactic×attribute bonuses or positional outcome quotas. Player selection and rotation can change passing security, shot execution, recovery and sustained work through these existing paths. A weaker profile still succeeds in many trials; the stronger profile remains context-dependent. Full-match scorer/role distributions and variance are measured separately in LEAGUE-REGRESSION.md. Exact hidden attributes remain confined to developer artifacts, with no player-facing UI changes.
