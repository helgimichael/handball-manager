# Current engine benchmark

N = 20 completed matches. Engine outputs are measured samples, not real-world references.

```json
{
  "head": "3de1ecc035294dfe0b81e4f1653379968cd917ba",
  "schemaVersion": "match-benchmarks/1",
  "identity": {
    "competition": "swe-2",
    "season": "2026-27",
    "country": "SE",
    "category": "men-senior"
  },
  "profileVersions": [],
  "inputHash": "37b2f9ee4648ede1a422549fb680bad5c172ebdf70c77f65334d2e6487ab0347",
  "referenceHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "recipes": [
    {
      "index": 0,
      "saveSeed": "match-realism-v2-canonical-2026:0",
      "managerClubId": "swe2-aranas"
    },
    {
      "index": 1,
      "saveSeed": "match-realism-v2-canonical-2026:1",
      "managerClubId": "swe2-drott"
    },
    {
      "index": 2,
      "saveSeed": "match-realism-v2-canonical-2026:2",
      "managerClubId": "swe2-guif"
    },
    {
      "index": 3,
      "saveSeed": "match-realism-v2-canonical-2026:3",
      "managerClubId": "swe2-h43lund"
    },
    {
      "index": 4,
      "saveSeed": "match-realism-v2-canonical-2026:4",
      "managerClubId": "swe2-huddinge"
    },
    {
      "index": 5,
      "saveSeed": "match-realism-v2-canonical-2026:5",
      "managerClubId": "swe2-kroppskultur"
    },
    {
      "index": 6,
      "saveSeed": "match-realism-v2-canonical-2026:6",
      "managerClubId": "swe2-kungalv"
    },
    {
      "index": 7,
      "saveSeed": "match-realism-v2-canonical-2026:7",
      "managerClubId": "swe2-redbergslid"
    },
    {
      "index": 8,
      "saveSeed": "match-realism-v2-canonical-2026:8",
      "managerClubId": "swe2-torslanda"
    },
    {
      "index": 9,
      "saveSeed": "match-realism-v2-canonical-2026:9",
      "managerClubId": "swe2-tumba"
    },
    {
      "index": 10,
      "saveSeed": "match-realism-v2-canonical-2026:10",
      "managerClubId": "swe2-tyreso"
    },
    {
      "index": 11,
      "saveSeed": "match-realism-v2-canonical-2026:11",
      "managerClubId": "swe2-varberg"
    },
    {
      "index": 12,
      "saveSeed": "match-realism-v2-canonical-2026:12",
      "managerClubId": "swe2-vasterasirsta"
    },
    {
      "index": 13,
      "saveSeed": "match-realism-v2-canonical-2026:13",
      "managerClubId": "swe2-ystad2"
    },
    {
      "index": 14,
      "saveSeed": "match-realism-v2-canonical-2026:14",
      "managerClubId": "swe2-aranas"
    },
    {
      "index": 15,
      "saveSeed": "match-realism-v2-canonical-2026:15",
      "managerClubId": "swe2-drott"
    },
    {
      "index": 16,
      "saveSeed": "match-realism-v2-canonical-2026:16",
      "managerClubId": "swe2-guif"
    },
    {
      "index": 17,
      "saveSeed": "match-realism-v2-canonical-2026:17",
      "managerClubId": "swe2-h43lund"
    },
    {
      "index": 18,
      "saveSeed": "match-realism-v2-canonical-2026:18",
      "managerClubId": "swe2-huddinge"
    },
    {
      "index": 19,
      "saveSeed": "match-realism-v2-canonical-2026:19",
      "managerClubId": "swe2-kroppskultur"
    }
  ],
  "tactics": null,
  "sourceFingerprints": [
    {
      "path": "/packages/handball-engine/src/v2/core/actions.ts",
      "sha256": "83a16946376e0828c4216c6fcb7f843b0be27587dd858774e6327b4cb459de4b"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/backcourt.ts",
      "sha256": "8dcf781126c008360947dc6e4d073a9c1b31ccbae50766610075938e30689991"
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
      "sha256": "c89fd77ef313d71fc34788ae863674e60c4dd58638526b866097040e4f938d81"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/contactScenarios.ts",
      "sha256": "328e26bb862bd5104467a5839d72ba346beef9b0a90843b6cd5e944df88f6088"
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
      "sha256": "57b775a38b3dba88e9e8a8916cda4ad53495930639feec1845492bbb383c3347"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/engine.ts",
      "sha256": "06a491914837f8be7c3a28209a7843a2952a6f762bd7c3a967cf542597aba2ea"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/execution.ts",
      "sha256": "09d7c410c365d179baf5d8e1f171ecc594ddc3b222dd57c19f727664a7751184"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/interactions.ts",
      "sha256": "3e9e9c02948ce9f3ceb8ac1fedbc726d4b4f8e70ee11d505e06c52ca8ffb1abd"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/ledger.ts",
      "sha256": "7ecc96b6cd9d86c924b8ad42774c52c66543dd47cdb4d33f866b7f7bc17495ab"
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
      "sha256": "ebe1acb31951488f9d833ce4126ebfeb63dc11e49bdb27daa8b44f5eef63c6f2"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/population.ts",
      "sha256": "49ce36826bec8344be94e5fc8cd763abeb9fb2525728df0d1526d799bc24bd7f"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/profile.ts",
      "sha256": "fd563e6279ae8ceb18155ab735f4c0990f7d3f9d26984de86fe9f6e9a2da12c6"
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
      "sha256": "0f2cda92143ec31c89d3f712dd7e63f0be1a4241911f954fcbd7a629c6ef9244"
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
      "sha256": "26e04175b27864b9f7d0117daac015afa9ab8d5476fc0c69c083d30f1440983a"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/structure.ts",
      "sha256": "e09b9aa3bb0ff3b5313eae35d9ebc75dd2dd3ccfda6a726dcd723bc421abe11c"
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
      "sha256": "0c99309aafa0b71299cb621ddf23d85a2a71e3181a2d815ac837f07a95a8002a"
    },
    {
      "path": "/apps/game/scripts/lib/calibrationDiagnostics.ts",
      "sha256": "75b4d75ab6951abd13939eb69661ef9a926654ce95d33d36434709c9a038223e"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/evaluate.ts",
      "sha256": "2f4d5bc893fbd482dfcd10baeaa1f3aa72c943dbcfa0e8dca0ba050fd3c9f3f0"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/extract.ts",
      "sha256": "d00f9a3fa5cb2964dce5e10ea727fdecf32a5c38409db536defbd1728b839c7b"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/reference.ts",
      "sha256": "6fe32a874f03c1bd1ab83ba8720ad60af56bbb5cc378233887d40ecd185d2637"
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
      "sha256": "b4aaab2250f6141830c0f4f7b2ea9a75aaf67dd3224c33eb6858b60111bf65c7"
    }
  ],
  "sourceStable": true,
  "timings": [
    {
      "simulationMs": 12064.796,
      "analysisMs": 1934.0491000000002,
      "observerMs": 708.1074999999266
    },
    {
      "simulationMs": 14072.390500000001,
      "analysisMs": 1770.5771000000022,
      "observerMs": 796.6237000016517
    },
    {
      "simulationMs": 11516.734200000006,
      "analysisMs": 1276.0998000000036,
      "observerMs": 670.4550000000963
    },
    {
      "simulationMs": 9469.554600000003,
      "analysisMs": 1363.5359999999928,
      "observerMs": 500.49909999826923
    },
    {
      "simulationMs": 8532.646399999998,
      "analysisMs": 1036.7127000000037,
      "observerMs": 447.97789999884844
    },
    {
      "simulationMs": 7233.003299999997,
      "analysisMs": 1034.0885999999882,
      "observerMs": 359.6989999971847
    },
    {
      "simulationMs": 7708.249299999996,
      "analysisMs": 861.4198999999935,
      "observerMs": 408.14610000043467
    },
    {
      "simulationMs": 7657.311900000001,
      "analysisMs": 1137.2998999999982,
      "observerMs": 416.2728999995452
    },
    {
      "simulationMs": 6944.834000000003,
      "analysisMs": 1151.9407999999967,
      "observerMs": 364.16000000183703
    },
    {
      "simulationMs": 7706.984499999991,
      "analysisMs": 1151.382700000002,
      "observerMs": 374.45389999702456
    },
    {
      "simulationMs": 8232.093700000012,
      "analysisMs": 1330.4222999999765,
      "observerMs": 422.9591000000073
    },
    {
      "simulationMs": 8521.804299999989,
      "analysisMs": 1170.108099999983,
      "observerMs": 440.91060000198195
    },
    {
      "simulationMs": 8666.219799999992,
      "analysisMs": 1219.201700000005,
      "observerMs": 468.82480000308715
    },
    {
      "simulationMs": 4905.823799999984,
      "analysisMs": 619.1024000000034,
      "observerMs": 227.12119999952847
    },
    {
      "simulationMs": 5572.629199999996,
      "analysisMs": 1126.972699999984,
      "observerMs": 265.8850999966671
    },
    {
      "simulationMs": 8068.96610000002,
      "analysisMs": 1349.1271000000124,
      "observerMs": 403.22800000259303
    },
    {
      "simulationMs": 6792.287199999992,
      "analysisMs": 784.1528999999864,
      "observerMs": 315.6099999959406
    },
    {
      "simulationMs": 3256.8522999999986,
      "analysisMs": 671.0229000000108,
      "observerMs": 140.8463000022457
    },
    {
      "simulationMs": 3764.8997999999847,
      "analysisMs": 988.6190999999817,
      "observerMs": 164.3588999955682
    },
    {
      "simulationMs": 7274.482399999979,
      "analysisMs": 1162.4684000000125,
      "observerMs": 381.47209999669576
    }
  ],
  "proofs": [
    {
      "index": 0,
      "fullMatch": true,
      "exactSessionEqual": true,
      "sessionHash": "5c20eceefe370b763128da0b44a58b80f03e14ce1da1281fdaa6cb1416f5a6fa",
      "resultHash": "c5f5818a2d8ed97dcb1a9086a272146be8bd88c97de18a8459e2ae728791ce8c",
      "observedMs": 12064.796,
      "unobservedMs": 13248.562600000001,
      "observerMs": 708.1074999999266,
      "analysisMs": 1934.0491000000002,
      "includes": [
        "result",
        "events",
        "rng",
        "archive frames",
        "core statistics"
      ],
      "postAnalysisSessionUnchanged": true
    }
  ],
  "totalRuntimeMs": 210829.3079,
  "normalMatchOverhead": "Zero: benchmark modules are developer-only and never imported by production simulation."
}
```

