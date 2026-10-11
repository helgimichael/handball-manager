# Current engine benchmark

N = 20 completed matches. Engine outputs are measured samples, not real-world references.

```json
{
  "head": "77f9435e4cf8b3672847fc4242b93bb34de78ae5",
  "schemaVersion": "match-benchmarks/1",
  "identity": {
    "competition": "se_handbollsligan_herr",
    "season": "2025-26",
    "country": "SE",
    "category": "men-senior"
  },
  "profileVersions": [
    {
      "id": "SE:se_handbollsligan_herr:2025-26:regular",
      "version": "empirical-sweden/1"
    },
    {
      "id": "SE:swe-2:2025-26:regular",
      "version": "empirical-sweden/1"
    },
    {
      "id": "SE:swe-w-1:2025-26:regular",
      "version": "empirical-sweden/1"
    },
    {
      "id": "SE:swe-w-2:2025-26:regular",
      "version": "empirical-sweden/1"
    },
    {
      "id": "SE:HBL_HERR:2025-26:KEEPER_PROXY",
      "version": "empirical-sweden/1"
    }
  ],
  "inputHash": "8773162275c76de70511889789a7a7bbc4e1b9cbb4c8b2c5030eb8cafee530a7",
  "referenceHash": "28a89cbdb4b4646da550d6875cea2a86bc26717fe983ab375e8291f12911ad7a",
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
    },
    {
      "index": 2,
      "saveSeed": "match-realism-v2-canonical-2026:2",
      "managerClubId": "se_club_hammarby_if_hf"
    },
    {
      "index": 3,
      "saveSeed": "match-realism-v2-canonical-2026:3",
      "managerClubId": "se_club_hf_karlskrona"
    },
    {
      "index": 4,
      "saveSeed": "match-realism-v2-canonical-2026:4",
      "managerClubId": "se_club_hk_malmo"
    },
    {
      "index": 5,
      "saveSeed": "match-realism-v2-canonical-2026:5",
      "managerClubId": "se_club_if_hallby_hk"
    },
    {
      "index": 6,
      "saveSeed": "match-realism-v2-canonical-2026:6",
      "managerClubId": "se_club_ifk_kristianstad"
    },
    {
      "index": 7,
      "saveSeed": "match-realism-v2-canonical-2026:7",
      "managerClubId": "se_club_ifk_skovde_hk"
    },
    {
      "index": 8,
      "saveSeed": "match-realism-v2-canonical-2026:8",
      "managerClubId": "se_club_ik_savehof"
    },
    {
      "index": 9,
      "saveSeed": "match-realism-v2-canonical-2026:9",
      "managerClubId": "se_club_lugi_hf"
    },
    {
      "index": 10,
      "saveSeed": "match-realism-v2-canonical-2026:10",
      "managerClubId": "se_club_onnereds_hk"
    },
    {
      "index": 11,
      "saveSeed": "match-realism-v2-canonical-2026:11",
      "managerClubId": "se_club_ov_helsingborg"
    },
    {
      "index": 12,
      "saveSeed": "match-realism-v2-canonical-2026:12",
      "managerClubId": "se_club_skanela_if"
    },
    {
      "index": 13,
      "saveSeed": "match-realism-v2-canonical-2026:13",
      "managerClubId": "se_club_ystads_if_hf"
    },
    {
      "index": 14,
      "saveSeed": "match-realism-v2-canonical-2026:14",
      "managerClubId": "se_club_alingsas_hk"
    },
    {
      "index": 15,
      "saveSeed": "match-realism-v2-canonical-2026:15",
      "managerClubId": "se_club_amo_hk"
    },
    {
      "index": 16,
      "saveSeed": "match-realism-v2-canonical-2026:16",
      "managerClubId": "se_club_hammarby_if_hf"
    },
    {
      "index": 17,
      "saveSeed": "match-realism-v2-canonical-2026:17",
      "managerClubId": "se_club_hf_karlskrona"
    },
    {
      "index": 18,
      "saveSeed": "match-realism-v2-canonical-2026:18",
      "managerClubId": "se_club_hk_malmo"
    },
    {
      "index": 19,
      "saveSeed": "match-realism-v2-canonical-2026:19",
      "managerClubId": "se_club_if_hallby_hk"
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
      "path": "/apps/game/lib/matchBenchmarks/empirical.ts",
      "sha256": "1b05cfb0cfdb7e96870875b1042860b13221c852078eff953d31016123464d6c"
    },
    {
      "path": "/apps/game/lib/matchBenchmarks/empiricalComparison.ts",
      "sha256": "1ff1be562eca7db1385c71d087a608d60c058c1981d4df1c901c6af54196eb20"
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
      "sha256": "b4aaab2250f6141830c0f4f7b2ea9a75aaf67dd3224c33eb6858b60111bf65c7"
    }
  ],
  "sourceStable": true,
  "timings": [
    {
      "simulationMs": 13720.9031,
      "analysisMs": 1469.607899999999,
      "observerMs": 789.9280000004583
    },
    {
      "simulationMs": 11804.225699999999,
      "analysisMs": 1527.8245000000024,
      "observerMs": 623.5492000006452
    },
    {
      "simulationMs": 10424.5602,
      "analysisMs": 1443.9126000000033,
      "observerMs": 553.9224999985017
    },
    {
      "simulationMs": 9950.183499999992,
      "analysisMs": 1831.811600000001,
      "observerMs": 527.0481999991534
    },
    {
      "simulationMs": 10750.161800000002,
      "analysisMs": 1690.1285000000062,
      "observerMs": 557.4750000009662
    },
    {
      "simulationMs": 9244.49900000001,
      "analysisMs": 1422.810599999997,
      "observerMs": 460.60390000150073
    },
    {
      "simulationMs": 9028.716700000004,
      "analysisMs": 1499.3582000000024,
      "observerMs": 447.3097999991005
    },
    {
      "simulationMs": 8620.892099999997,
      "analysisMs": 1305.326000000001,
      "observerMs": 442.2684000009467
    },
    {
      "simulationMs": 8572.451799999995,
      "analysisMs": 1322.4311000000016,
      "observerMs": 441.3825000003708
    },
    {
      "simulationMs": 9017.610299999986,
      "analysisMs": 1486.8816000000224,
      "observerMs": 461.844999997993
    },
    {
      "simulationMs": 9080.798299999995,
      "analysisMs": 1583.113400000002,
      "observerMs": 469.87399999736226
    },
    {
      "simulationMs": 9223.867999999988,
      "analysisMs": 1874.6736000000092,
      "observerMs": 542.132099999726
    },
    {
      "simulationMs": 8631.414299999975,
      "analysisMs": 1976.675099999993,
      "observerMs": 412.48270000176854
    },
    {
      "simulationMs": 8074.654399999999,
      "analysisMs": 1244.5843000000168,
      "observerMs": 386.60320000338834
    },
    {
      "simulationMs": 7910.108199999988,
      "analysisMs": 1418.2350999999908,
      "observerMs": 382.6968000025663
    },
    {
      "simulationMs": 8219.148799999995,
      "analysisMs": 1434.1309000000183,
      "observerMs": 390.67659999866737
    },
    {
      "simulationMs": 8454.494299999991,
      "analysisMs": 1343.5147999999754,
      "observerMs": 429.9124999939813
    },
    {
      "simulationMs": 8471.517200000002,
      "analysisMs": 1303.5537999999942,
      "observerMs": 426.9608000005828
    },
    {
      "simulationMs": 8892.281099999993,
      "analysisMs": 1648.2256000000052,
      "observerMs": 413.18180000354187
    },
    {
      "simulationMs": 9953.443,
      "analysisMs": 1391.7684000000008,
      "observerMs": 444.3810000010126
    }
  ],
  "proofs": [
    {
      "index": 0,
      "fullMatch": true,
      "exactSessionEqual": true,
      "sessionHash": "313fe884c429aa2b2bc6aaf37326cb02ecab6a81a12a89e8790cb317562e097d",
      "resultHash": "7f2c20466d2c189d315c50d5093df8ee26ac17a7dec74d64b15199d9dac3d372",
      "observedMs": 13720.9031,
      "unobservedMs": 8853.6992,
      "observerMs": 789.9280000004583,
      "analysisMs": 1469.607899999999,
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
  "totalRuntimeMs": 245020.8647,
  "normalMatchOverhead": "Zero: benchmark modules are developer-only and never imported by production simulation."
}
```

