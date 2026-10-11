# Current engine benchmark

N = 2 completed matches. Engine outputs are measured samples, not real-world references.

```json
{
  "head": "5569b59cf3124ffcb533da67f70fd69afa06e6aa",
  "schemaVersion": "match-benchmarks/1",
  "identity": {
    "competition": "se_handbollsligan_herr",
    "season": "2025-26",
    "country": "SE",
    "category": "men-senior"
  },
  "profileVersions": [],
  "inputHash": "8773162275c76de70511889789a7a7bbc4e1b9cbb4c8b2c5030eb8cafee530a7",
  "referenceHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "recipes": [
    {
      "index": 0,
      "saveSeed": "match-realism-v2-canonical-2026:0",
      "managerClubId": "se_club_alingsas_hk"
    },
    {
      "index": 1,
      "saveSeed": "match-realism-v2-canonical-2026:1",
      "managerClubId": "se_club_amo_hk"
    }
  ],
  "tactics": null,
  "sourceFingerprints": [
    {
      "path": "/packages/handball-engine/src/v2/core/actions.ts",
      "sha256": "1d37e65aaf60e5efb2985a7b8998a51ef47171e7834eda1c4a653841dff739cf"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/backcourt.ts",
      "sha256": "00ab4e44f0520b83f771cf5dd8a0e1212b34272410e5027b856eabddebddc120"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/backcourtScenarios.ts",
      "sha256": "6137722469db2dc0a9567b9ff3bccd9c8d3f070e9db58bb93fe225cbccd655be"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/coaching.ts",
      "sha256": "b943276328e1df36f43173af08fe008d8376f419e5afae4aeae5e1466a28a599"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/condition.ts",
      "sha256": "f27c2d555258dbb0a56f562ed25e0416aa31a2e90640143ea7f7b874f92cad91"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/contact.ts",
      "sha256": "51c5c45017537c88bb92b43e46022ff2ba64210aab1895762ec57e30e10babd1"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/contactScenarios.ts",
      "sha256": "79e6fc938ed175948f2a2e3a0bdf4fff318e0eda44077d615be68011156e6901"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/continuous.ts",
      "sha256": "3bc0e25ee0474aab3162df83b5e228bcd5953ddc5b29622592e5fd5bfdda55c5"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/defence.ts",
      "sha256": "21deda90b4cdce41ef01ec50604ce67eaf53b7cb3b176678f350f2aa9cc72c23"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/engage.ts",
      "sha256": "d9667810754883bd80dc77d632a8e3ba2f479d20abd65c66ae104bdb71555221"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/engine.ts",
      "sha256": "06a491914837f8be7c3a28209a7843a2952a6f762bd7c3a967cf542597aba2ea"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/execution.ts",
      "sha256": "007e762da12b99b50cf90541895512657edafb4804a663eece2bd6726e844527"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/interactions.ts",
      "sha256": "288a4fd89a98f4f977a6d2e04db9fc36a084c8e60e7257186e6b152ed4dd8c97"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/ledger.ts",
      "sha256": "dd801ce6401a106d772eac46c5800eb46f218d34495f41ec1ff536aec24116c9"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/locomotion.ts",
      "sha256": "da0030eced1567a65a644af51dfb341191d67d3ccdf3ccc115dcfaf21beff3a5"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/match.ts",
      "sha256": "4ced473266ede54a0d9689c6e06a28e2a5b009464fdd994fce6c61e8186c08dd"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/matchReplay.ts",
      "sha256": "6796c275154da7145cd06558835524075013528ecb2354a1f3439e5b537ea499"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/offence.ts",
      "sha256": "8e4a37b6a87cc000094bf402d8d0a26471689ec782af8aa7a3ecb555cc95740b"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/passive.ts",
      "sha256": "0c405269406b4a8b124ea432ce036a0008118aa59c186954cded0957a0c2381f"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/pivot.ts",
      "sha256": "3021f9ab217e9e4eb8f5adf996365e86338ac0fa9e738fc7491a25228c6bf783"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/population.ts",
      "sha256": "49ce36826bec8344be94e5fc8cd763abeb9fb2525728df0d1526d799bc24bd7f"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/profile.ts",
      "sha256": "2470fad59a2bb1570ee67561b8ca9e79edead74bc7082c7fe0007f2e252f38b0"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/realism.ts",
      "sha256": "615271e0bc0217a08b296fa0777754f28b02fa136e5c0e55f07a8af616780897"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/referee.ts",
      "sha256": "35feaf4d17b6b5bd011702384be061081b52b220e5d897e37aa24bc297d04387"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/replay.ts",
      "sha256": "7a636b1b374a10d7f8aa02ade08957ac67920aacd33b37db2f412f2fefa42e6b"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/restarts.ts",
      "sha256": "20a9bfbb0ebbffe9daf74da6557dc735595b5af2ec99b4bc586a4219fbb37f24"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/rules.ts",
      "sha256": "46325a43317b15edfc4773265989ffa2ab0500c9fdefb32a7fc3363dd39147d4"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/sanction.ts",
      "sha256": "9e73fa8151c2f4d86c46883c1939aca437d341a34aa2767ae827cb525dd67dd2"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/scenarios.ts",
      "sha256": "c48ddb2c75ce34fd03c439261e40e77f676b1ffb2fc8abeb1a3f9b1a5d286dbe"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/space.ts",
      "sha256": "e9c1d8c3bb9e0a813ef82abd38cb8229a245dcee5b21b215ff9acee7bb701c7f"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/squads.ts",
      "sha256": "fc2aeaa594f3ef8a119656d1056178bf5f6414f6ee4c2082641b97fc216749a4"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/state.ts",
      "sha256": "c86e46360775cee3e9d0dcf5a60a0d9df225fe147a748daa9f51c292670258da"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/structure.ts",
      "sha256": "4c0ef606a9f03990cda2941d5af7f71adc56b353fe090e11c5fe58c12b816276"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/testProfile.ts",
      "sha256": "35a3ac5a0a0fbb6614de81c449fde37b880af96bc10a1cd2dcf4b4e3e9077d6d"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/timing.ts",
      "sha256": "0356bb3de1dc1aa32359d6e198cce8155bbd7010c9f76592f6f33c24c131b169"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/transitions.ts",
      "sha256": "ee453a4af139da47de2249d4ebf8f73f44e94372c2c231f654f65651cef77ec3"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/wing.ts",
      "sha256": "31d7f39cf38918717d3723fadcce80948a13650a45a2f680e1bbc5c66fd3a556"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/wingScenarios.ts",
      "sha256": "8d553b1c254f0953cf5508ca1a37463891f631cdfd0df81b436be487541ee031"
    },
    {
      "path": "/apps/game/lib/career/productionMatch.ts",
      "sha256": "6b826bb59ba571d70f745f6139002ca47c331489ecdbd2ccfd7c4bf2c51cef6c"
    },
    {
      "path": "/apps/game/scripts/lib/calibrationDiagnostics.ts",
      "sha256": "75b4d75ab6951abd13939eb69661ef9a926654ce95d33d36434709c9a038223e"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/empirical.ts",
      "sha256": "1b05cfb0cfdb7e96870875b1042860b13221c852078eff953d31016123464d6c"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/empiricalComparison.ts",
      "sha256": "e49e86aca79b3e30cbe57ea0e6ce1da16a778417e936be4f3a1405a312e1a975"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/evaluate.ts",
      "sha256": "2f4d5bc893fbd482dfcd10baeaa1f3aa72c943dbcfa0e8dca0ba050fd3c9f3f0"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/extract.ts",
      "sha256": "4ac1e4094d2b76ba34dd157df4b32ba6309c1853aab18c7329890231681bb873"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/reference.ts",
      "sha256": "25cb435b7824faa1fc58429264d3e91a4833e678170bb5bfa75d5b5c98009e8a"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/report.ts",
      "sha256": "c7c77e53ba8b07212362ec36f4a31f2d8b263ea0f17ce8f0fd730292035b7444"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/statistics.ts",
      "sha256": "9b3c1f8e5dc5590302b8b6115f5e7c86d9a5693e14af80f0880b334f7752e2d0"
    },
    {
      "path": "/apps/game/scripts/match-benchmarks.ts",
      "sha256": "5faab03540db0b3232ed2b6e8b1f12add01c85b6cf1784337080dbf0399f8cde"
    }
  ],
  "sourceStable": true,
  "timings": [
    {
      "simulationMs": 23302.3125,
      "analysisMs": 4029.074199999999,
      "observerMs": 4849.008400000379
    },
    {
      "simulationMs": 19348.886699999995,
      "analysisMs": 8841.729900000006,
      "observerMs": 4255.9415000000445
    }
  ],
  "proofs": [],
  "totalRuntimeMs": 61283.7843,
  "normalMatchOverhead": "Zero: benchmark modules are developer-only and never imported by production simulation."
}
```

