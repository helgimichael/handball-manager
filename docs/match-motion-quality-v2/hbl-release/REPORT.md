# Current engine benchmark

N = 20 completed matches. Engine outputs are measured samples, not real-world references.

```json
{
  "head": "d36be32d342c502fabc69898442901e2ebd67667",
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
      "simulationMs": 29584.2057,
      "analysisMs": 4392.638699999996,
      "observerMs": 5430.926799999841
    },
    {
      "simulationMs": 41495.474700000006,
      "analysisMs": 4326.637299999988,
      "observerMs": 8276.452400000679
    },
    {
      "simulationMs": 30014.1434,
      "analysisMs": 4166.097600000008,
      "observerMs": 1444.7801000032196
    },
    {
      "simulationMs": 36983.5515,
      "analysisMs": 6401.309399999998,
      "observerMs": 2119.166100002738
    },
    {
      "simulationMs": 30251.212,
      "analysisMs": 12052.381600000022,
      "observerMs": 1350.2698999990243
    },
    {
      "simulationMs": 71045.60419999997,
      "analysisMs": 12169.432700000005,
      "observerMs": 3733.837799996225
    },
    {
      "simulationMs": 74970.8702,
      "analysisMs": 4991.180699999968,
      "observerMs": 4023.021899996267
    },
    {
      "simulationMs": 32337.2978,
      "analysisMs": 16273.52469999995,
      "observerMs": 1573.2690999942133
    },
    {
      "simulationMs": 72493.27010000002,
      "analysisMs": 30107.91200000001,
      "observerMs": 4259.692599982431
    },
    {
      "simulationMs": 49048.68129999994,
      "analysisMs": 7670.117899999954,
      "observerMs": 2559.7136000045575
    },
    {
      "simulationMs": 79384.09479999996,
      "analysisMs": 19743.659300000058,
      "observerMs": 4839.687700009439
    },
    {
      "simulationMs": 82395.05350000004,
      "analysisMs": 6643.181099999929,
      "observerMs": 4586.582699990366
    },
    {
      "simulationMs": 51089.558100000024,
      "analysisMs": 26475.987900000066,
      "observerMs": 3052.4537999910535
    },
    {
      "simulationMs": 99968.85820000002,
      "analysisMs": 8245.753700000001,
      "observerMs": 5912.650199997239
    },
    {
      "simulationMs": 70716.05170000007,
      "analysisMs": 26477.222999999998,
      "observerMs": 4550.01609994797
    },
    {
      "simulationMs": 80065.07799999998,
      "analysisMs": 5799.836899999995,
      "observerMs": 4621.7103999769315
    },
    {
      "simulationMs": 31726.539399999892,
      "analysisMs": 21461.579100000206,
      "observerMs": 1741.094000007026
    },
    {
      "simulationMs": 84904.85970000015,
      "analysisMs": 16235.200199999847,
      "observerMs": 5230.427000001771
    },
    {
      "simulationMs": 48180.22549999994,
      "analysisMs": 8255.67610000004,
      "observerMs": 3235.2712000114843
    },
    {
      "simulationMs": 83302.88399999985,
      "analysisMs": 8164.724299999885,
      "observerMs": 5474.630500047235
    }
  ],
  "proofs": [
    {
      "index": 0,
      "fullMatch": true,
      "exactSessionEqual": true,
      "sessionHash": "e44964397eaf0c762927ce376fc2b579b0154b13678b115315b0e3b8dacffa51",
      "resultHash": "0391b686a0a223db8061ed91a2852746e9b09ea5cc5aedbc0a11ced2e3c7f4fd",
      "observedMs": 29584.2057,
      "unobservedMs": 15259.681500000006,
      "observerMs": 5430.926799999841,
      "analysisMs": 4392.638699999996,
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
  "totalRuntimeMs": 1561330.0176000001,
  "normalMatchOverhead": "Zero: benchmark modules are developer-only and never imported by production simulation."
}
```

