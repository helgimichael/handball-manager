# Current engine benchmark

N = 20 completed matches. Engine outputs are measured samples, not real-world references.

```json
{
  "head": "d36be32d342c502fabc69898442901e2ebd67667",
  "schemaVersion": "match-benchmarks/1",
  "identity": {
    "competition": "swe-2",
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
  "inputHash": "37b2f9ee4648ede1a422549fb680bad5c172ebdf70c77f65334d2e6487ab0347",
  "referenceHash": "28a89cbdb4b4646da550d6875cea2a86bc26717fe983ab375e8291f12911ad7a",
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
      "sha256": "fbe8bb6d065b75b8961b8552b8149120ff858ff6619f10f69a907203d6d99df2"
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
      "sha256": "a9b08eb6f65e63cd0cbd9617dbbedae5e51fe48f965a74d6981b9f96a7859ac5"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/ledger.ts",
      "sha256": "dd801ce6401a106d772eac46c5800eb46f218d34495f41ec1ff536aec24116c9"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/locomotion.ts",
      "sha256": "c222d4240a0b0935e552fa37a7c1dcf7a999d48ca4e4e200ce5befabbc860b13"
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
      "path": "/packages/handball-engine/src/v2/core/movement.ts",
      "sha256": "a5c531ad8d2cefa5623a7325b22f7f6d78c2e8bd20ca9aef87369112e5ae2037"
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
      "sha256": "30950c558dbdbcb6694ededd7a7b75c62791432b7e67dfe947ba707f476e97dc"
    },
    {
      "path": "/packages/handball-engine/src/v2/core/structure.ts",
      "sha256": "41eacb80b3f092864e79d268fd2227349de64a25d7be7436ee591623354342d9"
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
      "sha256": "dd17bb24e37777863cf498b97469254999ed153ef8faf00ffd9a5d8466fb293f"
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
      "sha256": "5890b27ac36dac3c363ff4c05752d7ad45d511434ed83ca7bf569bc92c066a91"
    },
    {
      "path": "/apps/game/scripts/lib/motionQualityDiagnostics.ts",
      "sha256": "f16f2266bfc50abe83be46ab4844d478afd945a817b16750ecdd9e3ba9928549"
    }
  ],
  "sourceStable": true,
  "timings": [
    {
      "simulationMs": 30763.7522,
      "analysisMs": 4443.284500000002,
      "observerMs": 5623.670899999452
    },
    {
      "simulationMs": 40153.93759999999,
      "analysisMs": 5695.996100000004,
      "observerMs": 8099.333899997073
    },
    {
      "simulationMs": 29583.863699999987,
      "analysisMs": 3849.263899999991,
      "observerMs": 1699.7579999978188
    },
    {
      "simulationMs": 39079.3346,
      "analysisMs": 5140.251199999999,
      "observerMs": 2026.0052000015567
    },
    {
      "simulationMs": 30920.71529999998,
      "analysisMs": 9605.924700000003,
      "observerMs": 1581.395800001541
    },
    {
      "simulationMs": 68150.69480000003,
      "analysisMs": 10148.063699999999,
      "observerMs": 3744.3106999970623
    },
    {
      "simulationMs": 82417.79869999998,
      "analysisMs": 4966.1488000000245,
      "observerMs": 4239.93419999734
    },
    {
      "simulationMs": 32593.372399999993,
      "analysisMs": 16164.763000000035,
      "observerMs": 1755.1720000101486
    },
    {
      "simulationMs": 74526.48029999994,
      "analysisMs": 28859.291199999978,
      "observerMs": 4552.660699993896
    },
    {
      "simulationMs": 49385.61210000003,
      "analysisMs": 8215.71530000004,
      "observerMs": 2820.321899999748
    },
    {
      "simulationMs": 80096.6274,
      "analysisMs": 20293.083100000047,
      "observerMs": 5055.785800019512
    },
    {
      "simulationMs": 82080.00410000002,
      "analysisMs": 5962.358800000045,
      "observerMs": 4974.876499986742
    },
    {
      "simulationMs": 49316.45079999999,
      "analysisMs": 27137.24179999996,
      "observerMs": 3019.516799988458
    },
    {
      "simulationMs": 104736.95050000004,
      "analysisMs": 9433.306599999894,
      "observerMs": 6719.937900015968
    },
    {
      "simulationMs": 75369.29989999998,
      "analysisMs": 25323.83400000003,
      "observerMs": 4707.669899998466
    },
    {
      "simulationMs": 76945.63180000009,
      "analysisMs": 3820.723999999929,
      "observerMs": 4814.86889998219
    },
    {
      "simulationMs": 32589.34689999977,
      "analysisMs": 13051.400499999989,
      "observerMs": 1843.73480003234
    },
    {
      "simulationMs": 94644.67130000005,
      "analysisMs": 14555.293899999931,
      "observerMs": 5927.4522999862675
    },
    {
      "simulationMs": 52311.31930000009,
      "analysisMs": 10685.89680000022,
      "observerMs": 3014.6663999985904
    },
    {
      "simulationMs": 89646.29900000012,
      "analysisMs": 2287.814400000032,
      "observerMs": 5899.103899992071
    }
  ],
  "proofs": [
    {
      "index": 0,
      "fullMatch": true,
      "exactSessionEqual": true,
      "sessionHash": "e0d462a8800886a3bb1ce2d088c73011edccd413fce64d7926a78b40195504fc",
      "resultHash": "97e96527bf39351f5210700d212d021d272ba01fbca268d313a4aabc42529976",
      "observedMs": 30763.7522,
      "unobservedMs": 15969.362500000003,
      "observerMs": 5623.670899999452,
      "analysisMs": 4443.284500000002,
      "includes": [
        "result",
        "events",
        "rng",
        "archive frames",
        "core statistics"
      ],
      "postAnalysisSessionUnchanged": true
    },
    {
      "index": 0,
      "saveReloadFullMatch": true,
      "exactSessionEqual": true,
      "checkpoint": "JSON persisted career after two 10000-tick chunks",
      "includes": [
        "result",
        "events",
        "rng",
        "trajectories",
        "archive frames",
        "statistics"
      ]
    }
  ],
  "totalRuntimeMs": 1562155.476,
  "normalMatchOverhead": "Zero: benchmark modules are developer-only and never imported by production simulation."
}
```