## Match distributions

| Metric | N matches | Mean | SD | p05 | Median | p95 | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| outfieldShots | 2 | 98.500 | 4.950 | 95.350 | 98.500 | 101.650 | 95.000 | 102.000 |
| outfieldConversion | 2 | 0.608 | 0.041 | 0.582 | 0.608 | 0.634 | 0.579 | 0.637 |
| goals | 2 | 60.000 | 7.071 | 55.500 | 60.000 | 64.500 | 55.000 | 65.000 |
| possessions | 2 | 130.500 | 0.707 | 130.050 | 130.500 | 130.950 | 130.000 | 131.000 |
| shots | 2 | 98.500 | 4.950 | 95.350 | 98.500 | 101.650 | 95.000 | 102.000 |
| saves | 2 | 18.500 | 4.950 | 15.350 | 18.500 | 21.650 | 15.000 | 22.000 |
| shotsFaced | 2 | 78.500 | 2.121 | 77.150 | 78.500 | 79.850 | 77.000 | 80.000 |
| conversion | 2 | 0.608 | 0.041 | 0.582 | 0.608 | 0.634 | 0.579 | 0.637 |
| savePct | 2 | 0.237 | 0.069 | 0.192 | 0.237 | 0.281 | 0.188 | 0.286 |
| goalsPerPossession | 2 | 0.460 | 0.057 | 0.424 | 0.460 | 0.496 | 0.420 | 0.500 |
| turnovers | 2 | 40.000 | 1.414 | 39.100 | 40.000 | 40.900 | 39.000 | 41.000 |
| technicalErrors | 2 | 0.500 | 0.707 | 0.050 | 0.500 | 0.950 | 0.000 | 1.000 |
| offensiveFouls | 2 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sevenMetres | 2 | 6.000 | 0.000 | 6.000 | 6.000 | 6.000 | 6.000 | 6.000 |
| sevenMetreConversion | 2 | 0.917 | 0.118 | 0.842 | 0.917 | 0.992 | 0.833 | 1.000 |
| suspensions | 2 | 6.500 | 0.707 | 6.050 | 6.500 | 6.950 | 6.000 | 7.000 |
| contacts | 2 | 633.000 | 26.870 | 615.900 | 633.000 | 650.100 | 614.000 | 652.000 |
| assessedFouls | 2 | 36.500 | 6.364 | 32.450 | 36.500 | 40.550 | 32.000 | 41.000 |
| advantages | 2 | 17.500 | 9.192 | 11.650 | 17.500 | 23.350 | 11.000 | 24.000 |
| whistles | 2 | 19.000 | 2.828 | 17.200 | 19.000 | 20.800 | 17.000 | 21.000 |
| freeThrows | 2 | 14.500 | 3.536 | 12.250 | 14.500 | 16.750 | 12.000 | 17.000 |
| possessionSeconds | 2 | 27.587 | 0.149 | 27.491 | 27.587 | 27.682 | 27.481 | 27.692 |
| transitionPossessions | 2 | 129.000 | 1.414 | 128.100 | 129.000 | 129.900 | 128.000 | 130.000 |
| transitionAttempts | 2 | 129.500 | 0.707 | 129.050 | 129.500 | 129.950 | 129.000 | 130.000 |
| transitionShots | 2 | 4.000 | 1.414 | 3.100 | 4.000 | 4.900 | 3.000 | 5.000 |
| transitionGoals | 2 | 2.500 | 0.707 | 2.050 | 2.500 | 2.950 | 2.000 | 3.000 |
| transitionConversion | 2 | 0.633 | 0.047 | 0.603 | 0.633 | 0.663 | 0.600 | 0.667 |
| transitionRate | 2 | 0.989 | 0.016 | 0.978 | 0.989 | 0.999 | 0.977 | 1.000 |