## Match distributions

| Metric | N matches | Mean | SD | p05 | Median | p95 | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| outfieldShots | 20 | 100.450 | 5.424 | 93.750 | 101.000 | 108.350 | 89.000 | 115.000 |
| outfieldConversion | 20 | 0.654 | 0.057 | 0.582 | 0.657 | 0.719 | 0.494 | 0.724 |
| goals | 20 | 65.750 | 7.312 | 59.200 | 66.000 | 73.450 | 44.000 | 82.000 |
| possessions | 20 | 128.300 | 6.634 | 115.900 | 129.500 | 134.350 | 114.000 | 141.000 |
| shots | 20 | 100.450 | 5.424 | 93.750 | 101.000 | 108.350 | 89.000 | 115.000 |
| saves | 20 | 20.600 | 4.223 | 14.900 | 20.500 | 25.300 | 13.000 | 31.000 |
| shotsFaced | 20 | 86.350 | 6.635 | 77.550 | 87.000 | 92.500 | 69.000 | 102.000 |
| conversion | 20 | 0.654 | 0.057 | 0.582 | 0.657 | 0.719 | 0.494 | 0.724 |
| savePct | 20 | 0.240 | 0.052 | 0.176 | 0.235 | 0.338 | 0.167 | 0.362 |
| goalsPerPossession | 20 | 0.512 | 0.045 | 0.444 | 0.519 | 0.563 | 0.379 | 0.582 |
| turnovers | 20 | 33.800 | 3.651 | 29.900 | 34.000 | 41.050 | 28.000 | 42.000 |
| technicalErrors | 20 | 1.500 | 1.318 | 0.000 | 1.000 | 3.150 | 0.000 | 6.000 |
| offensiveFouls | 20 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| sevenMetres | 20 | 3.550 | 1.791 | 0.000 | 3.500 | 6.050 | 0.000 | 7.000 |
| sevenMetreConversion | 18 | 0.870 | 0.175 | 0.500 | 1.000 | 1.000 | 0.500 | 1.000 |
| suspensions | 20 | 3.500 | 2.188 | 0.950 | 3.000 | 6.150 | 0.000 | 9.000 |
| contacts | 20 | 726.950 | 38.099 | 662.350 | 729.500 | 776.350 | 650.000 | 783.000 |
| assessedFouls | 20 | 30.850 | 4.902 | 23.900 | 32.000 | 39.000 | 22.000 | 39.000 |
| advantages | 20 | 20.000 | 3.642 | 14.950 | 20.000 | 25.050 | 14.000 | 26.000 |
| whistles | 20 | 10.850 | 2.889 | 6.950 | 11.000 | 15.050 | 6.000 | 16.000 |
| freeThrows | 20 | 9.950 | 3.471 | 6.000 | 10.000 | 17.100 | 6.000 | 19.000 |
| possessionSeconds | 20 | 28.133 | 1.512 | 26.799 | 27.799 | 31.062 | 25.532 | 31.579 |
| transitionPossessions | 20 | 123.900 | 6.703 | 112.750 | 124.000 | 130.500 | 108.000 | 140.000 |
| transitionAttempts | 20 | 124.350 | 6.612 | 113.700 | 124.500 | 130.500 | 108.000 | 140.000 |
| transitionShots | 20 | 4.150 | 2.254 | 1.950 | 3.500 | 8.050 | 1.000 | 9.000 |
| transitionGoals | 20 | 1.950 | 1.276 | 0.000 | 2.000 | 4.050 | 0.000 | 5.000 |
| transitionConversion | 20 | 0.516 | 0.319 | 0.000 | 0.500 | 1.000 | 0.000 | 1.000 |
| transitionRate | 20 | 0.966 | 0.014 | 0.947 | 0.961 | 0.992 | 0.947 | 0.993 |

## Shot context