## Match distributions

| Metric | N matches | Mean | SD | p05 | Median | p95 | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| outfieldShots | 20 | 93.750 | 8.920 | 85.000 | 93.500 | 105.150 | 66.000 | 108.000 |
| outfieldConversion | 20 | 0.641 | 0.057 | 0.570 | 0.641 | 0.725 | 0.495 | 0.765 |
| goals | 20 | 60.100 | 8.019 | 45.950 | 60.000 | 71.350 | 45.000 | 78.000 |
| possessions | 20 | 122.800 | 11.340 | 110.450 | 125.500 | 133.050 | 81.000 | 134.000 |
| shots | 20 | 93.750 | 8.920 | 85.000 | 93.500 | 105.150 | 66.000 | 108.000 |
| saves | 20 | 18.250 | 4.898 | 9.000 | 18.000 | 26.050 | 9.000 | 27.000 |
| shotsFaced | 20 | 78.350 | 8.381 | 67.300 | 79.000 | 89.250 | 54.000 | 94.000 |
| conversion | 20 | 0.641 | 0.057 | 0.570 | 0.641 | 0.725 | 0.495 | 0.765 |
| savePct | 20 | 0.233 | 0.060 | 0.149 | 0.237 | 0.343 | 0.132 | 0.370 |
| goalsPerPossession | 20 | 0.491 | 0.062 | 0.407 | 0.482 | 0.584 | 0.362 | 0.619 |
| turnovers | 20 | 33.750 | 6.373 | 24.700 | 35.000 | 41.050 | 19.000 | 42.000 |
| technicalErrors | 20 | 1.150 | 1.137 | 0.000 | 1.000 | 3.000 | 0.000 | 3.000 |
| offensiveFouls | 20 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sevenMetres | 20 | 4.050 | 1.276 | 2.900 | 4.000 | 6.000 | 1.000 | 6.000 |
| sevenMetreConversion | 20 | 0.891 | 0.191 | 0.587 | 1.000 | 1.000 | 0.333 | 1.000 |
| suspensions | 20 | 3.950 | 2.114 | 1.000 | 3.500 | 7.050 | 1.000 | 8.000 |
| contacts | 20 | 730.850 | 59.646 | 641.500 | 751.500 | 794.200 | 537.000 | 798.000 |
| assessedFouls | 20 | 27.450 | 5.042 | 17.800 | 28.000 | 34.100 | 14.000 | 36.000 |
| advantages | 20 | 16.600 | 4.198 | 10.950 | 16.500 | 22.100 | 10.000 | 24.000 |
| whistles | 20 | 10.850 | 2.720 | 7.750 | 11.000 | 14.050 | 3.000 | 15.000 |
| freeThrows | 20 | 9.350 | 2.681 | 5.900 | 9.000 | 13.050 | 4.000 | 14.000 |
| possessionSeconds | 20 | 29.639 | 3.730 | 27.058 | 28.686 | 32.758 | 26.866 | 44.444 |
| transitionPossessions | 20 | 118.250 | 11.630 | 106.350 | 121.500 | 127.100 | 75.000 | 129.000 |
| transitionAttempts | 20 | 118.600 | 11.731 | 106.350 | 122.000 | 127.100 | 75.000 | 129.000 |
| transitionShots | 20 | 3.100 | 1.889 | 0.950 | 3.000 | 5.150 | 0.000 | 8.000 |
| transitionGoals | 20 | 1.800 | 1.361 | 0.000 | 2.000 | 4.000 | 0.000 | 4.000 |
| transitionConversion | 19 | 0.562 | 0.372 | 0.000 | 0.667 | 1.000 | 0.000 | 1.000 |
| transitionRate | 20 | 0.962 | 0.020 | 0.926 | 0.967 | 0.992 | 0.926 | 0.992 |