## Match distributions

| Metric | N matches | Mean | SD | p05 | Median | p95 | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| goals | 20 | 50.650 | 10.246 | 33.900 | 53.000 | 64.150 | 32.000 | 67.000 |
| possessions | 20 | 129.800 | 7.120 | 119.900 | 130.000 | 136.700 | 118.000 | 150.000 |
| shots | 20 | 103.200 | 8.370 | 89.750 | 105.000 | 114.200 | 85.000 | 118.000 |
| saves | 20 | 43.650 | 7.936 | 32.900 | 43.500 | 58.050 | 31.000 | 59.000 |
| shotsFaced | 20 | 94.300 | 7.994 | 83.350 | 95.000 | 103.050 | 71.000 | 104.000 |
| conversion | 20 | 0.489 | 0.086 | 0.374 | 0.495 | 0.609 | 0.337 | 0.610 |
| savePct | 20 | 0.465 | 0.087 | 0.349 | 0.468 | 0.597 | 0.344 | 0.628 |
| goalsPerPossession | 20 | 0.390 | 0.073 | 0.266 | 0.407 | 0.486 | 0.261 | 0.508 |
| turnovers | 20 | 31.550 | 6.661 | 23.900 | 31.000 | 44.150 | 22.000 | 47.000 |
| technicalErrors | 20 | 2.650 | 1.899 | 0.000 | 2.000 | 6.000 | 0.000 | 6.000 |
| offensiveFouls | 20 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sevenMetres | 20 | 11.100 | 3.177 | 5.000 | 12.000 | 15.050 | 5.000 | 16.000 |
| sevenMetreConversion | 20 | 0.643 | 0.171 | 0.397 | 0.703 | 0.838 | 0.333 | 0.917 |
| suspensions | 20 | 11.850 | 3.498 | 6.000 | 12.000 | 16.150 | 6.000 | 19.000 |
| contacts | 20 | 633.300 | 33.627 | 581.150 | 630.000 | 674.600 | 565.000 | 705.000 |
| assessedFouls | 20 | 69.350 | 8.356 | 58.600 | 69.000 | 82.100 | 51.000 | 84.000 |
| advantages | 20 | 25.800 | 5.736 | 16.900 | 26.000 | 36.000 | 15.000 | 36.000 |
| whistles | 20 | 43.550 | 4.685 | 35.900 | 45.000 | 48.150 | 34.000 | 51.000 |
| freeThrows | 20 | 35.900 | 4.778 | 27.850 | 36.500 | 42.000 | 25.000 | 42.000 |
| possessionSeconds | 20 | 27.812 | 1.481 | 26.347 | 27.692 | 30.025 | 24.000 | 30.508 |
| transitionPossessions | 20 | 124.750 | 9.640 | 109.900 | 127.000 | 133.850 | 108.000 | 150.000 |
| transitionAttempts | 20 | 124.950 | 9.644 | 109.900 | 127.000 | 133.850 | 108.000 | 150.000 |
| transitionShots | 20 | 6.000 | 2.656 | 1.950 | 6.000 | 10.000 | 1.000 | 10.000 |
| transitionGoals | 20 | 2.850 | 1.268 | 1.000 | 3.000 | 5.000 | 1.000 | 5.000 |
| transitionConversion | 20 | 0.505 | 0.157 | 0.329 | 0.500 | 0.683 | 0.250 | 1.000 |
| transitionRate | 20 | 0.960 | 0.028 | 0.909 | 0.965 | 0.993 | 0.904 | 1.000 |

