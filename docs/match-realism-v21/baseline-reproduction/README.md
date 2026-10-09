# Released v2 baseline reproduced

All 4 current-checkpoint matches exactly reproduce the committed v2 AFTER evidence on all four truth hashes. No behavior changes preceded this reproduction.

| Index | Canonical seed | Recorded score | Four hashes |
|---|---:|---:|---|
| 0 | 1765851951 | 22-28 | Exact equality |
| 5 | 1793243603 | 12-22 | Exact equality |
| 16 | 3443931976 | 19-19 | Exact equality |
| 18 | 1619981876 | 9-9 | Exact equality |

Input snapshot SHA-256: `37b2f9ee4648ede1a422549fb680bad5c172ebdf70c77f65334d2e6487ab0347`. See reproduction-proof.json for complete initial/final/result/event/RNG/frame hashes and source equivalence. The only raw source differences are documented lint cleanup whose emitted JavaScript is identical.

These four processes ran concurrently, causing substantial resource contention. Do not use their approximately 145–152 second per-match wall times as an isolated engine-performance claim. Future calibration samples run one sequential process. Original v2 baseline, AFTER records and human-QA files remain unchanged.