## Shot context

Context rows overlap; CATEGORY rows partition shots. Save rate = saves / (saves + goals). Conversion = goals / attempts.

| Context | N matches | Attempts | On target | Saves | Save rate | Conversion |
|---|---:|---:|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 20 | 576 | 471 | 60 | 0.127 | 0.714 |
| POSITION:V9 | 20 | 310 | 248 | 71 | 0.286 | 0.571 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 20 | 1413 | 1135 | 242 | 0.213 | 0.632 |
| QUALITY:LOWER_UNDER_0.65 | 20 | 1531 | 1243 | 322 | 0.259 | 0.602 |
| PHASE:ESTABLISHED | 20 | 1732 | 1436 | 342 | 0.238 | 0.632 |
| DISTANCE:8_TO_10.5M | 20 | 977 | 829 | 206 | 0.248 | 0.638 |
| POSITION:H9 | 20 | 425 | 369 | 63 | 0.171 | 0.720 |
| CATEGORY:BREAKTHROUGH | 20 | 515 | 419 | 128 | 0.305 | 0.565 |
| POSITION:M9 | 20 | 282 | 241 | 31 | 0.129 | 0.745 |
| QUALITY:HIGH_AT_LEAST_0.65 | 20 | 344 | 324 | 43 | 0.133 | 0.817 |
| DISTANCE:UP_TO_8M | 20 | 764 | 652 | 144 | 0.221 | 0.665 |
| POSITION:H6 | 20 | 265 | 216 | 64 | 0.296 | 0.574 |
| CONTEXT:NEAR_SIX_METRE_AREA | 20 | 796 | 669 | 177 | 0.265 | 0.618 |
| PRESSURE:LOW_UNDER_0.2 | 20 | 462 | 432 | 123 | 0.285 | 0.669 |
| CATEGORY:PIVOT | 20 | 337 | 288 | 68 | 0.236 | 0.653 |
| POSITION:M6 | 20 | 337 | 288 | 68 | 0.236 | 0.653 |
| CATEGORY:WING | 20 | 253 | 209 | 57 | 0.273 | 0.601 |
| POSITION:V6 | 20 | 256 | 205 | 68 | 0.332 | 0.535 |
| PHASE:TRANSITION | 19 | 62 | 50 | 14 | 0.280 | 0.581 |
| DISTANCE:BEYOND_10.5M | 20 | 134 | 86 | 15 | 0.174 | 0.530 |
| CATEGORY:STANDING | 20 | 113 | 99 | 43 | 0.434 | 0.496 |
| CATEGORY:SEVEN_METRE | 20 | 81 | 81 | 9 | 0.111 | 0.889 |
| PHASE:RESTART | 20 | 81 | 81 | 9 | 0.111 | 0.889 |