## Match distributions

| Metric | N matches | Mean | SD | p05 | Median | p95 | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| outfieldShots | 20 | 111.750 | 5.418 | 104.900 | 112.000 | 121.150 | 103.000 | 124.000 |
| outfieldConversion | 20 | 0.457 | 0.097 | 0.346 | 0.446 | 0.613 | 0.296 | 0.632 |
| goals | 20 | 51.100 | 11.392 | 37.800 | 49.000 | 72.100 | 34.000 | 74.000 |
| possessions | 20 | 138.400 | 6.977 | 128.850 | 137.500 | 147.250 | 126.000 | 152.000 |
| shots | 20 | 111.750 | 5.418 | 104.900 | 112.000 | 121.150 | 103.000 | 124.000 |
| saves | 20 | 49.850 | 12.266 | 32.850 | 49.000 | 69.200 | 30.000 | 73.000 |
| shotsFaced | 20 | 100.950 | 6.468 | 92.750 | 101.000 | 113.200 | 88.000 | 117.000 |
| conversion | 20 | 0.457 | 0.097 | 0.346 | 0.446 | 0.613 | 0.296 | 0.632 |
| savePct | 20 | 0.493 | 0.111 | 0.343 | 0.507 | 0.640 | 0.294 | 0.663 |
| goalsPerPossession | 20 | 0.370 | 0.080 | 0.257 | 0.370 | 0.491 | 0.238 | 0.507 |
| turnovers | 20 | 33.000 | 5.572 | 25.000 | 32.000 | 42.150 | 25.000 | 45.000 |
| technicalErrors | 20 | 1.600 | 1.231 | 0.000 | 1.000 | 4.000 | 0.000 | 4.000 |
| offensiveFouls | 20 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sevenMetres | 20 | 8.900 | 3.024 | 4.950 | 9.000 | 14.050 | 4.000 | 15.000 |
| sevenMetreConversion | 20 | 0.605 | 0.167 | 0.397 | 0.578 | 0.860 | 0.333 | 0.917 |
| suspensions | 20 | 8.850 | 3.133 | 3.950 | 9.000 | 12.250 | 3.000 | 17.000 |
| contacts | 20 | 618.750 | 37.673 | 572.500 | 606.500 | 690.200 | 563.000 | 694.000 |
| assessedFouls | 20 | 65.400 | 9.891 | 52.900 | 65.500 | 80.500 | 51.000 | 90.000 |
| advantages | 20 | 25.400 | 5.586 | 18.850 | 23.500 | 34.100 | 16.000 | 36.000 |
| whistles | 20 | 40.000 | 5.876 | 30.850 | 39.500 | 49.250 | 28.000 | 54.000 |
| freeThrows | 20 | 33.550 | 5.165 | 24.950 | 34.000 | 41.050 | 24.000 | 42.000 |
| possessionSeconds | 20 | 26.074 | 1.309 | 24.441 | 26.182 | 27.940 | 23.684 | 28.571 |
| transitionPossessions | 20 | 134.250 | 7.025 | 124.900 | 133.500 | 146.050 | 123.000 | 147.000 |
| transitionAttempts | 20 | 134.750 | 7.188 | 125.850 | 134.000 | 147.050 | 123.000 | 148.000 |
| transitionShots | 20 | 7.050 | 3.203 | 2.950 | 6.500 | 13.050 | 2.000 | 14.000 |
| transitionGoals | 20 | 2.350 | 1.814 | 0.000 | 2.000 | 6.000 | 0.000 | 6.000 |
| transitionConversion | 20 | 0.319 | 0.199 | 0.000 | 0.268 | 0.669 | 0.000 | 0.714 |
| transitionRate | 20 | 0.970 | 0.015 | 0.937 | 0.971 | 0.993 | 0.932 | 0.993 |

## Shot context

Context rows overlap; CATEGORY rows partition shots. Save rate = saves / (saves + goals). Conversion = goals / attempts.

| Context | N matches | Attempts | On target | Saves | Save rate | Conversion |
|---|---:|---:|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 20 | 855 | 765 | 327 | 0.427 | 0.512 |
| POSITION:M9 | 20 | 1034 | 944 | 449 | 0.476 | 0.479 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 20 | 1597 | 1391 | 676 | 0.486 | 0.448 |
| QUALITY:LOWER_UNDER_0.65 | 20 | 1784 | 1570 | 817 | 0.520 | 0.422 |
| PHASE:ESTABLISHED | 20 | 1914 | 1716 | 848 | 0.494 | 0.454 |
| DISTANCE:8_TO_10.5M | 20 | 1262 | 1131 | 600 | 0.531 | 0.421 |
| CATEGORY:BREAKTHROUGH | 20 | 652 | 585 | 294 | 0.503 | 0.446 |
| POSITION:V9 | 20 | 327 | 302 | 143 | 0.474 | 0.486 |
| DISTANCE:BEYOND_10.5M | 20 | 207 | 168 | 84 | 0.500 | 0.406 |
| POSITION:V6 | 20 | 250 | 215 | 108 | 0.502 | 0.428 |
| PRESSURE:LOW_UNDER_0.2 | 20 | 638 | 628 | 321 | 0.511 | 0.481 |
| CATEGORY:SEVEN_METRE | 20 | 178 | 178 | 71 | 0.399 | 0.601 |
| QUALITY:HIGH_AT_LEAST_0.65 | 20 | 451 | 449 | 180 | 0.401 | 0.596 |
| PHASE:RESTART | 20 | 180 | 180 | 73 | 0.406 | 0.594 |
| DISTANCE:UP_TO_8M | 20 | 766 | 720 | 313 | 0.435 | 0.531 |
| CATEGORY:WING | 20 | 213 | 167 | 81 | 0.485 | 0.404 |
| POSITION:H6 | 20 | 218 | 185 | 94 | 0.508 | 0.417 |
| PHASE:TRANSITION | 20 | 141 | 123 | 76 | 0.618 | 0.333 |
| CONTEXT:NEAR_SIX_METRE_AREA | 20 | 544 | 477 | 221 | 0.463 | 0.471 |
| CATEGORY:STANDING | 20 | 221 | 208 | 163 | 0.784 | 0.204 |
| POSITION:H9 | 20 | 290 | 257 | 142 | 0.553 | 0.397 |
| CATEGORY:PIVOT | 20 | 116 | 116 | 61 | 0.526 | 0.474 |
| POSITION:M6 | 20 | 116 | 116 | 61 | 0.526 | 0.474 |