## Shot context

Context rows overlap; CATEGORY rows partition shots. Save rate = saves / (saves + goals). Conversion = goals / attempts.

| Context | N matches | Attempts | On target | Saves | Save rate | Conversion |
|---|---:|---:|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 2 | 53 | 39 | 5 | 0.128 | 0.642 |
| POSITION:V9 | 2 | 38 | 31 | 3 | 0.097 | 0.737 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 2 | 157 | 123 | 27 | 0.220 | 0.611 |
| QUALITY:LOWER_UNDER_0.65 | 2 | 157 | 122 | 29 | 0.238 | 0.592 |
| PHASE:ESTABLISHED | 2 | 177 | 138 | 34 | 0.246 | 0.588 |
| DISTANCE:8_TO_10.5M | 2 | 94 | 79 | 21 | 0.266 | 0.617 |
| CATEGORY:STANDING | 2 | 11 | 10 | 3 | 0.300 | 0.636 |
| POSITION:H6 | 2 | 26 | 17 | 6 | 0.353 | 0.423 |
| CONTEXT:NEAR_SIX_METRE_AREA | 2 | 71 | 56 | 16 | 0.286 | 0.563 |
| POSITION:H9 | 2 | 31 | 25 | 8 | 0.320 | 0.548 |
| PHASE:TRANSITION | 2 | 8 | 7 | 2 | 0.286 | 0.625 |
| CATEGORY:BREAKTHROUGH | 2 | 65 | 52 | 18 | 0.346 | 0.523 |
| PRESSURE:LOW_UNDER_0.2 | 2 | 40 | 34 | 10 | 0.294 | 0.600 |
| DISTANCE:UP_TO_8M | 2 | 83 | 67 | 15 | 0.224 | 0.627 |
| CATEGORY:PIVOT | 2 | 32 | 26 | 6 | 0.231 | 0.625 |
| POSITION:M6 | 2 | 32 | 26 | 6 | 0.231 | 0.625 |
| CATEGORY:WING | 2 | 24 | 18 | 4 | 0.222 | 0.583 |
| POSITION:V6 | 2 | 35 | 30 | 10 | 0.333 | 0.571 |
| QUALITY:HIGH_AT_LEAST_0.65 | 2 | 40 | 35 | 8 | 0.229 | 0.675 |
| DISTANCE:BEYOND_10.5M | 2 | 20 | 11 | 1 | 0.091 | 0.500 |
| CATEGORY:SEVEN_METRE | 2 | 12 | 12 | 1 | 0.083 | 0.917 |
| POSITION:M9 | 2 | 35 | 28 | 4 | 0.143 | 0.686 |
| PHASE:RESTART | 2 | 12 | 12 | 1 | 0.083 | 0.917 |