## Goalkeeper investigation

Rankings below describe this engine sample. They are not empirical outlier verdicts. Conditional expectations require category references and complete coverage.

### Match 10: se_player_alfred_asvard_d2addedf
Saves 15; shots faced 47; save rate 0.319; attempts 57. Wilson interval 0.204–0.462.
Mean pressure 0.673; decision quality 0.543; distance 8.491m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.043.
Capabilities: {"keeper.positioning":0.5526315789473689,"keeper.setPosition":0.5789473684210532,"keeper.reaction":0.7894736842105257,"keeper.explosiveness":0.6315789473684212,"keeper.low":0.5789473684210532,"keeper.high":0.5789473684210532,"keeper.close":0.7368421052631573,"keeper.long":0.6315789473684212,"keeper.wing":0.5789473684210532,"keeper.sevenMetre":0.5263157894736847,"keeper.reading":0.5263157894736847,"keeper.outlet":0.6315789473684212,"shooter.placement":0.7488457987072943,"shooter.power":0.7783933518005539,"shooter.finishing":0.7082179132040625,"shooter.wing":0.7654662973222526,"shooter.pivot":0.7571560480147734,"shooter.decision":0.6800554016620499,"shooter.composure":0.6888273314866112,"shot.pressure":0.6731261674426751,"shot.quality":0.5434350312477516,"shot.distance":8.491494650878115}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 17 | 16 | 2 | 0.125 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 40 | 30 | 9 | 0.300 |
| QUALITY:LOWER_UNDER_0.65 | 47 | 40 | 14 | 0.350 |
| PHASE:ESTABLISHED | 52 | 43 | 13 | 0.302 |
| DISTANCE:8_TO_10.5M | 34 | 32 | 9 | 0.281 |
| CATEGORY:BREAKTHROUGH | 15 | 10 | 4 | 0.400 |
| DISTANCE:UP_TO_8M | 22 | 15 | 6 | 0.400 |
| CONTEXT:NEAR_SIX_METRE_AREA | 23 | 17 | 8 | 0.471 |
| QUALITY:HIGH_AT_LEAST_0.65 | 10 | 7 | 1 | 0.143 |
| CATEGORY:PIVOT | 12 | 8 | 5 | 0.625 |
| PRESSURE:LOW_UNDER_0.2 | 17 | 17 | 6 | 0.353 |
| CATEGORY:STANDING | 7 | 7 | 3 | 0.429 |
| CATEGORY:WING | 4 | 4 | 1 | 0.250 |
| PHASE:TRANSITION | 3 | 2 | 2 | 1.000 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 0 | 0.000 |
| PHASE:RESTART | 2 | 2 | 0 | 0.000 |
| DISTANCE:BEYOND_10.5M | 1 | 0 | 0 | unknown |

### Match 5: se_player_jonas_aberg_87cd5977
Saves 14; shots faced 36; save rate 0.389; attempts 42. Wilson interval 0.248–0.551.
Mean pressure 0.574; decision quality 0.535; distance 8.435m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.111.
Capabilities: {"keeper.positioning":0.6052631578947373,"keeper.setPosition":0.631578947368421,"keeper.reaction":0.789473684210527,"keeper.explosiveness":0.789473684210527,"keeper.low":0.6842105263157887,"keeper.high":0.631578947368421,"keeper.close":0.789473684210527,"keeper.long":0.6842105263157887,"keeper.wing":0.6842105263157887,"keeper.sevenMetre":0.6842105263157887,"keeper.reading":0.6052631578947373,"keeper.outlet":0.5789473684210532,"shooter.placement":0.637218045112782,"shooter.power":0.650375939849624,"shooter.finishing":0.6403508771929822,"shooter.wing":0.6854636591478701,"shooter.pivot":0.6340852130325814,"shooter.decision":0.5864661654135336,"shooter.composure":0.5889724310776941,"shot.pressure":0.5737792196181267,"shot.quality":0.5345341712704464,"shot.distance":8.434559436054426}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 10 | 7 | 1 | 0.143 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 30 | 25 | 10 | 0.400 |
| QUALITY:LOWER_UNDER_0.65 | 32 | 26 | 12 | 0.462 |
| PHASE:ESTABLISHED | 38 | 32 | 12 | 0.375 |
| DISTANCE:8_TO_10.5M | 20 | 18 | 6 | 0.333 |
| DISTANCE:BEYOND_10.5M | 4 | 1 | 0 | 0.000 |
| CATEGORY:BREAKTHROUGH | 16 | 14 | 8 | 0.571 |
| DISTANCE:UP_TO_8M | 18 | 17 | 8 | 0.471 |
| CONTEXT:NEAR_SIX_METRE_AREA | 17 | 16 | 7 | 0.438 |
| CATEGORY:STANDING | 2 | 2 | 2 | 1.000 |
| CATEGORY:WING | 6 | 6 | 1 | 0.167 |
| CATEGORY:PIVOT | 4 | 3 | 0 | 0.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 10 | 10 | 2 | 0.200 |
| PRESSURE:LOW_UNDER_0.2 | 12 | 11 | 4 | 0.364 |
| CATEGORY:SEVEN_METRE | 4 | 4 | 2 | 0.500 |
| PHASE:RESTART | 4 | 4 | 2 | 0.500 |