## Goalkeeper investigation

Rankings below describe this engine sample. They are not empirical outlier verdicts. Conditional expectations require category references and complete coverage.

### Match 15: se_player_josip_cavar_60b145a1
Saves 39; shots faced 59; save rate 0.661; attempts 62. Wilson interval 0.534–0.769.
Mean pressure 0.583; decision quality 0.551; distance 8.831m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.034.
Capabilities: {"keeper.positioning":0.736842105263158,"keeper.setPosition":0.68421052631579,"keeper.reaction":0.7894736842105256,"keeper.explosiveness":0.7894736842105256,"keeper.low":0.7894736842105256,"keeper.high":0.7368421052631579,"keeper.close":0.7368421052631579,"keeper.long":0.68421052631579,"keeper.wing":0.68421052631579,"keeper.sevenMetre":0.7368421052631579,"keeper.reading":0.7631578947368413,"keeper.outlet":0.68421052631579,"shooter.placement":0.7224108658743635,"shooter.power":0.7351443123938883,"shooter.finishing":0.7249575551782682,"shooter.wing":0.7699490662139221,"shooter.pivot":0.6884550084889639,"shooter.decision":0.6723259762308996,"shooter.composure":0.6918505942275044,"shot.pressure":0.5826913340253271,"shot.quality":0.5509571710089948,"shot.distance":8.830950360633649}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 26 | 23 | 14 | 0.609 |
| PRESSURE:LOW_UNDER_0.2 | 15 | 15 | 9 | 0.600 |
| QUALITY:LOWER_UNDER_0.65 | 50 | 47 | 33 | 0.702 |
| PHASE:ESTABLISHED | 52 | 49 | 33 | 0.673 |
| DISTANCE:8_TO_10.5M | 42 | 40 | 29 | 0.725 |
| CATEGORY:STANDING | 7 | 7 | 5 | 0.714 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 47 | 44 | 30 | 0.682 |
| CATEGORY:WING | 8 | 8 | 6 | 0.750 |
| CONTEXT:NEAR_SIX_METRE_AREA | 13 | 13 | 9 | 0.692 |
| CATEGORY:BREAKTHROUGH | 17 | 17 | 13 | 0.765 |
| PHASE:TRANSITION | 8 | 8 | 6 | 0.750 |
| CATEGORY:PIVOT | 2 | 2 | 1 | 0.500 |
| QUALITY:HIGH_AT_LEAST_0.65 | 12 | 12 | 6 | 0.500 |
| DISTANCE:UP_TO_8M | 14 | 13 | 6 | 0.462 |
| DISTANCE:BEYOND_10.5M | 6 | 6 | 4 | 0.667 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 0 | 0.000 |
| PHASE:RESTART | 2 | 2 | 0 | 0.000 |

### Match 4: player_ebbe_hakansson_132f4301
Saves 36; shots faced 51; save rate 0.706; attempts 57. Wilson interval 0.570–0.813.
Mean pressure 0.487; decision quality 0.551; distance 8.572m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.118.
Capabilities: {"keeper.positioning":0.7368421052631574,"keeper.setPosition":0.7894736842105257,"keeper.reaction":0.6842105263157894,"keeper.explosiveness":0.7894736842105257,"keeper.low":0.6842105263157894,"keeper.high":0.6842105263157894,"keeper.close":0.6842105263157894,"keeper.long":0.6842105263157894,"keeper.wing":0.6842105263157894,"keeper.sevenMetre":0.7368421052631573,"keeper.reading":0.7894736842105257,"keeper.outlet":0.6842105263157894,"shooter.placement":0.7128347183748843,"shooter.power":0.7045244690674052,"shooter.finishing":0.7008310249307479,"shooter.wing":0.6980609418282546,"shooter.pivot":0.672206832871653,"shooter.decision":0.7174515235457065,"shooter.composure":0.667590027700831,"shot.pressure":0.48670892707404434,"shot.quality":0.5508228913476111,"shot.distance":8.571541677833052}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:STANDING | 4 | 4 | 4 | 1.000 |
| PRESSURE:LOW_UNDER_0.2 | 21 | 20 | 15 | 0.750 |
| QUALITY:LOWER_UNDER_0.65 | 48 | 42 | 33 | 0.786 |
| PHASE:ESTABLISHED | 47 | 42 | 30 | 0.714 |
| DISTANCE:8_TO_10.5M | 29 | 25 | 20 | 0.800 |
| CATEGORY:BACKCOURT_JUMP | 20 | 16 | 11 | 0.688 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 36 | 31 | 21 | 0.677 |
| CATEGORY:SEVEN_METRE | 6 | 6 | 3 | 0.500 |
| QUALITY:HIGH_AT_LEAST_0.65 | 9 | 9 | 3 | 0.333 |
| PHASE:RESTART | 6 | 6 | 3 | 0.500 |
| DISTANCE:UP_TO_8M | 22 | 22 | 12 | 0.545 |
| CATEGORY:BREAKTHROUGH | 16 | 15 | 12 | 0.800 |
| CONTEXT:NEAR_SIX_METRE_AREA | 18 | 18 | 13 | 0.722 |
| DISTANCE:BEYOND_10.5M | 6 | 4 | 4 | 1.000 |
| PHASE:TRANSITION | 4 | 3 | 3 | 1.000 |
| CATEGORY:WING | 7 | 6 | 6 | 1.000 |
| CATEGORY:PIVOT | 4 | 4 | 0 | 0.000 |

### Match 8: se_player_marcus_holmen_87d487c8
Saves 36; shots faced 55; save rate 0.655; attempts 58. Wilson interval 0.523–0.766.
Mean pressure 0.601; decision quality 0.517; distance 9.154m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.036.
Capabilities: {"keeper.positioning":0.9473684210526305,"keeper.setPosition":0.8947368421052642,"keeper.reaction":0.7894736842105268,"keeper.explosiveness":0.8421052631578941,"keeper.low":0.7894736842105268,"keeper.high":0.8421052631578941,"keeper.close":0.8421052631578941,"keeper.long":0.7368421052631574,"keeper.wing":0.8421052631578941,"keeper.sevenMetre":0.7368421052631574,"keeper.reading":0.8684210526315801,"keeper.outlet":0.7368421052631574,"shooter.placement":0.7917422867513606,"shooter.power":0.8221415607985478,"shooter.finishing":0.7767695099818516,"shooter.wing":0.784029038112522,"shooter.pivot":0.7749546279491829,"shooter.decision":0.7509074410163338,"shooter.composure":0.7068965517241373,"shot.pressure":0.6006790071233998,"shot.quality":0.5174204506688838,"shot.distance":9.154398604993165}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:STANDING | 8 | 8 | 8 | 1.000 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 42 | 39 | 24 | 0.615 |
| QUALITY:LOWER_UNDER_0.65 | 52 | 49 | 33 | 0.673 |
| PHASE:ESTABLISHED | 50 | 48 | 30 | 0.625 |
| DISTANCE:8_TO_10.5M | 35 | 32 | 21 | 0.656 |
| CATEGORY:BACKCOURT_JUMP | 24 | 24 | 13 | 0.542 |
| CATEGORY:BREAKTHROUGH | 15 | 13 | 9 | 0.692 |
| QUALITY:HIGH_AT_LEAST_0.65 | 6 | 6 | 3 | 0.500 |
| DISTANCE:UP_TO_8M | 14 | 14 | 9 | 0.643 |
| CONTEXT:NEAR_SIX_METRE_AREA | 9 | 8 | 4 | 0.500 |
| CATEGORY:WING | 8 | 7 | 4 | 0.571 |
| CATEGORY:PIVOT | 1 | 1 | 0 | 0.000 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 2 | 1.000 |
| PRESSURE:LOW_UNDER_0.2 | 16 | 16 | 12 | 0.750 |
| PHASE:RESTART | 2 | 2 | 2 | 1.000 |
| DISTANCE:BEYOND_10.5M | 9 | 9 | 6 | 0.667 |
| PHASE:TRANSITION | 6 | 5 | 4 | 0.800 |