## Goalkeeper investigation

Rankings below describe this engine sample. They are not empirical outlier verdicts. Conditional expectations require category references and complete coverage.

### Match 1: se_player_josip_cavar_60b145a1
Saves 15; shots faced 42; save rate 0.357; attempts 48. Wilson interval 0.230–0.508.
Mean pressure 0.653; decision quality 0.564; distance 8.356m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.7368421052631576,"keeper.setPosition":0.6842105263157892,"keeper.reaction":0.789473684210527,"keeper.explosiveness":0.789473684210527,"keeper.low":0.789473684210527,"keeper.high":0.7368421052631576,"keeper.close":0.7368421052631576,"keeper.long":0.6842105263157892,"keeper.wing":0.6842105263157892,"keeper.sevenMetre":0.7368421052631576,"keeper.reading":0.7631578947368424,"keeper.outlet":0.6842105263157892,"shooter.placement":0.7132675438596493,"shooter.power":0.7324561403508769,"shooter.finishing":0.7160087719298244,"shooter.wing":0.8081140350877192,"shooter.pivot":0.6940789473684211,"shooter.decision":0.6513157894736844,"shooter.composure":0.68859649122807,"shot.pressure":0.6530198429965467,"shot.quality":0.5644280675124245,"shot.distance":8.356180889653729}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:PIVOT | 10 | 10 | 3 | 0.300 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 37 | 33 | 11 | 0.333 |
| QUALITY:HIGH_AT_LEAST_0.65 | 7 | 7 | 1 | 0.143 |
| PHASE:ESTABLISHED | 44 | 39 | 15 | 0.385 |
| DISTANCE:UP_TO_8M | 23 | 23 | 7 | 0.304 |
| CONTEXT:NEAR_SIX_METRE_AREA | 24 | 22 | 9 | 0.409 |
| CATEGORY:BACKCOURT_JUMP | 8 | 5 | 0 | 0.000 |
| QUALITY:LOWER_UNDER_0.65 | 41 | 35 | 14 | 0.400 |
| DISTANCE:BEYOND_10.5M | 7 | 3 | 0 | 0.000 |
| CATEGORY:WING | 9 | 6 | 3 | 0.500 |
| DISTANCE:8_TO_10.5M | 18 | 16 | 8 | 0.500 |
| CATEGORY:BREAKTHROUGH | 17 | 17 | 7 | 0.412 |
| PRESSURE:LOW_UNDER_0.2 | 11 | 9 | 4 | 0.444 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 0 | 0.000 |
| PHASE:RESTART | 2 | 2 | 0 | 0.000 |
| CATEGORY:STANDING | 2 | 2 | 2 | 1.000 |
| PHASE:TRANSITION | 2 | 1 | 0 | 0.000 |