### Match 9: se_player_alexander_holmberg_3b1f68d9
Saves 14; shots faced 46; save rate 0.304; attempts 50. Wilson interval 0.191–0.448.
Mean pressure 0.704; decision quality 0.577; distance 8.424m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.087.
Capabilities: {"keeper.positioning":0.578947368421053,"keeper.setPosition":0.578947368421053,"keeper.reaction":0.7894736842105271,"keeper.explosiveness":0.684210526315789,"keeper.low":0.6315789473684215,"keeper.high":0.578947368421053,"keeper.close":0.7894736842105271,"keeper.long":0.578947368421053,"keeper.wing":0.578947368421053,"keeper.sevenMetre":0.684210526315789,"keeper.reading":0.6578947368421055,"keeper.outlet":0.684210526315789,"shooter.placement":0.7368421052631574,"shooter.power":0.7884210526315788,"shooter.finishing":0.7063157894736845,"shooter.wing":0.7010526315789475,"shooter.pivot":0.7178947368421051,"shooter.decision":0.6431578947368419,"shooter.composure":0.6578947368421052,"shot.pressure":0.7035415872144217,"shot.quality":0.5765239152973526,"shot.distance":8.423514439949866}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:STANDING | 6 | 5 | 3 | 0.600 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 37 | 33 | 10 | 0.303 |
| QUALITY:LOWER_UNDER_0.65 | 38 | 34 | 12 | 0.353 |
| PHASE:ESTABLISHED | 43 | 39 | 13 | 0.333 |
| DISTANCE:8_TO_10.5M | 19 | 17 | 5 | 0.294 |
| CATEGORY:PIVOT | 13 | 12 | 5 | 0.417 |
| DISTANCE:UP_TO_8M | 27 | 26 | 9 | 0.346 |
| CONTEXT:NEAR_SIX_METRE_AREA | 22 | 20 | 9 | 0.450 |
| CATEGORY:BACKCOURT_JUMP | 12 | 11 | 1 | 0.091 |
| PRESSURE:LOW_UNDER_0.2 | 13 | 13 | 4 | 0.308 |
| DISTANCE:BEYOND_10.5M | 4 | 3 | 0 | 0.000 |
| CATEGORY:BREAKTHROUGH | 13 | 12 | 4 | 0.333 |
| QUALITY:HIGH_AT_LEAST_0.65 | 12 | 12 | 2 | 0.167 |
| CATEGORY:SEVEN_METRE | 4 | 4 | 0 | 0.000 |
| PHASE:RESTART | 4 | 4 | 0 | 0.000 |
| CATEGORY:WING | 2 | 2 | 1 | 0.500 |
| PHASE:TRANSITION | 3 | 3 | 1 | 0.333 |