### Match 19: se_player_marcus_holmen_87d487c8
Saves 35; shots faced 51; save rate 0.686; attempts 55. Wilson interval 0.550–0.797.
Mean pressure 0.645; decision quality 0.572; distance 8.518m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.137.
Capabilities: {"keeper.positioning":0.9473684210526324,"keeper.setPosition":0.8947368421052638,"keeper.reaction":0.7894736842105259,"keeper.explosiveness":0.8421052631578936,"keeper.low":0.7894736842105259,"keeper.high":0.8421052631578936,"keeper.close":0.8421052631578936,"keeper.long":0.7368421052631573,"keeper.wing":0.8421052631578936,"keeper.sevenMetre":0.7368421052631573,"keeper.reading":0.86842105263158,"keeper.outlet":0.7368421052631573,"shooter.placement":0.7612440191387557,"shooter.power":0.777033492822966,"shooter.finishing":0.7521531100478468,"shooter.wing":0.7722488038277506,"shooter.pivot":0.7617224880382769,"shooter.decision":0.7779904306220093,"shooter.composure":0.7062200956937796,"shot.pressure":0.6451114531989204,"shot.quality":0.5715057943774629,"shot.distance":8.51767297081812}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 14 | 13 | 7 | 0.538 |
| PRESSURE:LOW_UNDER_0.2 | 16 | 16 | 12 | 0.750 |
| QUALITY:LOWER_UNDER_0.65 | 41 | 37 | 26 | 0.703 |
| PHASE:TRANSITION | 5 | 4 | 4 | 1.000 |
| DISTANCE:8_TO_10.5M | 27 | 25 | 18 | 0.720 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 39 | 35 | 23 | 0.657 |
| PHASE:ESTABLISHED | 43 | 40 | 27 | 0.675 |
| DISTANCE:BEYOND_10.5M | 4 | 3 | 2 | 0.667 |
| QUALITY:HIGH_AT_LEAST_0.65 | 14 | 14 | 9 | 0.643 |
| CATEGORY:STANDING | 7 | 7 | 7 | 1.000 |
| CATEGORY:SEVEN_METRE | 7 | 7 | 4 | 0.571 |
| PHASE:RESTART | 7 | 7 | 4 | 0.571 |
| DISTANCE:UP_TO_8M | 24 | 23 | 15 | 0.652 |
| CATEGORY:BREAKTHROUGH | 23 | 21 | 14 | 0.667 |
| CONTEXT:NEAR_SIX_METRE_AREA | 8 | 6 | 4 | 0.667 |
| CATEGORY:WING | 3 | 2 | 2 | 1.000 |
| CATEGORY:PIVOT | 1 | 1 | 1 | 1.000 |

### Match 13: player_alexander_linden_7f15da04
Saves 34; shots faced 53; save rate 0.642; attempts 56. Wilson interval 0.507–0.757.
Mean pressure 0.572; decision quality 0.589; distance 8.496m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.132.
Capabilities: {"keeper.positioning":0.7368421052631582,"keeper.setPosition":0.7368421052631582,"keeper.reaction":0.9473684210526307,"keeper.explosiveness":0.8421052631578947,"keeper.low":0.7368421052631582,"keeper.high":0.789473684210527,"keeper.close":0.8947368421052624,"keeper.long":0.789473684210527,"keeper.wing":0.789473684210527,"keeper.sevenMetre":0.789473684210527,"keeper.reading":0.7105263157894736,"keeper.outlet":0.7368421052631582,"shooter.placement":0.7443609022556387,"shooter.power":0.8139097744360905,"shooter.finishing":0.7396616541353382,"shooter.wing":0.7960526315789476,"shooter.pivot":0.8063909774436094,"shooter.decision":0.7514097744360898,"shooter.composure":0.7471804511278197,"shot.pressure":0.5723170479644838,"shot.quality":0.588868923245302,"shot.distance":8.49630535555634}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:STANDING | 9 | 9 | 7 | 0.778 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 37 | 34 | 22 | 0.647 |
| QUALITY:LOWER_UNDER_0.65 | 39 | 36 | 25 | 0.694 |
| PHASE:ESTABLISHED | 47 | 44 | 28 | 0.636 |
| DISTANCE:8_TO_10.5M | 32 | 30 | 18 | 0.600 |
| CATEGORY:PIVOT | 3 | 3 | 3 | 1.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 17 | 17 | 9 | 0.529 |
| CATEGORY:BACKCOURT_JUMP | 18 | 17 | 10 | 0.588 |
| DISTANCE:BEYOND_10.5M | 4 | 3 | 3 | 1.000 |
| DISTANCE:UP_TO_8M | 20 | 20 | 13 | 0.650 |
| CONTEXT:NEAR_SIX_METRE_AREA | 11 | 11 | 7 | 0.636 |
| PRESSURE:LOW_UNDER_0.2 | 19 | 19 | 12 | 0.632 |
| CATEGORY:BREAKTHROUGH | 17 | 15 | 9 | 0.600 |
| CATEGORY:SEVEN_METRE | 7 | 7 | 4 | 0.571 |
| PHASE:RESTART | 7 | 7 | 4 | 0.571 |
| CATEGORY:WING | 2 | 2 | 1 | 0.500 |
| PHASE:TRANSITION | 2 | 2 | 2 | 1.000 |

## Outliers and coverage

223 evidence-backed flags. 5578/6336 comparisons have NO_REFERENCE. Missing reference is not NORMAL.