Context rows overlap; CATEGORY rows partition shots. Save rate = saves / (saves + goals). Conversion = goals / attempts.

| Context | N matches | Attempts | On target | Saves | Save rate | Conversion |
|---|---:|---:|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 20 | 691 | 595 | 94 | 0.158 | 0.725 |
| POSITION:M9 | 20 | 256 | 228 | 39 | 0.171 | 0.738 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 20 | 1595 | 1328 | 308 | 0.232 | 0.639 |
| QUALITY:LOWER_UNDER_0.65 | 20 | 1629 | 1368 | 341 | 0.249 | 0.630 |
| PHASE:ESTABLISHED | 20 | 1855 | 1585 | 371 | 0.234 | 0.654 |
| DISTANCE:8_TO_10.5M | 20 | 1090 | 944 | 234 | 0.248 | 0.651 |
| CATEGORY:PIVOT | 20 | 380 | 330 | 90 | 0.273 | 0.632 |
| POSITION:M6 | 20 | 380 | 330 | 90 | 0.273 | 0.632 |
| DISTANCE:UP_TO_8M | 20 | 754 | 653 | 152 | 0.233 | 0.664 |
| CONTEXT:NEAR_SIX_METRE_AREA | 20 | 819 | 696 | 190 | 0.273 | 0.618 |
| CATEGORY:WING | 20 | 257 | 213 | 62 | 0.291 | 0.588 |
| DISTANCE:BEYOND_10.5M | 20 | 165 | 130 | 26 | 0.200 | 0.630 |
| POSITION:H9 | 20 | 418 | 358 | 79 | 0.221 | 0.667 |
| CATEGORY:BREAKTHROUGH | 20 | 454 | 373 | 93 | 0.249 | 0.617 |
| POSITION:H6 | 20 | 223 | 182 | 47 | 0.258 | 0.605 |
| POSITION:V6 | 20 | 286 | 239 | 79 | 0.331 | 0.559 |
| PHASE:TRANSITION | 20 | 83 | 71 | 32 | 0.451 | 0.470 |
| POSITION:V9 | 20 | 446 | 390 | 78 | 0.200 | 0.700 |
| PRESSURE:LOW_UNDER_0.2 | 20 | 414 | 399 | 104 | 0.261 | 0.713 |
| QUALITY:HIGH_AT_LEAST_0.65 | 20 | 380 | 359 | 71 | 0.198 | 0.758 |
| CATEGORY:STANDING | 20 | 156 | 145 | 64 | 0.441 | 0.519 |
| CATEGORY:SEVEN_METRE | 18 | 71 | 71 | 9 | 0.127 | 0.873 |
| PHASE:RESTART | 18 | 71 | 71 | 9 | 0.127 | 0.873 |

## Goalkeeper investigation

Rankings below describe this engine sample. They are not empirical outlier verdicts. Conditional expectations require category references and complete coverage.