### Match 18: se_player_olle_soderqvist_467b211d
Saves 14; shots faced 32; save rate 0.438; attempts 46. Wilson interval 0.282–0.607.
Mean pressure 0.697; decision quality 0.507; distance 8.692m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.031.
Capabilities: {"keeper.positioning":0.6315789473684209,"keeper.setPosition":0.5789473684210531,"keeper.reaction":0.8421052631578957,"keeper.explosiveness":0.7894736842105263,"keeper.low":0.7368421052631572,"keeper.high":0.5789473684210531,"keeper.close":0.7894736842105263,"keeper.long":0.6842105263157897,"keeper.wing":0.5789473684210531,"keeper.sevenMetre":0.6842105263157897,"keeper.reading":0.6578947368421049,"keeper.outlet":0.6842105263157897,"shooter.placement":0.6458810068649885,"shooter.power":0.6716247139588101,"shooter.finishing":0.6418764302059498,"shooter.wing":0.6670480549199085,"shooter.pivot":0.6487414187643021,"shooter.decision":0.5783752860411898,"shooter.composure":0.5800915331807781,"shot.pressure":0.6973441833198792,"shot.quality":0.5070184138595163,"shot.distance":8.69201025799224}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:PIVOT | 5 | 3 | 0 | 0.000 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 37 | 25 | 11 | 0.440 |
| QUALITY:HIGH_AT_LEAST_0.65 | 6 | 5 | 0 | 0.000 |
| PHASE:ESTABLISHED | 45 | 31 | 14 | 0.452 |
| DISTANCE:UP_TO_8M | 16 | 12 | 5 | 0.417 |
| CONTEXT:NEAR_SIX_METRE_AREA | 20 | 15 | 9 | 0.600 |
| CATEGORY:BACKCOURT_JUMP | 14 | 9 | 2 | 0.222 |
| QUALITY:LOWER_UNDER_0.65 | 40 | 27 | 14 | 0.519 |
| DISTANCE:8_TO_10.5M | 25 | 19 | 8 | 0.421 |
| DISTANCE:BEYOND_10.5M | 5 | 1 | 1 | 1.000 |
| CATEGORY:WING | 4 | 4 | 3 | 0.750 |
| CATEGORY:SEVEN_METRE | 1 | 1 | 0 | 0.000 |
| PRESSURE:LOW_UNDER_0.2 | 9 | 7 | 3 | 0.429 |
| PHASE:RESTART | 1 | 1 | 0 | 0.000 |
| CATEGORY:BREAKTHROUGH | 19 | 13 | 8 | 0.615 |
| CATEGORY:STANDING | 3 | 2 | 1 | 0.500 |

### Match 0: se_player_mans_landgren_0afb78ec
Saves 13; shots faced 30; save rate 0.433; attempts 41. Wilson interval 0.274–0.608.
Mean pressure 0.657; decision quality 0.550; distance 8.321m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.100.
Capabilities: {"keeper.positioning":0.6842105263157895,"keeper.setPosition":0.6315789473684211,"keeper.reaction":0.6315789473684211,"keeper.explosiveness":0.6315789473684211,"keeper.low":0.7368421052631579,"keeper.high":0.6842105263157895,"keeper.close":0.6842105263157895,"keeper.long":0.6842105263157895,"keeper.wing":0.7368421052631579,"keeper.sevenMetre":0.6315789473684211,"keeper.reading":0.7105263157894732,"keeper.outlet":0.7894736842105269,"shooter.placement":0.645699614890886,"shooter.power":0.6559691912708603,"shooter.finishing":0.6431322207958923,"shooter.wing":0.698331193838254,"shooter.pivot":0.6508344030808731,"shooter.decision":0.5744544287548137,"shooter.composure":0.5917843388960203,"shot.pressure":0.6569551658946783,"shot.quality":0.5504494814643868,"shot.distance":8.320511528443966}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 10 | 6 | 3 | 0.500 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 32 | 22 | 10 | 0.455 |
| QUALITY:LOWER_UNDER_0.65 | 31 | 21 | 8 | 0.381 |
| PHASE:ESTABLISHED | 36 | 26 | 12 | 0.462 |
| DISTANCE:8_TO_10.5M | 21 | 14 | 8 | 0.571 |
| CATEGORY:BREAKTHROUGH | 8 | 5 | 3 | 0.600 |
| QUALITY:HIGH_AT_LEAST_0.65 | 10 | 9 | 5 | 0.556 |
| DISTANCE:UP_TO_8M | 18 | 16 | 5 | 0.313 |
| CONTEXT:NEAR_SIX_METRE_AREA | 17 | 14 | 5 | 0.357 |
| PRESSURE:LOW_UNDER_0.2 | 9 | 8 | 3 | 0.375 |
| CATEGORY:PIVOT | 12 | 11 | 5 | 0.455 |
| CATEGORY:WING | 7 | 5 | 2 | 0.400 |
| PHASE:TRANSITION | 2 | 1 | 1 | 1.000 |
| DISTANCE:BEYOND_10.5M | 2 | 0 | 0 | unknown |
| CATEGORY:STANDING | 1 | 0 | 0 | unknown |
| CATEGORY:SEVEN_METRE | 3 | 3 | 0 | 0.000 |
| PHASE:RESTART | 3 | 3 | 0 | 0.000 |