## Shot context

Context rows overlap; CATEGORY rows partition shots. Save rate = saves / (saves + goals). Conversion = goals / attempts.

| Context | N matches | Attempts | On target | Saves | Save rate | Conversion |
|---|---:|---:|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 20 | 776 | 685 | 312 | 0.455 | 0.481 |
| POSITION:V9 | 20 | 240 | 219 | 121 | 0.553 | 0.408 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 20 | 1434 | 1262 | 565 | 0.448 | 0.486 |
| QUALITY:LOWER_UNDER_0.65 | 20 | 1626 | 1448 | 706 | 0.488 | 0.456 |
| PHASE:ESTABLISHED | 20 | 1721 | 1556 | 743 | 0.478 | 0.472 |
| DISTANCE:8_TO_10.5M | 20 | 1170 | 1060 | 551 | 0.520 | 0.435 |
| CATEGORY:BREAKTHROUGH | 20 | 622 | 578 | 280 | 0.484 | 0.479 |
| POSITION:M9 | 20 | 997 | 920 | 406 | 0.441 | 0.516 |
| DISTANCE:UP_TO_8M | 20 | 730 | 699 | 276 | 0.395 | 0.579 |
| POSITION:H6 | 20 | 196 | 167 | 84 | 0.503 | 0.423 |
| QUALITY:HIGH_AT_LEAST_0.65 | 20 | 438 | 438 | 167 | 0.381 | 0.619 |
| CATEGORY:STANDING | 20 | 171 | 162 | 115 | 0.710 | 0.275 |
| POSITION:H9 | 20 | 302 | 282 | 146 | 0.518 | 0.450 |
| PRESSURE:LOW_UNDER_0.2 | 20 | 630 | 624 | 308 | 0.494 | 0.502 |
| CATEGORY:SEVEN_METRE | 20 | 222 | 222 | 79 | 0.356 | 0.644 |
| PHASE:RESTART | 20 | 223 | 223 | 80 | 0.359 | 0.641 |
| DISTANCE:BEYOND_10.5M | 20 | 164 | 127 | 46 | 0.362 | 0.494 |
| CATEGORY:WING | 20 | 195 | 162 | 43 | 0.265 | 0.610 |
| POSITION:V6 | 20 | 251 | 221 | 72 | 0.326 | 0.594 |
| CONTEXT:NEAR_SIX_METRE_AREA | 20 | 492 | 448 | 177 | 0.395 | 0.551 |
| CATEGORY:PIVOT | 20 | 78 | 77 | 44 | 0.571 | 0.423 |
| POSITION:M6 | 20 | 78 | 77 | 44 | 0.571 | 0.423 |
| PHASE:TRANSITION | 20 | 120 | 107 | 50 | 0.467 | 0.475 |