### Match 19: se_player_marcus_holmen_87d487c8
Saves 20; shots faced 48; save rate 0.417; attempts 55. Wilson interval 0.288–0.557.
Mean pressure 0.742; decision quality 0.541; distance 8.612m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.042.
Capabilities: {"keeper.positioning":0.9473684210526324,"keeper.setPosition":0.8947368421052638,"keeper.reaction":0.7894736842105259,"keeper.explosiveness":0.8421052631578936,"keeper.low":0.7894736842105259,"keeper.high":0.8421052631578936,"keeper.close":0.8421052631578936,"keeper.long":0.7368421052631573,"keeper.wing":0.8421052631578936,"keeper.sevenMetre":0.7368421052631573,"keeper.reading":0.86842105263158,"keeper.outlet":0.7368421052631573,"shooter.placement":0.8071770334928228,"shooter.power":0.8153110047846884,"shooter.finishing":0.7980861244019136,"shooter.wing":0.8105263157894728,"shooter.pivot":0.779904306220095,"shooter.decision":0.7205741626794256,"shooter.composure":0.7033492822966505,"shot.pressure":0.7424945040807516,"shot.quality":0.5408017871284125,"shot.distance":8.61176986950417}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 15 | 13 | 1 | 0.077 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 46 | 39 | 17 | 0.436 |
| QUALITY:LOWER_UNDER_0.65 | 44 | 37 | 13 | 0.351 |
| PHASE:ESTABLISHED | 52 | 45 | 19 | 0.422 |
| DISTANCE:8_TO_10.5M | 27 | 24 | 10 | 0.417 |
| CATEGORY:BREAKTHROUGH | 11 | 7 | 2 | 0.286 |
| DISTANCE:UP_TO_8M | 23 | 20 | 10 | 0.500 |
| CONTEXT:NEAR_SIX_METRE_AREA | 25 | 21 | 12 | 0.571 |
| CATEGORY:STANDING | 8 | 8 | 6 | 0.750 |
| CATEGORY:WING | 6 | 5 | 3 | 0.600 |
| PRESSURE:LOW_UNDER_0.2 | 9 | 9 | 3 | 0.333 |
| QUALITY:HIGH_AT_LEAST_0.65 | 11 | 11 | 7 | 0.636 |
| DISTANCE:BEYOND_10.5M | 5 | 4 | 0 | 0.000 |
| CATEGORY:PIVOT | 13 | 13 | 7 | 0.538 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 1 | 0.500 |
| PHASE:RESTART | 2 | 2 | 1 | 0.500 |
| PHASE:TRANSITION | 1 | 1 | 0 | 0.000 |

### Match 0: se_player_anton_hagvall_34e5df98
Saves 16; shots faced 48; save rate 0.333; attempts 54. Wilson interval 0.217–0.475.
Mean pressure 0.822; decision quality 0.537; distance 8.437m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.042.
Capabilities: {"keeper.positioning":0.631578947368421,"keeper.setPosition":0.631578947368421,"keeper.reaction":0.7368421052631569,"keeper.explosiveness":0.7368421052631569,"keeper.low":0.6842105263157904,"keeper.high":0.631578947368421,"keeper.close":0.7368421052631569,"keeper.long":0.7368421052631569,"keeper.wing":0.7368421052631569,"keeper.sevenMetre":0.631578947368421,"keeper.reading":0.631578947368421,"keeper.outlet":0.7368421052631569,"shooter.placement":0.7334307992202728,"shooter.power":0.7319688109161799,"shooter.finishing":0.7339181286549709,"shooter.wing":0.7465886939571148,"shooter.pivot":0.772904483430799,"shooter.decision":0.6359649122807016,"shooter.composure":0.6510721247563356,"shot.pressure":0.8221679477082872,"shot.quality":0.5366964063552256,"shot.distance":8.437233876910446}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 14 | 13 | 4 | 0.308 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 50 | 44 | 16 | 0.364 |
| QUALITY:LOWER_UNDER_0.65 | 42 | 36 | 14 | 0.389 |
| PHASE:ESTABLISHED | 46 | 40 | 11 | 0.275 |
| DISTANCE:8_TO_10.5M | 23 | 21 | 6 | 0.286 |
| CATEGORY:PIVOT | 12 | 12 | 4 | 0.333 |
| DISTANCE:UP_TO_8M | 26 | 22 | 8 | 0.364 |
| CONTEXT:NEAR_SIX_METRE_AREA | 27 | 23 | 8 | 0.348 |
| CATEGORY:WING | 9 | 9 | 3 | 0.333 |
| DISTANCE:BEYOND_10.5M | 5 | 5 | 2 | 0.400 |
| CATEGORY:BREAKTHROUGH | 15 | 10 | 5 | 0.500 |
| PHASE:TRANSITION | 6 | 6 | 5 | 0.833 |
| PRESSURE:LOW_UNDER_0.2 | 4 | 4 | 0 | 0.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 12 | 12 | 2 | 0.167 |
| CATEGORY:STANDING | 2 | 2 | 0 | 0.000 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 0 | 0.000 |
| PHASE:RESTART | 2 | 2 | 0 | 0.000 |