| Match | Scope | Metric | Actual | Expected | Deviation | N | Status |
|---|---|---|---:|---:|---:|---:|---|
| 0 | MATCH | outfieldShots | 115 | 97.89010989010988 | 17.109890109890117 | 1 | WATCH |
| 0 | KEEPER | savePct | 0.5166666666666667 | 0.28565487560078895 | 0.23101179106587777 | 60 | WATCH |
| 0 | KEEPER | saves | 31 | 8.9 | 22.1 | 1 | EXTREME |
| 0 | KEEPER | shotsFaced | 60 | 29.814583333333335 | 30.185416666666665 | 1 | WATCH |
| 0 | TEAM | scorerConcentration | 0.45161290322580644 | 0.2502312929557239 | 0.20138161027008256 | 31 | OUTLIER |
| 0 | TEAM | shotConcentration | 0.36 | 0.2373419572983402 | 0.12265804270165978 | 50 | WATCH |
| 0 | TEAM | scorerHHI | 0.2757544224765869 | 0.1580347284407489 | 0.11771969403583799 | 31 | EXTREME |
| 0 | TEAM | scorerConcentration | 0.5172413793103449 | 0.2502312929557239 | 0.267010086354621 | 29 | EXTREME |
| 0 | TEAM | shotConcentration | 0.4153846153846154 | 0.2373419572983402 | 0.1780426580862752 | 65 | OUTLIER |
| 0 | TEAM | scorerHHI | 0.3269916765755054 | 0.1580347284407489 | 0.16895694813475648 | 29 | EXTREME |
| 1 | MATCH | outfieldShots | 114 | 97.89010989010988 | 16.109890109890117 | 1 | WATCH |
| 1 | MATCH | outfieldConversion | 0.40350877192982454 | 0.6197929853078333 | -0.2162842133780088 | 114 | EXTREME |
| 1 | MATCH | goals | 46 | 60.857142857142854 | -14.857142857142854 | 1 | WATCH |
| 1 | KEEPER | savePct | 0.5686274509803921 | 0.28565487560078895 | 0.2829725753796032 | 51 | WATCH |
| 1 | KEEPER | saves | 29 | 8.9 | 20.1 | 1 | EXTREME |
| 1 | KEEPER | savePct | 0.5 | 0.28565487560078895 | 0.21434512439921105 | 48 | WATCH |
| 1 | KEEPER | saves | 24 | 8.9 | 15.1 | 1 | OUTLIER |
| 1 | TEAM | scorerConcentration | 0.375 | 0.2502312929557239 | 0.12476870704427612 | 24 | WATCH |
| 1 | TEAM | shotConcentration | 0.38596491228070173 | 0.2373419572983402 | 0.14862295498236153 | 57 | WATCH |
| 1 | TEAM | scorerHHI | 0.2881944444444444 | 0.1580347284407489 | 0.13015971600369552 | 24 | EXTREME |
| 1 | TEAM | scorerConcentration | 0.6363636363636364 | 0.2502312929557239 | 0.38613234340791247 | 22 | EXTREME |
| 1 | TEAM | shotConcentration | 0.5789473684210527 | 0.2373419572983402 | 0.3416054111227125 | 57 | EXTREME |
| 1 | TEAM | scorerHHI | 0.44628099173553715 | 0.1580347284407489 | 0.28824626329478825 | 22 | EXTREME |
| 2 | MATCH | outfieldShots | 113 | 97.89010989010988 | 15.109890109890117 | 1 | WATCH |
| 2 | MATCH | outfieldConversion | 0.5132743362831859 | 0.6197929853078333 | -0.10651864902464747 | 113 | WATCH |
| 2 | MATCH | suspensions | 9 | 4.802197802197802 | 4.197802197802198 | 1 | WATCH |
| 2 | KEEPER | savePct | 0.49056603773584906 | 0.28565487560078895 | 0.2049111621350601 | 53 | WATCH |
| 2 | KEEPER | saves | 26 | 8.9 | 17.1 | 1 | OUTLIER |
| 2 | KEEPER | shotsFaced | 53 | 29.814583333333335 | 23.185416666666665 | 1 | WATCH |
| 2 | KEEPER | saves | 20 | 8.9 | 11.1 | 1 | WATCH |
| 2 | TEAM | scorerConcentration | 0.5555555555555556 | 0.2502312929557239 | 0.3053242625998317 | 27 | EXTREME |
| 2 | TEAM | shotConcentration | 0.46296296296296297 | 0.2373419572983402 | 0.22562100566462276 | 54 | EXTREME |
| 2 | TEAM | scorerHHI | 0.3580246913580247 | 0.1580347284407489 | 0.19998996291727583 | 27 | EXTREME |
| 3 | MATCH | outfieldConversion | 0.5048543689320388 | 0.6197929853078333 | -0.1149386163757945 | 103 | WATCH |
| 3 | KEEPER | savePct | 0.58 | 0.28565487560078895 | 0.294345124399211 | 50 | WATCH |
| 3 | KEEPER | saves | 29 | 8.9 | 20.1 | 1 | EXTREME |
| 3 | TEAM | goalsPerTeam | 21 | 30.428571428571427 | -9.428571428571427 | 1 | WATCH |
| 3 | TEAM | scorerConcentration | 0.5714285714285714 | 0.2502312929557239 | 0.3211972784728475 | 21 | EXTREME |
| 3 | TEAM | shotConcentration | 0.3584905660377358 | 0.2373419572983402 | 0.12114860873939562 | 53 | WATCH |
| 3 | TEAM | scorerHHI | 0.37414965986394544 | 0.1580347284407489 | 0.21611493142319654 | 21 | EXTREME |
| 3 | TEAM | scorerConcentration | 0.4838709677419355 | 0.2502312929557239 | 0.23363967478621162 | 31 | EXTREME |
| 3 | TEAM | shotConcentration | 0.46 | 0.2373419572983402 | 0.22265804270165981 | 50 | EXTREME |
| 3 | TEAM | scorerHHI | 0.3007284079084288 | 0.1580347284407489 | 0.1426936794676799 | 31 | EXTREME |
| 4 | MATCH | outfieldConversion | 0.35185185185185186 | 0.6197929853078333 | -0.2679411334559815 | 108 | EXTREME |
| 4 | MATCH | goals | 38 | 60.857142857142854 | -22.857142857142854 | 1 | OUTLIER |
| 4 | MATCH | suspensions | 12 | 4.802197802197802 | 7.197802197802198 | 1 | OUTLIER |
| 4 | KEEPER | savePct | 0.5 | 0.28565487560078895 | 0.21434512439921105 | 46 | WATCH |
| 4 | KEEPER | saves | 23 | 8.9 | 14.1 | 1 | OUTLIER |
| 4 | KEEPER | savePct | 0.7058823529411765 | 0.28565487560078895 | 0.42022747734038757 | 51 | EXTREME |
| 4 | KEEPER | saves | 36 | 8.9 | 27.1 | 1 | EXTREME |
| 4 | TEAM | scorerConcentration | 0.391304347826087 | 0.2502312929557239 | 0.1410730548703631 | 23 | WATCH |
| 4 | TEAM | shotConcentration | 0.45098039215686275 | 0.2373419572983402 | 0.21363843485852255 | 51 | EXTREME |
| 4 | TEAM | scorerHHI | 0.2627599243856333 | 0.1580347284407489 | 0.10472519594488439 | 23 | OUTLIER |
| 4 | TEAM | goalsPerTeam | 15 | 30.428571428571427 | -15.428571428571427 | 1 | OUTLIER |
| 4 | TEAM | scorerConcentration | 0.4666666666666667 | 0.2502312929557239 | 0.2164353737109428 | 15 | OUTLIER |
| 4 | TEAM | shotConcentration | 0.40350877192982454 | 0.2373419572983402 | 0.16616681463148433 | 57 | OUTLIER |
| 4 | TEAM | scorerHHI | 0.29777777777777775 | 0.1580347284407489 | 0.13974304933702886 | 15 | EXTREME |
| 5 | MATCH | outfieldConversion | 0.39285714285714285 | 0.6197929853078333 | -0.22693584245069048 | 112 | EXTREME |
| 5 | MATCH | goals | 44 | 60.857142857142854 | -16.857142857142854 | 1 | WATCH |
| 5 | KEEPER | savePct | 0.5471698113207547 | 0.28565487560078895 | 0.26151493571996576 | 53 | WATCH |
| 5 | KEEPER | saves | 29 | 8.9 | 20.1 | 1 | EXTREME |
| 5 | KEEPER | shotsFaced | 53 | 29.814583333333335 | 23.185416666666665 | 1 | WATCH |
| 5 | KEEPER | savePct | 0.5833333333333334 | 0.28565487560078895 | 0.2976784577325444 | 48 | OUTLIER |
| 5 | KEEPER | saves | 28 | 8.9 | 19.1 | 1 | EXTREME |
| 5 | TEAM | scorerConcentration | 0.5 | 0.2502312929557239 | 0.24976870704427612 | 24 | EXTREME |
| 5 | TEAM | shotConcentration | 0.3559322033898305 | 0.2373419572983402 | 0.1185902460914903 | 59 | WATCH |
| 5 | TEAM | scorerHHI | 0.30902777777777773 | 0.1580347284407489 | 0.15099304933702884 | 24 | EXTREME |
| 5 | TEAM | goalsPerTeam | 20 | 30.428571428571427 | -10.428571428571427 | 1 | WATCH |
| 5 | TEAM | shotConcentration | 0.4528301886792453 | 0.2373419572983402 | 0.2154882313809051 | 53 | EXTREME |
| 5 | TEAM | scorerHHI | 0.31 | 0.1580347284407489 | 0.1519652715592511 | 20 | EXTREME |
| 6 | MATCH | suspensions | 11 | 4.802197802197802 | 6.197802197802198 | 1 | OUTLIER |
| 6 | KEEPER | saves | 21 | 8.9 | 12.1 | 1 | WATCH |
| 6 | KEEPER | shotsFaced | 52 | 29.814583333333335 | 22.185416666666665 | 1 | WATCH |
| 6 | TEAM | scorerConcentration | 0.4482758620689655 | 0.2502312929557239 | 0.19804456911324164 | 29 | OUTLIER |
| 6 | TEAM | scorerHHI | 0.267538644470868 | 0.1580347284407489 | 0.10950391603011911 | 29 | OUTLIER |
| 6 | TEAM | scorerConcentration | 0.3870967741935484 | 0.2502312929557239 | 0.1368654812378245 | 31 | WATCH |
| 6 | TEAM | shotConcentration | 0.41818181818181815 | 0.2373419572983402 | 0.18083986088347795 | 55 | OUTLIER |
| 6 | TEAM | scorerHHI | 0.2216441207075962 | 0.1580347284407489 | 0.06360939226684731 | 31 | WATCH |
| 7 | MATCH | outfieldConversion | 0.38317757009345793 | 0.6197929853078333 | -0.2366154152143754 | 107 | EXTREME |
| 7 | MATCH | goals | 41 | 60.857142857142854 | -19.857142857142854 | 1 | WATCH |
| 7 | KEEPER | savePct | 0.4897959183673469 | 0.28565487560078895 | 0.20414104276655798 | 49 | WATCH |
| 7 | KEEPER | saves | 24 | 8.9 | 15.1 | 1 | OUTLIER |
| 7 | KEEPER | savePct | 0.673469387755102 | 0.28565487560078895 | 0.38781451215431306 | 49 | OUTLIER |
| 7 | KEEPER | saves | 33 | 8.9 | 24.1 | 1 | EXTREME |
| 7 | TEAM | shotConcentration | 0.39215686274509803 | 0.2373419572983402 | 0.15481490544675783 | 51 | WATCH |
| 7 | TEAM | scorerHHI | 0.2224 | 0.1580347284407489 | 0.06436527155925109 | 25 | WATCH |
| 7 | TEAM | goalsPerTeam | 16 | 30.428571428571427 | -14.428571428571427 | 1 | OUTLIER |
| 7 | TEAM | shotConcentration | 0.44642857142857145 | 0.2373419572983402 | 0.20908661413023125 | 56 | OUTLIER |
| 7 | TEAM | scorerHHI | 0.21875 | 0.1580347284407489 | 0.060715271559251105 | 16 | WATCH |
| 8 | MATCH | outfieldConversion | 0.3482142857142857 | 0.6197929853078333 | -0.27157869959354763 | 112 | EXTREME |
| 8 | MATCH | goals | 39 | 60.857142857142854 | -21.857142857142854 | 1 | OUTLIER |
| 8 | MATCH | suspensions | 9 | 4.802197802197802 | 4.197802197802198 | 1 | WATCH |
| 8 | CATEGORY:SEVEN_METRE | savePct | 0.6 | 0.19748991850640177 | 0.40251008149359824 | 10 | WATCH |
| 8 | KEEPER | savePct | 0.6545454545454545 | 0.28565487560078895 | 0.3688905789446656 | 55 | OUTLIER |
| 8 | KEEPER | saves | 36 | 8.9 | 27.1 | 1 | EXTREME |
| 8 | KEEPER | shotsFaced | 55 | 29.814583333333335 | 25.185416666666665 | 1 | WATCH |
| 8 | KEEPER | savePct | 0.6226415094339622 | 0.28565487560078895 | 0.3369866338331733 | 53 | OUTLIER |
| 8 | KEEPER | saves | 33 | 8.9 | 24.1 | 1 | EXTREME |
| 8 | KEEPER | shotsFaced | 53 | 29.814583333333335 | 23.185416666666665 | 1 | WATCH |
| 8 | TEAM | goalsPerTeam | 19 | 30.428571428571427 | -11.428571428571427 | 1 | WATCH |
| 8 | TEAM | scorerConcentration | 0.42105263157894735 | 0.2502312929557239 | 0.17082133862322346 | 19 | OUTLIER |
| 8 | TEAM | shotConcentration | 0.3620689655172414 | 0.2373419572983402 | 0.12472700821890118 | 58 | WATCH |
| 8 | TEAM | scorerHHI | 0.24099722991689748 | 0.1580347284407489 | 0.08296250147614859 | 19 | WATCH |
| 8 | TEAM | goalsPerTeam | 20 | 30.428571428571427 | -10.428571428571427 | 1 | WATCH |
| 9 | MATCH | outfieldConversion | 0.45794392523364486 | 0.6197929853078333 | -0.16184906007418848 | 107 | OUTLIER |
| 9 | MATCH | sevenMetres | 15 | 6.582417582417582 | 8.417582417582418 | 1 | OUTLIER |
| 9 | MATCH | suspensions | 17 | 4.802197802197802 | 12.197802197802197 | 1 | EXTREME |
| 9 | KEEPER | saves | 20 | 8.9 | 11.1 | 1 | WATCH |
| 9 | KEEPER | shotsFaced | 53 | 29.814583333333335 | 23.185416666666665 | 1 | WATCH |
| 9 | KEEPER | savePct | 0.673469387755102 | 0.28565487560078895 | 0.38781451215431306 | 49 | OUTLIER |
| 9 | KEEPER | saves | 33 | 8.9 | 24.1 | 1 | EXTREME |
| 9 | TEAM | shotConcentration | 0.35714285714285715 | 0.2373419572983402 | 0.11980089984451694 | 56 | WATCH |
| 9 | TEAM | goalsPerTeam | 16 | 30.428571428571427 | -14.428571428571427 | 1 | OUTLIER |
| 9 | TEAM | scorerConcentration | 0.375 | 0.2502312929557239 | 0.12476870704427612 | 16 | WATCH |
| 9 | TEAM | shotConcentration | 0.43137254901960786 | 0.2373419572983402 | 0.19403059172126766 | 51 | OUTLIER |
| 9 | TEAM | scorerHHI | 0.2578125 | 0.1580347284407489 | 0.0997777715592511 | 16 | OUTLIER |
| 10 | MATCH | outfieldShots | 121 | 97.89010989010988 | 23.109890109890117 | 1 | OUTLIER |
| 10 | MATCH | sevenMetres | 12 | 6.582417582417582 | 5.417582417582418 | 1 | WATCH |
| 10 | MATCH | suspensions | 11 | 4.802197802197802 | 6.197802197802198 | 1 | OUTLIER |
| 10 | KEEPER | shotsFaced | 58 | 29.814583333333335 | 28.185416666666665 | 1 | WATCH |
| 10 | KEEPER | saves | 21 | 8.9 | 12.1 | 1 | WATCH |
| 10 | KEEPER | shotsFaced | 55 | 29.814583333333335 | 25.185416666666665 | 1 | WATCH |
| 10 | TEAM | goalsPerTeam | 40 | 30.428571428571427 | 9.571428571428573 | 1 | WATCH |
| 10 | TEAM | scorerConcentration | 0.625 | 0.2502312929557239 | 0.3747687070442761 | 40 | EXTREME |
| 10 | TEAM | shotConcentration | 0.47540983606557374 | 0.2373419572983402 | 0.23806787876723354 | 61 | EXTREME |
| 10 | TEAM | scorerHHI | 0.4124999999999999 | 0.1580347284407489 | 0.254465271559251 | 40 | EXTREME |
| 10 | TEAM | scorerConcentration | 0.6764705882352942 | 0.2502312929557239 | 0.4262392952795703 | 34 | EXTREME |
| 10 | TEAM | shotConcentration | 0.6 | 0.2373419572983402 | 0.3626580427016598 | 60 | EXTREME |
| 10 | TEAM | scorerHHI | 0.4896193771626298 | 0.1580347284407489 | 0.3315846487218809 | 34 | EXTREME |
| 11 | MATCH | outfieldShots | 118 | 97.89010989010988 | 20.109890109890117 | 1 | WATCH |
| 11 | MATCH | suspensions | 10 | 4.802197802197802 | 5.197802197802198 | 1 | WATCH |
| 11 | KEEPER | saves | 20 | 8.9 | 11.1 | 1 | WATCH |
| 11 | TEAM | scorerConcentration | 0.7741935483870968 | 0.2502312929557239 | 0.5239622554313729 | 31 | EXTREME |
| 11 | TEAM | shotConcentration | 0.6779661016949152 | 0.2373419572983402 | 0.44062414439657505 | 59 | EXTREME |
| 11 | TEAM | scorerHHI | 0.6108220603537982 | 0.1580347284407489 | 0.45278733191304926 | 31 | EXTREME |
| 11 | TEAM | scorerConcentration | 0.3939393939393939 | 0.2502312929557239 | 0.14370810098367004 | 33 | WATCH |
| 11 | TEAM | scorerHHI | 0.22681359044995406 | 0.1580347284407489 | 0.06877886200920516 | 33 | WATCH |
| 12 | MATCH | outfieldShots | 113 | 97.89010989010988 | 15.109890109890117 | 1 | WATCH |
| 12 | MATCH | outfieldConversion | 0.4336283185840708 | 0.6197929853078333 | -0.18616466672376253 | 113 | OUTLIER |
| 12 | KEEPER | saves | 22 | 8.9 | 13.1 | 1 | WATCH |
| 12 | KEEPER | savePct | 0.52 | 0.28565487560078895 | 0.23434512439921107 | 50 | WATCH |
| 12 | KEEPER | saves | 26 | 8.9 | 17.1 | 1 | OUTLIER |
| 12 | TEAM | scorerHHI | 0.2384 | 0.1580347284407489 | 0.0803652715592511 | 25 | WATCH |
| 12 | TEAM | scorerConcentration | 0.4166666666666667 | 0.2502312929557239 | 0.1664353737109428 | 24 | WATCH |
| 12 | TEAM | shotConcentration | 0.42105263157894735 | 0.2373419572983402 | 0.18371067428060714 | 57 | OUTLIER |
| 12 | TEAM | scorerHHI | 0.2847222222222222 | 0.1580347284407489 | 0.12668749378147331 | 24 | EXTREME |
| 13 | MATCH | outfieldConversion | 0.35714285714285715 | 0.6197929853078333 | -0.2626501281649762 | 112 | EXTREME |
| 13 | MATCH | goals | 40 | 60.857142857142854 | -20.857142857142854 | 1 | OUTLIER |
| 13 | MATCH | sevenMetres | 13 | 6.582417582417582 | 6.417582417582418 | 1 | WATCH |
| 13 | MATCH | suspensions | 12 | 4.802197802197802 | 7.197802197802198 | 1 | OUTLIER |
| 13 | CATEGORY:SEVEN_METRE | savePct | 0.5384615384615384 | 0.19748991850640177 | 0.3409716199551367 | 13 | WATCH |
| 13 | KEEPER | savePct | 0.5625 | 0.28565487560078895 | 0.27684512439921105 | 48 | WATCH |
| 13 | KEEPER | saves | 27 | 8.9 | 18.1 | 1 | OUTLIER |
| 13 | KEEPER | savePct | 0.6415094339622641 | 0.28565487560078895 | 0.35585455836147517 | 53 | OUTLIER |
| 13 | KEEPER | saves | 34 | 8.9 | 25.1 | 1 | EXTREME |
| 13 | KEEPER | shotsFaced | 53 | 29.814583333333335 | 23.185416666666665 | 1 | WATCH |
| 13 | TEAM | goalsPerTeam | 21 | 30.428571428571427 | -9.428571428571427 | 1 | WATCH |
| 13 | TEAM | scorerConcentration | 0.5714285714285714 | 0.2502312929557239 | 0.3211972784728475 | 21 | EXTREME |
| 13 | TEAM | shotConcentration | 0.5892857142857143 | 0.2373419572983402 | 0.3519437569873741 | 56 | EXTREME |
| 13 | TEAM | scorerHHI | 0.4058956916099773 | 0.1580347284407489 | 0.2478609631692284 | 21 | EXTREME |
| 13 | TEAM | goalsPerTeam | 19 | 30.428571428571427 | -11.428571428571427 | 1 | WATCH |
| 13 | TEAM | scorerConcentration | 0.47368421052631576 | 0.2502312929557239 | 0.22345291757059188 | 19 | EXTREME |
| 13 | TEAM | shotConcentration | 0.4642857142857143 | 0.2373419572983402 | 0.2269437569873741 | 56 | EXTREME |
| 13 | TEAM | scorerHHI | 0.31855955678670356 | 0.1580347284407489 | 0.16052482834595466 | 19 | EXTREME |
| 14 | MATCH | outfieldShots | 114 | 97.89010989010988 | 16.109890109890117 | 1 | WATCH |
| 14 | MATCH | sevenMetres | 14 | 6.582417582417582 | 7.417582417582418 | 1 | OUTLIER |
| 14 | MATCH | suspensions | 10 | 4.802197802197802 | 5.197802197802198 | 1 | WATCH |
| 14 | KEEPER | shotsFaced | 55 | 29.814583333333335 | 25.185416666666665 | 1 | WATCH |
| 14 | KEEPER | saves | 19 | 8.9 | 10.1 | 1 | WATCH |
| 14 | TEAM | goalsPerTeam | 44 | 30.428571428571427 | 13.571428571428573 | 1 | OUTLIER |
| 14 | TEAM | scorerConcentration | 0.4772727272727273 | 0.2502312929557239 | 0.2270414343170034 | 44 | EXTREME |
| 14 | TEAM | shotConcentration | 0.45161290322580644 | 0.2373419572983402 | 0.21427094592746623 | 62 | EXTREME |
| 14 | TEAM | scorerHHI | 0.30888429752066116 | 0.1580347284407489 | 0.15084956907991226 | 44 | EXTREME |
| 14 | TEAM | scorerConcentration | 0.6428571428571429 | 0.2502312929557239 | 0.392625849901419 | 28 | EXTREME |
| 14 | TEAM | shotConcentration | 0.4423076923076923 | 0.2373419572983402 | 0.20496573500935208 | 52 | OUTLIER |
| 14 | TEAM | scorerHHI | 0.4438775510204082 | 0.1580347284407489 | 0.2858428225796593 | 28 | EXTREME |
| 15 | MATCH | outfieldShots | 124 | 97.89010989010988 | 26.109890109890117 | 1 | OUTLIER |
| 15 | MATCH | outfieldConversion | 0.3548387096774194 | 0.6197929853078333 | -0.26495427563041396 | 124 | EXTREME |
| 15 | MATCH | goals | 44 | 60.857142857142854 | -16.857142857142854 | 1 | WATCH |
| 15 | MATCH | suspensions | 10 | 4.802197802197802 | 5.197802197802198 | 1 | WATCH |
| 15 | KEEPER | savePct | 0.6610169491525424 | 0.28565487560078895 | 0.37536207355175344 | 59 | OUTLIER |
| 15 | KEEPER | saves | 39 | 8.9 | 30.1 | 1 | EXTREME |
| 15 | KEEPER | shotsFaced | 59 | 29.814583333333335 | 29.185416666666665 | 1 | WATCH |
| 15 | KEEPER | savePct | 0.5862068965517241 | 0.28565487560078895 | 0.30055202095093514 | 58 | OUTLIER |
| 15 | KEEPER | saves | 34 | 8.9 | 25.1 | 1 | EXTREME |
| 15 | KEEPER | shotsFaced | 58 | 29.814583333333335 | 28.185416666666665 | 1 | WATCH |
| 15 | TEAM | goalsPerTeam | 20 | 30.428571428571427 | -10.428571428571427 | 1 | WATCH |
| 15 | TEAM | scorerConcentration | 0.4 | 0.2502312929557239 | 0.14976870704427614 | 20 | WATCH |
| 15 | TEAM | scorerHHI | 0.27 | 0.1580347284407489 | 0.11196527155925112 | 20 | OUTLIER |
| 15 | TEAM | scorerHHI | 0.2222222222222222 | 0.1580347284407489 | 0.06418749378147331 | 24 | WATCH |
| 16 | KEEPER | saves | 23 | 8.9 | 14.1 | 1 | OUTLIER |
| 16 | TEAM | shotConcentration | 0.39215686274509803 | 0.2373419572983402 | 0.15481490544675783 | 51 | WATCH |
| 16 | TEAM | scorerConcentration | 0.42857142857142855 | 0.2502312929557239 | 0.17834013561570466 | 28 | OUTLIER |
| 16 | TEAM | shotConcentration | 0.43859649122807015 | 0.2373419572983402 | 0.20125453392972995 | 57 | OUTLIER |
| 16 | TEAM | scorerHHI | 0.2525510204081632 | 0.1580347284407489 | 0.09451629196741429 | 28 | OUTLIER |
| 17 | TEAM | scorerConcentration | 0.72 | 0.2502312929557239 | 0.4697687070442761 | 25 | EXTREME |
| 17 | TEAM | shotConcentration | 0.5849056603773585 | 0.2373419572983402 | 0.3475637030790183 | 53 | EXTREME |
| 17 | TEAM | scorerHHI | 0.5328000000000002 | 0.1580347284407489 | 0.37476527155925127 | 25 | EXTREME |
| 17 | TEAM | scorerConcentration | 0.5666666666666667 | 0.2502312929557239 | 0.31643537371094277 | 30 | EXTREME |
| 17 | TEAM | shotConcentration | 0.5384615384615384 | 0.2373419572983402 | 0.30111958116319826 | 52 | EXTREME |
| 17 | TEAM | scorerHHI | 0.37111111111111106 | 0.1580347284407489 | 0.21307638267036216 | 30 | EXTREME |
| 18 | MATCH | outfieldConversion | 0.4095238095238095 | 0.6197929853078333 | -0.21026917578402382 | 105 | EXTREME |
| 18 | MATCH | goals | 43 | 60.857142857142854 | -17.857142857142854 | 1 | WATCH |
| 18 | KEEPER | saves | 22 | 8.9 | 13.1 | 1 | WATCH |
| 18 | KEEPER | savePct | 0.6086956521739131 | 0.28565487560078895 | 0.32304077657312413 | 46 | OUTLIER |
| 18 | KEEPER | saves | 28 | 8.9 | 19.1 | 1 | EXTREME |
| 18 | TEAM | scorerConcentration | 0.44 | 0.2502312929557239 | 0.18976870704427612 | 25 | OUTLIER |
| 18 | TEAM | shotConcentration | 0.42857142857142855 | 0.2373419572983402 | 0.19122947127308834 | 56 | OUTLIER |
| 18 | TEAM | scorerHHI | 0.2512 | 0.1580347284407489 | 0.09316527155925108 | 25 | OUTLIER |
| 18 | TEAM | goalsPerTeam | 18 | 30.428571428571427 | -12.428571428571427 | 1 | WATCH |
| 18 | TEAM | scorerConcentration | 0.4444444444444444 | 0.2502312929557239 | 0.19421315148872054 | 18 | OUTLIER |
| 18 | TEAM | scorerHHI | 0.24691358024691362 | 0.1580347284407489 | 0.08887885180616473 | 18 | OUTLIER |
| 19 | MATCH | outfieldShots | 115 | 97.89010989010988 | 17.109890109890117 | 1 | WATCH |
| 19 | MATCH | outfieldConversion | 0.2956521739130435 | 0.6197929853078333 | -0.32414081139478984 | 115 | EXTREME |
| 19 | MATCH | goals | 34 | 60.857142857142854 | -26.857142857142854 | 1 | EXTREME |
| 19 | MATCH | suspensions | 10 | 4.802197802197802 | 5.197802197802198 | 1 | WATCH |
| 19 | KEEPER | savePct | 0.6862745098039216 | 0.28565487560078895 | 0.4006196342031326 | 51 | EXTREME |
| 19 | KEEPER | saves | 35 | 8.9 | 26.1 | 1 | EXTREME |
| 19 | KEEPER | savePct | 0.64 | 0.28565487560078895 | 0.35434512439921106 | 50 | OUTLIER |
| 19 | KEEPER | saves | 32 | 8.9 | 23.1 | 1 | EXTREME |
| 19 | TEAM | goalsPerTeam | 16 | 30.428571428571427 | -14.428571428571427 | 1 | OUTLIER |
| 19 | TEAM | shotConcentration | 0.45454545454545453 | 0.2373419572983402 | 0.21720349724711432 | 55 | EXTREME |
| 19 | TEAM | goalsPerTeam | 18 | 30.428571428571427 | -12.428571428571427 | 1 | WATCH |

## How to read this report

Use N and denominators before comparing rates. Means and percentiles describe this batch. Consult per-match JSON for observed reference, contextual components, uncertainty, provenance and fallback. A keeper with 30 saves requires both on-target volume and category/pressure/quality review. NO_REFERENCE means no justified real-world verdict is possible. Engineering sanity checks are separate in summary.json.