## Goalkeeper investigation

Rankings below describe this engine sample. They are not empirical outlier verdicts. Conditional expectations require category references and complete coverage.

### Match 8: se_player_jonas_aberg_87cd5977
Saves 33; shots faced 42; save rate 0.786; attempts 45. Wilson interval 0.641–0.883.
Mean pressure 0.471; decision quality 0.561; distance 8.598m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.605263157894737,"keeper.setPosition":0.6315789473684211,"keeper.reaction":0.7894736842105272,"keeper.explosiveness":0.7894736842105272,"keeper.low":0.6842105263157898,"keeper.high":0.6315789473684211,"keeper.close":0.7894736842105272,"keeper.long":0.6842105263157898,"keeper.wing":0.6842105263157898,"keeper.sevenMetre":0.6842105263157898,"keeper.reading":0.605263157894737,"keeper.outlet":0.5789473684210528,"shooter.placement":0.626900584795322,"shooter.power":0.6350877192982457,"shooter.finishing":0.609356725146199,"shooter.wing":0.6678362573099415,"shooter.pivot":0.5976608187134503,"shooter.decision":0.64093567251462,"shooter.composure":0.5988304093567253,"shot.pressure":0.4714049634294136,"shot.quality":0.5606461311777402,"shot.distance":8.598434354107697}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 15 | 13 | 10 | 0.769 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 30 | 27 | 21 | 0.778 |
| QUALITY:LOWER_UNDER_0.65 | 33 | 30 | 24 | 0.800 |
| PHASE:ESTABLISHED | 33 | 30 | 24 | 0.800 |
| DISTANCE:BEYOND_10.5M | 5 | 4 | 2 | 0.500 |
| PRESSURE:LOW_UNDER_0.2 | 15 | 15 | 12 | 0.800 |
| PHASE:TRANSITION | 3 | 3 | 2 | 0.667 |
| DISTANCE:8_TO_10.5M | 25 | 23 | 20 | 0.870 |
| CATEGORY:BREAKTHROUGH | 9 | 9 | 7 | 0.778 |
| CATEGORY:SEVEN_METRE | 8 | 8 | 6 | 0.750 |
| QUALITY:HIGH_AT_LEAST_0.65 | 12 | 12 | 9 | 0.750 |
| PHASE:RESTART | 9 | 9 | 7 | 0.778 |
| DISTANCE:UP_TO_8M | 15 | 15 | 11 | 0.733 |
| CATEGORY:STANDING | 7 | 7 | 7 | 1.000 |
| CATEGORY:PIVOT | 1 | 1 | 1 | 1.000 |
| CONTEXT:NEAR_SIX_METRE_AREA | 8 | 7 | 5 | 0.714 |
| CATEGORY:WING | 5 | 4 | 2 | 0.500 |