### Match 18: player_ebbe_hakansson_132f4301
Saves 16; shots faced 44; save rate 0.364; attempts 48. Wilson interval 0.238–0.511.
Mean pressure 0.703; decision quality 0.539; distance 8.410m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.045.
Capabilities: {"keeper.positioning":0.7368421052631576,"keeper.setPosition":0.789473684210527,"keeper.reaction":0.6842105263157892,"keeper.explosiveness":0.789473684210527,"keeper.low":0.6842105263157892,"keeper.high":0.6842105263157892,"keeper.close":0.6842105263157892,"keeper.long":0.6842105263157892,"keeper.wing":0.6842105263157892,"keeper.sevenMetre":0.7368421052631576,"keeper.reading":0.789473684210527,"keeper.outlet":0.6842105263157892,"shooter.placement":0.7500000000000002,"shooter.power":0.754385964912281,"shooter.finishing":0.7609649122807017,"shooter.wing":0.7149122807017544,"shooter.pivot":0.6951754385964912,"shooter.decision":0.6726973684210529,"shooter.composure":0.6436403508771927,"shot.pressure":0.7033014783080489,"shot.quality":0.5391803686881592,"shot.distance":8.40989553742355}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:PIVOT | 12 | 12 | 2 | 0.167 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 37 | 33 | 10 | 0.303 |
| QUALITY:HIGH_AT_LEAST_0.65 | 9 | 9 | 2 | 0.222 |
| PHASE:ESTABLISHED | 40 | 36 | 12 | 0.333 |
| DISTANCE:UP_TO_8M | 20 | 20 | 5 | 0.250 |
| CONTEXT:NEAR_SIX_METRE_AREA | 22 | 21 | 5 | 0.238 |
| CATEGORY:BACKCOURT_JUMP | 17 | 15 | 7 | 0.467 |
| QUALITY:LOWER_UNDER_0.65 | 39 | 35 | 14 | 0.400 |
| PHASE:TRANSITION | 6 | 6 | 4 | 0.667 |
| DISTANCE:8_TO_10.5M | 26 | 23 | 11 | 0.478 |
| CATEGORY:WING | 6 | 5 | 2 | 0.400 |
| PRESSURE:LOW_UNDER_0.2 | 11 | 11 | 6 | 0.545 |
| CATEGORY:BREAKTHROUGH | 10 | 9 | 5 | 0.556 |
| DISTANCE:BEYOND_10.5M | 2 | 1 | 0 | 0.000 |
| CATEGORY:STANDING | 1 | 1 | 0 | 0.000 |
| CATEGORY:SEVEN_METRE | 2 | 2 | 0 | 0.000 |
| PHASE:RESTART | 2 | 2 | 0 | 0.000 |

