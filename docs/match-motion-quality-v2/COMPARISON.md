# Match Motion Quality v2 comparisons

HUMAN QA REQUIRED. Canonical diagnostics cannot certify visual quality.

## HBL N=20

| Metric | Calibrated N60 | Paired before | After |
|---|---:|---:|---:|
| goals | 62.633 | 62.900 | 65.750 |
| outfieldShots | 101.633 | 101.450 | 100.450 |
| outfieldConversion | 0.617 | 0.621 | 0.654 |
| sevenMetres | 4.200 | 4.900 | 3.550 |
| sevenMetreConversion | 0.836 | 0.844 | 0.870 |
| suspensions | 4.483 | 4.850 | 3.500 |
| savePct | 0.268 | 0.261 | 0.239 |
| scorerConcentration | 0.301 | 0.306 | 0.301 |
| shotConcentration | 0.263 | 0.264 | 0.269 |

M9: {"before":{"goalShare":0.15818759936406995,"attemptShare":0.14342040413997043},"after":{"goalShare":0.14372623574144486,"attemptShare":0.12742658038825286}}

## Allsvenskan N=20

| Metric | Calibrated N60 | Paired before | After |
|---|---:|---:|---:|
| goals | 60.083 | 60.550 | 60.100 |
| outfieldShots | 94.283 | 93.450 | 93.750 |
| outfieldConversion | 0.637 | 0.648 | 0.641 |
| sevenMetres | 4.817 | 5.000 | 4.050 |
| sevenMetreConversion | 0.894 | 0.867 | 0.891 |
| suspensions | 7.267 | 7.650 | 3.950 |
| savePct | 0.240 | 0.239 | 0.237 |
| scorerConcentration | 0.295 | 0.297 | 0.288 |
| shotConcentration | 0.259 | 0.267 | 0.252 |

M9: {"before":{"goalShare":0.1915772089182494,"attemptShare":0.1637239165329053},"after":{"goalShare":0.17470881863560733,"attemptShare":0.1504}}

## Canonical motion recipe 0

| Diagnostic count | Before | After |
|---|---:|---:|
| liveTicks | 58895 | 58386 |
| abruptReversals | 18 | 4 |
| accelerationSpikes | 56999 | 51819 |
| targetChurn | 44173 | 45217 |
| nearCollisionSamples | 4263 | 5098 |
| overlapSamples | 0 | 0 |

Synchronized reactions: before {"retarget":2456,"accelerate":11014,"reverse":0,"stop":6}; after {"retarget":1554,"accelerate":12305,"reverse":0,"stop":0}.

## Canonical motion recipe 1

| Diagnostic count | Before | After |
|---|---:|---:|
| liveTicks | 58200 | 58691 |
| abruptReversals | 20 | 2 |
| accelerationSpikes | 56453 | 52182 |
| targetChurn | 44048 | 45923 |
| nearCollisionSamples | 4002 | 5216 |
| overlapSamples | 0 | 0 |

Synchronized reactions: before {"retarget":2312,"accelerate":11651,"reverse":0,"stop":6}; after {"retarget":1515,"accelerate":12920,"reverse":0,"stop":0}.