### Match 5: se_player_jonas_aberg_87cd5977
Saves 31; shots faced 48; save rate 0.646; attempts 54. Wilson interval 0.504–0.766.
Mean pressure 0.599; decision quality 0.533; distance 8.807m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.6052631578947363,"keeper.setPosition":0.631578947368421,"keeper.reaction":0.7894736842105262,"keeper.explosiveness":0.7894736842105262,"keeper.low":0.6842105263157904,"keeper.high":0.631578947368421,"keeper.close":0.7894736842105262,"keeper.long":0.6842105263157904,"keeper.wing":0.6842105263157904,"keeper.sevenMetre":0.6842105263157904,"keeper.reading":0.6052631578947363,"keeper.outlet":0.5789473684210531,"shooter.placement":0.6242690058479533,"shooter.power":0.630604288499026,"shooter.finishing":0.6208576998050688,"shooter.wing":0.6744639376218324,"shooter.pivot":0.6003898635477587,"shooter.decision":0.6257309941520467,"shooter.composure":0.5916179337231973,"shot.pressure":0.5992311798379423,"shot.quality":0.5330581752483815,"shot.distance":8.806717163743512}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:STANDING | 3 | 3 | 3 | 1.000 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 37 | 31 | 21 | 0.677 |
| QUALITY:LOWER_UNDER_0.65 | 45 | 39 | 26 | 0.667 |
| PHASE:ESTABLISHED | 47 | 41 | 28 | 0.683 |
| DISTANCE:8_TO_10.5M | 27 | 24 | 17 | 0.708 |
| CATEGORY:PIVOT | 2 | 2 | 2 | 1.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 9 | 9 | 5 | 0.556 |
| DISTANCE:UP_TO_8M | 17 | 16 | 8 | 0.500 |
| CONTEXT:NEAR_SIX_METRE_AREA | 10 | 9 | 6 | 0.667 |
| CATEGORY:WING | 5 | 3 | 1 | 0.333 |
| CATEGORY:BACKCOURT_JUMP | 22 | 19 | 15 | 0.789 |
| PRESSURE:LOW_UNDER_0.2 | 17 | 17 | 10 | 0.588 |
| CATEGORY:SEVEN_METRE | 5 | 5 | 2 | 0.400 |
| PHASE:RESTART | 5 | 5 | 2 | 0.400 |
| CATEGORY:BREAKTHROUGH | 17 | 16 | 8 | 0.500 |
| DISTANCE:BEYOND_10.5M | 10 | 8 | 6 | 0.750 |
| PHASE:TRANSITION | 2 | 2 | 1 | 0.500 |