### Match 11: rs_player_uros_tomic_72d636e4
Saves 15; shots faced 46; save rate 0.326; attempts 52. Wilson interval 0.209–0.470.
Mean pressure 0.731; decision quality 0.585; distance 8.052m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.065.
Capabilities: {"keeper.positioning":0.6842105263157898,"keeper.setPosition":0.6842105263157898,"keeper.reaction":0.6842105263157898,"keeper.explosiveness":0.7368421052631577,"keeper.low":0.7894736842105264,"keeper.high":0.6842105263157898,"keeper.close":0.7368421052631577,"keeper.long":0.6842105263157898,"keeper.wing":0.7894736842105264,"keeper.sevenMetre":0.6842105263157898,"keeper.reading":0.7894736842105264,"keeper.outlet":0.7894736842105264,"shooter.placement":0.7312753036437252,"shooter.power":0.7338056680161944,"shooter.finishing":0.7236842105263159,"shooter.wing":0.7307692307692307,"shooter.pivot":0.6781376518218627,"shooter.decision":0.6675101214574898,"shooter.composure":0.6477732793522268,"shot.pressure":0.7310119057032002,"shot.quality":0.5845623365508423,"shot.distance":8.051772972781066}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 13 | 12 | 4 | 0.333 |
| PRESSURE:LOW_UNDER_0.2 | 10 | 10 | 2 | 0.200 |
| QUALITY:HIGH_AT_LEAST_0.65 | 15 | 15 | 2 | 0.133 |
| PHASE:ESTABLISHED | 47 | 42 | 15 | 0.357 |
| DISTANCE:8_TO_10.5M | 23 | 19 | 8 | 0.421 |
| CATEGORY:PIVOT | 14 | 12 | 3 | 0.250 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 42 | 36 | 13 | 0.361 |
| DISTANCE:UP_TO_8M | 28 | 26 | 7 | 0.269 |
| CONTEXT:NEAR_SIX_METRE_AREA | 24 | 22 | 6 | 0.273 |
| QUALITY:LOWER_UNDER_0.65 | 37 | 31 | 13 | 0.419 |
| CATEGORY:BREAKTHROUGH | 14 | 12 | 4 | 0.333 |
| CATEGORY:STANDING | 4 | 4 | 3 | 0.750 |
| CATEGORY:WING | 4 | 3 | 1 | 0.333 |
| PHASE:TRANSITION | 2 | 1 | 0 | 0.000 |
| DISTANCE:BEYOND_10.5M | 1 | 1 | 0 | 0.000 |
| CATEGORY:SEVEN_METRE | 3 | 3 | 0 | 0.000 |
| PHASE:RESTART | 3 | 3 | 0 | 0.000 |

### Match 13: se_player_josip_cavar_60b145a1
Saves 15; shots faced 39; save rate 0.385; attempts 49. Wilson interval 0.249–0.541.
Mean pressure 0.827; decision quality 0.564; distance 8.117m.
Context expectation: NO_REFERENCE_OR_PARTIAL_COVERAGE; coverage 0.026.
Capabilities: {"keeper.positioning":0.736842105263158,"keeper.setPosition":0.6842105263157898,"keeper.reaction":0.789473684210526,"keeper.explosiveness":0.789473684210526,"keeper.low":0.789473684210526,"keeper.high":0.7368421052631579,"keeper.close":0.7368421052631579,"keeper.long":0.6842105263157898,"keeper.wing":0.6842105263157898,"keeper.sevenMetre":0.7368421052631579,"keeper.reading":0.7631578947368424,"keeper.outlet":0.6842105263157898,"shooter.placement":0.7454350161117078,"shooter.power":0.774436090225564,"shooter.finishing":0.7443609022556391,"shooter.wing":0.8174006444683138,"shooter.pivot":0.7175080558539203,"shooter.decision":0.6734693877551021,"shooter.composure":0.7239527389903329,"shot.pressure":0.8266565686088242,"shot.quality":0.5639052503913619,"shot.distance":8.116507140385284}