### Match 0: player_oliver_andersson_ef8ef0a2
Saves 9; shots faced 43; save rate 0.209; attempts 53. Wilson interval 0.114–0.352.
Mean pressure 0.690; decision quality 0.559; distance 8.489m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.42105263157894707,"keeper.setPosition":0.42105263157894707,"keeper.reaction":0.47368421052631543,"keeper.explosiveness":0.5263157894736843,"keeper.low":0.47368421052631543,"keeper.high":0.47368421052631543,"keeper.close":0.47368421052631543,"keeper.long":0.5263157894736843,"keeper.wing":0.47368421052631543,"keeper.sevenMetre":0.42105263157894707,"keeper.reading":0.5263157894736843,"keeper.outlet":0.6315789473684219,"shooter.placement":0.7562065541211518,"shooter.power":0.761668321747766,"shooter.finishing":0.7835153922542202,"shooter.wing":0.7805362462760672,"shooter.pivot":0.7527308838133067,"shooter.decision":0.6623634558093349,"shooter.composure":0.6653426017874879,"shot.pressure":0.6903902179557382,"shot.quality":0.5593609241883717,"shot.distance":8.488724906712953}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 14 | 10 | 1 | 0.100 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 38 | 29 | 5 | 0.172 |
| QUALITY:LOWER_UNDER_0.65 | 41 | 32 | 6 | 0.188 |
| PHASE:ESTABLISHED | 46 | 36 | 9 | 0.250 |
| DISTANCE:8_TO_10.5M | 26 | 24 | 5 | 0.208 |
| CATEGORY:STANDING | 2 | 2 | 0 | 0.000 |
| CONTEXT:NEAR_SIX_METRE_AREA | 14 | 11 | 3 | 0.273 |
| PHASE:TRANSITION | 3 | 3 | 0 | 0.000 |
| CATEGORY:BREAKTHROUGH | 21 | 16 | 6 | 0.375 |
| PRESSURE:LOW_UNDER_0.2 | 15 | 14 | 4 | 0.286 |
| DISTANCE:UP_TO_8M | 21 | 15 | 4 | 0.267 |
| CATEGORY:PIVOT | 6 | 5 | 2 | 0.400 |
| CATEGORY:WING | 6 | 6 | 0 | 0.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 12 | 11 | 3 | 0.273 |
| DISTANCE:BEYOND_10.5M | 6 | 4 | 0 | 0.000 |
| CATEGORY:SEVEN_METRE | 4 | 4 | 0 | 0.000 |
| PHASE:RESTART | 4 | 4 | 0 | 0.000 |

### Match 1: player_alexander_linden_7f15da04
Saves 7; shots faced 35; save rate 0.200; attempts 47. Wilson interval 0.100–0.359.
Mean pressure 0.744; decision quality 0.539; distance 8.563m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.7368421052631583,"keeper.setPosition":0.7368421052631583,"keeper.reaction":0.9473684210526311,"keeper.explosiveness":0.8421052631578947,"keeper.low":0.7368421052631583,"keeper.high":0.7894736842105254,"keeper.close":0.8947368421052639,"keeper.long":0.7894736842105254,"keeper.wing":0.7894736842105254,"keeper.sevenMetre":0.7894736842105254,"keeper.reading":0.7105263157894739,"keeper.outlet":0.7368421052631583,"shooter.placement":0.7693169092945124,"shooter.power":0.8174692049272112,"shooter.finishing":0.7558790593505036,"shooter.wing":0.8465845464725644,"shooter.pivot":0.8174692049272114,"shooter.decision":0.7178051511758118,"shooter.composure":0.7368421052631576,"shot.pressure":0.7438747727669685,"shot.quality":0.538537709785245,"shot.distance":8.562502033154258}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:PIVOT | 5 | 3 | 1 | 0.333 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 38 | 28 | 6 | 0.214 |
| QUALITY:HIGH_AT_LEAST_0.65 | 11 | 8 | 2 | 0.250 |
| PHASE:ESTABLISHED | 42 | 30 | 6 | 0.200 |
| DISTANCE:UP_TO_8M | 19 | 14 | 3 | 0.214 |
| CONTEXT:NEAR_SIX_METRE_AREA | 16 | 11 | 3 | 0.273 |
| CATEGORY:BACKCOURT_JUMP | 14 | 10 | 2 | 0.200 |
| QUALITY:LOWER_UNDER_0.65 | 36 | 27 | 5 | 0.185 |
| DISTANCE:BEYOND_10.5M | 4 | 2 | 1 | 0.500 |
| CATEGORY:WING | 7 | 5 | 1 | 0.200 |
| DISTANCE:8_TO_10.5M | 24 | 19 | 3 | 0.158 |
| CATEGORY:BREAKTHROUGH | 13 | 9 | 1 | 0.111 |
| PRESSURE:LOW_UNDER_0.2 | 9 | 7 | 1 | 0.143 |
| CATEGORY:SEVEN_METRE | 4 | 4 | 1 | 0.250 |
| PHASE:RESTART | 4 | 4 | 1 | 0.250 |
| CATEGORY:STANDING | 4 | 4 | 1 | 0.250 |
| PHASE:TRANSITION | 1 | 1 | 0 | 0.000 |