### Match 6: se_player_pontus_axelsson_3a4455c6
Saves 31; shots faced 51; save rate 0.608; attempts 58. Wilson interval 0.471–0.730.
Mean pressure 0.584; decision quality 0.578; distance 8.635m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.6052631578947372,"keeper.setPosition":0.5789473684210525,"keeper.reaction":0.7368421052631574,"keeper.explosiveness":0.7894736842105268,"keeper.low":0.6842105263157897,"keeper.high":0.5789473684210525,"keeper.close":0.6842105263157897,"keeper.long":0.5789473684210525,"keeper.wing":0.6842105263157897,"keeper.sevenMetre":0.6315789473684204,"keeper.reading":0.6315789473684204,"keeper.outlet":0.5789473684210525,"shooter.placement":0.7059891107078041,"shooter.power":0.7014519056261339,"shooter.finishing":0.6823956442831213,"shooter.wing":0.7023593466424679,"shooter.pivot":0.6678765880217786,"shooter.decision":0.6338475499092562,"shooter.composure":0.6025408348457348,"shot.pressure":0.5843259747072632,"shot.quality":0.5777133874837664,"shot.distance":8.635051808301665}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 27 | 22 | 10 | 0.455 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 42 | 35 | 18 | 0.514 |
| QUALITY:LOWER_UNDER_0.65 | 47 | 40 | 23 | 0.575 |
| PHASE:ESTABLISHED | 50 | 43 | 25 | 0.581 |
| DISTANCE:8_TO_10.5M | 40 | 33 | 21 | 0.636 |
| CATEGORY:BREAKTHROUGH | 12 | 12 | 8 | 0.667 |
| DISTANCE:UP_TO_8M | 15 | 15 | 10 | 0.667 |
| CONTEXT:NEAR_SIX_METRE_AREA | 11 | 10 | 7 | 0.700 |
| CATEGORY:STANDING | 9 | 8 | 6 | 0.750 |
| DISTANCE:BEYOND_10.5M | 3 | 3 | 0 | 0.000 |
| PRESSURE:LOW_UNDER_0.2 | 16 | 16 | 13 | 0.813 |
| CATEGORY:WING | 4 | 3 | 2 | 0.667 |
| QUALITY:HIGH_AT_LEAST_0.65 | 11 | 11 | 8 | 0.727 |
| CATEGORY:SEVEN_METRE | 4 | 4 | 3 | 0.750 |
| PHASE:RESTART | 4 | 4 | 3 | 0.750 |
| PHASE:TRANSITION | 4 | 4 | 3 | 0.750 |
| CATEGORY:PIVOT | 2 | 2 | 2 | 1.000 |