| Context | Attempts | On target | Saves | Save rate |
|---|---:|---:|---:|---:|
| CATEGORY:BACKCOURT_JUMP | 11 | 9 | 3 | 0.333 |
| PRESSURE:PRESENT_AT_LEAST_0.2 | 41 | 31 | 10 | 0.323 |
| QUALITY:LOWER_UNDER_0.65 | 40 | 31 | 13 | 0.419 |
| PHASE:TRANSITION | 4 | 4 | 2 | 0.500 |
| DISTANCE:8_TO_10.5M | 21 | 17 | 11 | 0.647 |
| PRESSURE:LOW_UNDER_0.2 | 8 | 8 | 5 | 0.625 |
| PHASE:ESTABLISHED | 44 | 34 | 13 | 0.382 |
| CATEGORY:PIVOT | 11 | 8 | 4 | 0.500 |
| DISTANCE:UP_TO_8M | 26 | 20 | 3 | 0.150 |
| CONTEXT:NEAR_SIX_METRE_AREA | 31 | 24 | 8 | 0.333 |
| CATEGORY:SEVEN_METRE | 1 | 1 | 0 | 0.000 |
| QUALITY:HIGH_AT_LEAST_0.65 | 9 | 8 | 2 | 0.250 |
| PHASE:RESTART | 1 | 1 | 0 | 0.000 |
| CATEGORY:BREAKTHROUGH | 19 | 16 | 3 | 0.188 |
| DISTANCE:BEYOND_10.5M | 2 | 2 | 1 | 0.500 |
| CATEGORY:STANDING | 1 | 1 | 1 | 1.000 |
| CATEGORY:WING | 6 | 4 | 4 | 1.000 |

## Outliers and coverage

44 evidence-backed flags. 5552/6300 comparisons have NO_REFERENCE. Missing reference is not NORMAL.