## Outliers and coverage

23 evidence-backed flags. 5661/6313 comparisons have NO_REFERENCE. Missing reference is not NORMAL.

| Match | Scope | Metric | Actual | Expected | Deviation | N | Status |
|---|---|---|---:|---:|---:|---:|---|
| 0 | TEAM | goalsPerTeam | 17 | 30.807692307692307 | -13.807692307692307 | 1 | WATCH |
| 0 | TEAM | scorerHHI | 0.2733564013840831 | 0.1565768703084911 | 0.11677953107559202 | 17 | OUTLIER |
| 0 | TEAM | scorerHHI | 0.22863403944485028 | 0.1565768703084911 | 0.07205716913635918 | 37 | WATCH |
| 2 | MATCH | goals | 78 | 61.61538461538461 | 16.384615384615387 | 1 | WATCH |
| 2 | KEEPER | savePct | 0.07407407407407407 | 0.28565487560078895 | -0.21158080152671488 | 54 | WATCH |
| 2 | KEEPER | shotsFaced | 54 | 29.814583333333335 | 24.185416666666665 | 1 | WATCH |
| 2 | TEAM | goalsPerTeam | 50 | 30.807692307692307 | 19.192307692307693 | 1 | OUTLIER |
| 9 | TEAM | goalsPerTeam | 18 | 30.807692307692307 | -12.807692307692307 | 1 | WATCH |
| 10 | TEAM | scorerConcentration | 0.5 | 0.24518429721506182 | 0.25481570278493815 | 32 | EXTREME |
| 10 | TEAM | scorerHHI | 0.306640625 | 0.1565768703084911 | 0.1500637546915089 | 32 | EXTREME |
| 13 | TEAM | scorerHHI | 0.224609375 | 0.1565768703084911 | 0.0680325046915089 | 32 | WATCH |
| 14 | KEEPER | savePct | 0.08571428571428572 | 0.28565487560078895 | -0.19994058988650323 | 35 | WATCH |
| 14 | TEAM | scorerHHI | 0.23731138545953362 | 0.1565768703084911 | 0.08073451515104252 | 27 | WATCH |
| 15 | MATCH | goals | 45 | 61.61538461538461 | -16.615384615384613 | 1 | WATCH |
| 15 | MATCH | sevenMetres | 1 | 7.115384615384615 | -6.115384615384615 | 1 | WATCH |
| 15 | TEAM | goalsPerTeam | 21 | 30.807692307692307 | -9.807692307692307 | 1 | WATCH |
| 15 | TEAM | scorerConcentration | 0.5238095238095238 | 0.24518429721506182 | 0.278625226594462 | 21 | EXTREME |
| 15 | TEAM | scorerHHI | 0.3424036281179138 | 0.1565768703084911 | 0.1858267578094227 | 21 | EXTREME |
| 16 | TEAM | scorerConcentration | 0.3783783783783784 | 0.24518429721506182 | 0.13319408116331657 | 37 | WATCH |
| 16 | TEAM | scorerHHI | 0.2330168005843682 | 0.1565768703084911 | 0.07643993027587709 | 37 | WATCH |
| 18 | MATCH | goals | 46 | 61.61538461538461 | -15.615384615384613 | 1 | WATCH |
| 18 | TEAM | goalsPerTeam | 18 | 30.807692307692307 | -12.807692307692307 | 1 | WATCH |
| 19 | KEEPER | savePct | 0.06976744186046512 | 0.28565487560078895 | -0.21588743374032382 | 43 | WATCH |

## How to read this report

Use N and denominators before comparing rates. Means and percentiles describe this batch. Consult per-match JSON for observed reference, contextual components, uncertainty, provenance and fallback. A keeper with 30 saves requires both on-target volume and category/pressure/quality review. NO_REFERENCE means no justified real-world verdict is possible. Engineering sanity checks are separate in summary.json.