### Match 9: se_player_alexander_holmberg_3b1f68d9
Saves 30; shots faced 53; save rate 0.566; attempts 58. Wilson interval 0.433–0.690.
Mean pressure 0.717; decision quality 0.556; distance 8.421m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.5789473684210525,"keeper.setPosition":0.5789473684210525,"keeper.reaction":0.7894736842105268,"keeper.explosiveness":0.6842105263157897,"keeper.low":0.6315789473684204,"keeper.high":0.5789473684210525,"keeper.close":0.7894736842105268,"keeper.long":0.5789473684210525,"keeper.wing":0.5789473684210525,"keeper.sevenMetre":0.6842105263157897,"keeper.reading":0.6578947368421052,"keeper.outlet":0.6842105263157897,"shooter.placement":0.7186932849364788,"shooter.power":0.7150635208711428,"shooter.finishing":0.715063520871143,"shooter.wing":0.6923774954627943,"shooter.pivot":0.7096188747731392,"shooter.decision":0.6910163339382939,"shooter.composure":0.673321234119782,"shot.pressure":0.716825804777099,"shot.quality":0.5559284231331447,"shot.distance":8.421385265744153}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:SEVEN_METRE | 5 | 5 | 3 | 0.600 |
| PRESSURE:LOW_UNDER_0.2 | 13 | 12 | 7 | 0.583 |
| QUALITY:HIGH_AT_LEAST_0.65 | 13 | 13 | 9 | 0.692 |
| PHASE:RESTART | 5 | 5 | 3 | 0.600 |
| DISTANCE:UP_TO_8M | 24 | 22 | 11 | 0.500 |
| CATEGORY:STANDING | 6 | 6 | 6 | 1.000 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 45 | 41 | 23 | 0.561 |
| QUALITY:LOWER_UNDER_0.65 | 45 | 40 | 21 | 0.525 |
| PHASE:ESTABLISHED | 51 | 46 | 27 | 0.587 |
| DISTANCE:8_TO_10.5M | 31 | 28 | 18 | 0.643 |
| CATEGORY:BREAKTHROUGH | 19 | 16 | 7 | 0.438 |
| PHASE:TRANSITION | 2 | 2 | 0 | 0.000 |
| CONTEXT:NEAR_SIX_METRE_AREA | 21 | 18 | 7 | 0.389 |
| CATEGORY:BACKCOURT_JUMP | 17 | 16 | 10 | 0.625 |
| CATEGORY:WING | 5 | 4 | 0 | 0.000 |
| DISTANCE:BEYOND_10.5M | 3 | 3 | 1 | 0.333 |
| CATEGORY:PIVOT | 6 | 6 | 4 | 0.667 |