### Match 0: se_player_anton_hagvall_34e5df98
Saves 6; shots faced 37; save rate 0.162; attempts 49. Wilson interval 0.077–0.311.
Mean pressure 0.905; decision quality 0.521; distance 8.594m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.6315789473684211,"keeper.setPosition":0.6315789473684211,"keeper.reaction":0.7368421052631579,"keeper.explosiveness":0.7368421052631579,"keeper.low":0.6842105263157898,"keeper.high":0.6315789473684211,"keeper.close":0.7368421052631579,"keeper.long":0.7368421052631579,"keeper.wing":0.7368421052631579,"keeper.sevenMetre":0.6315789473684211,"keeper.reading":0.6315789473684211,"keeper.outlet":0.7368421052631579,"shooter.placement":0.7921589688506984,"shooter.power":0.8066595059076258,"shooter.finishing":0.7830290010741137,"shooter.wing":0.8012889366272825,"shooter.pivot":0.8206229860365201,"shooter.decision":0.6842105263157896,"shooter.composure":0.6756176154672395,"shot.pressure":0.9051982527796619,"shot.quality":0.5214608864666654,"shot.distance":8.593691761765491}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 17 | 14 | 2 | 0.143 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 44 | 33 | 5 | 0.152 |
| QUALITY:LOWER_UNDER_0.65 | 39 | 28 | 4 | 0.143 |
| PHASE:ESTABLISHED | 45 | 33 | 4 | 0.121 |
| DISTANCE:8_TO_10.5M | 26 | 20 | 5 | 0.250 |
| CATEGORY:STANDING | 3 | 2 | 0 | 0.000 |
| CONTEXT:NEAR_SIX_METRE_AREA | 17 | 12 | 1 | 0.083 |
| PHASE:TRANSITION | 2 | 2 | 2 | 1.000 |
| CATEGORY:BREAKTHROUGH | 14 | 10 | 4 | 0.400 |
| PRESSURE:LOW_UNDER_0.2 | 5 | 4 | 1 | 0.250 |
| DISTANCE:UP_TO_8M | 20 | 15 | 1 | 0.067 |
| CATEGORY:PIVOT | 11 | 8 | 0 | 0.000 |
| CATEGORY:WING | 2 | 1 | 0 | 0.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 10 | 9 | 2 | 0.222 |
| DISTANCE:BEYOND_10.5M | 3 | 2 | 0 | 0.000 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 0 | 0.000 |
| PHASE:RESTART | 2 | 2 | 0 | 0.000 |

## Outliers and coverage

0 evidence-backed flags. 600/634 comparisons have NO_REFERENCE. Missing reference is not NORMAL.

| Match | Scope | Metric | Actual | Expected | Deviation | N | Status |
|---|---|---|---:|---:|---:|---:|---|

## How to read this report

Use N and denominators before comparing rates. Means and percentiles describe this batch. Consult per-match JSON for observed reference, contextual components, uncertainty, provenance and fallback. A keeper with 30 saves requires both on-target volume and category/pressure/quality review. NO_REFERENCE means no justified real-world verdict is possible. Engineering sanity checks are separate in summary.json.