| Match | Scope | Metric | Actual | Expected | Deviation | N | Status |
|---|---|---|---:|---:|---:|---:|---|
| 1 | TEAM | scorerConcentration | 0.3870967741935484 | 0.2502312929557239 | 0.1368654812378245 | 31 | WATCH |
| 1 | TEAM | scorerHHI | 0.24661810613943808 | 0.1580347284407489 | 0.08858337769868918 | 31 | OUTLIER |
| 2 | MATCH | outfieldShots | 115 | 97.89010989010988 | 17.109890109890117 | 1 | WATCH |
| 2 | MATCH | goals | 82 | 60.857142857142854 | 21.142857142857146 | 1 | OUTLIER |
| 2 | MATCH | suspensions | 1 | 4.802197802197802 | -3.802197802197802 | 1 | WATCH |
| 2 | TEAM | goalsPerTeam | 42 | 30.428571428571427 | 11.571428571428573 | 1 | WATCH |
| 2 | TEAM | goalsPerTeam | 40 | 30.428571428571427 | 9.571428571428573 | 1 | WATCH |
| 3 | TEAM | goalsPerTeam | 41 | 30.428571428571427 | 10.571428571428573 | 1 | WATCH |
| 4 | MATCH | suspensions | 0 | 4.802197802197802 | -4.802197802197802 | 1 | WATCH |
| 4 | TEAM | scorerHHI | 0.2244897959183674 | 0.1580347284407489 | 0.0664550674776185 | 35 | WATCH |
| 4 | TEAM | scorerConcentration | 0.4 | 0.2502312929557239 | 0.14976870704427614 | 30 | WATCH |
| 4 | TEAM | scorerHHI | 0.2377777777777778 | 0.1580347284407489 | 0.07974304933702892 | 30 | WATCH |
| 5 | TEAM | scorerHHI | 0.24845679012345678 | 0.1580347284407489 | 0.09042206168270789 | 36 | OUTLIER |
| 6 | MATCH | outfieldConversion | 0.7244897959183674 | 0.6197929853078333 | 0.10469681061053404 | 98 | WATCH |
| 6 | MATCH | sevenMetres | 0 | 6.582417582417582 | -6.582417582417582 | 1 | WATCH |
| 6 | TEAM | scorerHHI | 0.22853185595567863 | 0.1580347284407489 | 0.07049712751492973 | 38 | WATCH |
| 7 | MATCH | sevenMetres | 0 | 6.582417582417582 | -6.582417582417582 | 1 | WATCH |
| 7 | TEAM | scorerConcentration | 0.3939393939393939 | 0.2502312929557239 | 0.14370810098367004 | 33 | WATCH |
| 7 | TEAM | scorerHHI | 0.26170798898071623 | 0.1580347284407489 | 0.10367326053996734 | 33 | OUTLIER |
| 9 | MATCH | suspensions | 9 | 4.802197802197802 | 4.197802197802198 | 1 | WATCH |
| 9 | TEAM | scorerHHI | 0.23182441700960216 | 0.1580347284407489 | 0.07378968856885326 | 27 | WATCH |
| 10 | KEEPER | savePct | 0.05 | 0.28565487560078895 | -0.23565487560078896 | 40 | WATCH |
| 10 | TEAM | scorerConcentration | 0.375 | 0.2502312929557239 | 0.12476870704427612 | 32 | WATCH |
| 10 | TEAM | scorerHHI | 0.236328125 | 0.1580347284407489 | 0.0782933965592511 | 32 | WATCH |
| 11 | TEAM | scorerHHI | 0.24037460978147762 | 0.1580347284407489 | 0.08233988134072873 | 31 | WATCH |
| 13 | MATCH | suspensions | 1 | 4.802197802197802 | -3.802197802197802 | 1 | WATCH |
| 13 | TEAM | scorerConcentration | 0.375 | 0.2502312929557239 | 0.12476870704427612 | 24 | WATCH |
| 13 | TEAM | scorerHHI | 0.25 | 0.1580347284407489 | 0.0919652715592511 | 24 | OUTLIER |
| 13 | TEAM | scorerHHI | 0.23148148148148145 | 0.1580347284407489 | 0.07344675304073256 | 36 | WATCH |
| 14 | TEAM | goalsPerTeam | 41 | 30.428571428571427 | 10.571428571428573 | 1 | WATCH |
| 14 | TEAM | scorerHHI | 0.23372781065088763 | 0.1580347284407489 | 0.07569308221013873 | 26 | WATCH |
| 15 | MATCH | outfieldConversion | 0.4943820224719101 | 0.6197929853078333 | -0.12541096283592323 | 89 | WATCH |
| 15 | MATCH | goals | 44 | 60.857142857142854 | -16.857142857142854 | 1 | WATCH |
| 15 | TEAM | goalsPerTeam | 17 | 30.428571428571427 | -13.428571428571427 | 1 | WATCH |
| 15 | TEAM | scorerHHI | 0.2595155709342561 | 0.1580347284407489 | 0.1014808424935072 | 17 | OUTLIER |
| 16 | MATCH | suspensions | 1 | 4.802197802197802 | -3.802197802197802 | 1 | WATCH |
| 17 | TEAM | scorerHHI | 0.21946740128558306 | 0.1580347284407489 | 0.06143267284483417 | 33 | WATCH |
| 18 | TEAM | scorerConcentration | 0.45454545454545453 | 0.2502312929557239 | 0.20431416158973065 | 33 | OUTLIER |
| 18 | TEAM | shotConcentration | 0.4583333333333333 | 0.2373419572983402 | 0.2209913760349931 | 48 | EXTREME |
| 18 | TEAM | scorerHHI | 0.27089072543618 | 0.1580347284407489 | 0.11285599699543108 | 33 | OUTLIER |
| 19 | KEEPER | saves | 20 | 8.9 | 11.1 | 1 | WATCH |
| 19 | TEAM | scorerConcentration | 0.42424242424242425 | 0.2502312929557239 | 0.17401113128670037 | 33 | OUTLIER |
| 19 | TEAM | shotConcentration | 0.3877551020408163 | 0.2373419572983402 | 0.1504131447424761 | 49 | WATCH |
| 19 | TEAM | scorerHHI | 0.25436179981634527 | 0.1580347284407489 | 0.09632707137559637 | 33 | OUTLIER |

## How to read this report

Use N and denominators before comparing rates. Means and percentiles describe this batch. Consult per-match JSON for observed reference, contextual components, uncertainty, provenance and fallback. A keeper with 30 saves requires both on-target volume and category/pressure/quality review. NO_REFERENCE means no justified real-world verdict is possible. Engineering sanity checks are separate in summary.json.