### Match 9: se_player_olle_soderqvist_467b211d
Saves 29; shots faced 41; save rate 0.707; attempts 46. Wilson interval 0.555–0.824.
Mean pressure 0.557; decision quality 0.544; distance 8.711m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.000.
Capabilities: {"keeper.positioning":0.6315789473684209,"keeper.setPosition":0.5789473684210531,"keeper.reaction":0.8421052631578957,"keeper.explosiveness":0.7894736842105263,"keeper.low":0.7368421052631572,"keeper.high":0.5789473684210531,"keeper.close":0.7894736842105263,"keeper.long":0.6842105263157897,"keeper.wing":0.5789473684210531,"keeper.sevenMetre":0.6842105263157897,"keeper.reading":0.6578947368421049,"keeper.outlet":0.6842105263157897,"shooter.placement":0.6115560640732268,"shooter.power":0.622425629290618,"shooter.finishing":0.616704805491991,"shooter.wing":0.6315789473684215,"shooter.pivot":0.6304347826086957,"shooter.decision":0.5743707093821507,"shooter.composure":0.5675057208237989,"shot.pressure":0.5567247218387738,"shot.quality":0.5439393116887985,"shot.distance":8.710743377442297}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:SEVEN_METRE | 4 | 4 | 2 | 0.500 |
| PRESSURE:LOW_UNDER_0.2 | 16 | 14 | 10 | 0.714 |
| QUALITY:HIGH_AT_LEAST_0.65 | 7 | 7 | 4 | 0.571 |
| PHASE:RESTART | 4 | 4 | 2 | 0.500 |
| DISTANCE:UP_TO_8M | 17 | 16 | 9 | 0.563 |
| CATEGORY:STANDING | 3 | 2 | 1 | 0.500 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 30 | 27 | 19 | 0.704 |
| QUALITY:LOWER_UNDER_0.65 | 39 | 34 | 25 | 0.735 |
| PHASE:ESTABLISHED | 39 | 34 | 24 | 0.706 |
| DISTANCE:8_TO_10.5M | 24 | 22 | 18 | 0.818 |
| CATEGORY:BREAKTHROUGH | 8 | 7 | 4 | 0.571 |
| PHASE:TRANSITION | 3 | 3 | 3 | 1.000 |
| CONTEXT:NEAR_SIX_METRE_AREA | 12 | 11 | 7 | 0.636 |
| CATEGORY:BACKCOURT_JUMP | 21 | 18 | 15 | 0.833 |
| CATEGORY:WING | 5 | 5 | 4 | 0.800 |
| DISTANCE:BEYOND_10.5M | 5 | 3 | 2 | 0.667 |
| CATEGORY:PIVOT | 5 | 5 | 3 | 0.600 |

## Outliers and coverage

0 evidence-backed flags. 5956/6282 comparisons have NO_REFERENCE. Missing reference is not NORMAL.

| Match | Scope | Metric | Actual | Expected | Deviation | N | Status |
|---|---|---|---:|---:|---:|---:|---|

## How to read this report

Use N and denominators before comparing rates. Means and percentiles describe this batch. Consult per-match JSON for observed reference, contextual components, uncertainty, provenance and fallback. A keeper with 30 saves requires both on-target volume and category/pressure/quality review. NO_REFERENCE means no justified real-world verdict is possible. Engineering sanity checks are separate in summary.json.
