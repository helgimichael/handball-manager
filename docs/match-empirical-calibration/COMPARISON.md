# Match Engine Empirical Calibration v1

Starting checkpoint 6c2c494. References: complete 2025/26 regular seasons; actual engine inputs: retained 2026/27 roster/fixtures.

## se_handbollsligan_herr
Before N=20; paired N=20; final N=60.

| Metric/scope | Before | Empirical | Paired after | Final after | Reference |
|---|---:|---:|---:|---:|---|
| goals/MATCH | 51.100 | 60.857 | 62.900 | 62.633 | EXACT_COMPETITION_SEASON |
| outfieldShots/MATCH | 111.750 | 97.890 | 101.450 | 101.633 | EXACT_COMPETITION_SEASON |
| outfieldConversion/MATCH | 0.457 | 0.620 | 0.621 | 0.617 | EXACT_COMPETITION_SEASON |
| savePct/KEEPER | 0.492 | 0.286 | 0.261 | 0.268 | EXACT_COMPETITION_SEASON |
| sevenMetres/MATCH | 8.900 | 6.582 | 4.900 | 4.200 | EXACT_COMPETITION_SEASON |
| sevenMetreConversion/MATCH | 0.605 | 0.757 | 0.844 | 0.836 | EXACT_COMPETITION_SEASON |
| suspensions/MATCH | 8.850 | 4.802 | 4.850 | 4.483 | EXACT_COMPETITION_SEASON |
| scorerConcentration/TEAM | 0.453 | 0.250 | 0.306 | 0.301 | EXACT_COMPETITION_SEASON |
| shotConcentration/TEAM | 0.425 | 0.237 | 0.264 | 0.263 | EXACT_COMPETITION_SEASON |

Keeper tails (minimum 10 faced): N=120; >50% 2, >60% 0, >70% 0. Mean saves 11.525, p95 18.000, maximum 25.000.

Shot taxonomy: {"n":6098,"goals":3758,"saves":1383,"blocks":584,"misses":373}.

Position shares: {"POSITION:V9":{"attempts":1272,"goals":841,"shotShare":0.208592981305346,"goalShare":0.2237892496008515},"POSITION:H6":{"attempts":760,"goals":394,"shotShare":0.12463102656608724,"goalShare":0.10484300159659393},"POSITION:H9":{"attempts":1280,"goals":788,"shotShare":0.20990488684814693,"goalShare":0.20968600319318786},"POSITION:M6":{"attempts":1135,"goals":738,"shotShare":0.18612659888488028,"goalShare":0.19638105375199574},"POSITION:V6":{"attempts":772,"goals":417,"shotShare":0.12659888488028861,"goalShare":0.11096327833954231},"POSITION:M9":{"attempts":879,"goals":580,"shotShare":0.1441456215152509,"goalShare":0.15433741351782862}}.

Half diagnostics: [{"period":1,"attempts":3139,"conversion":0.6158012105766167,"savePct":0.2743993993993994,"energy":{"n":3139,"mean":0.8801807248636294,"median":0.8838646557832637,"sd":0.07188257975015644,"min":0.687732097307758,"max":0.9986330556637393,"p05":0.7614215476157913,"p10":0.7829082136756681,"p25":0.8233748268768424,"p75":0.9424271747002599,"p90":0.9750889693812257,"p95":0.9879052655935244},"quality":{"n":3139,"mean":0.5393987051381447,"median":0.5368295953096388,"sd":0.14316835568347414,"min":0.19136559549310886,"max":0.9028117262673939,"p05":0.285852529920201,"p10":0.32343370862224397,"p25":0.45884021868575736,"p75":0.6313545370829007,"p90":0.7123400076473496,"p95":0.7940093558033198}},{"period":2,"attempts":2959,"conversion":0.6167624197363974,"savePct":0.26322163907953167,"energy":{"n":2959,"mean":0.733863725997276,"median":0.7080457461793693,"sd":0.11947094384501854,"min":0.3775334356647569,"max":0.9996773869239705,"p05":0.5741596668720809,"p10":0.6081297582880174,"p25":0.6539012001991141,"p75":0.7761789566753572,"p90":0.9521319657579056,"p95":0.9790245285945864},"quality":{"n":2959,"mean":0.5394693704842649,"median":0.5401841906007216,"sd":0.14404859168421721,"min":0.18960300963996615,"max":0.8994847377590145,"p05":0.27849399790141033,"p10":0.3209749722241911,"p25":0.45749832645752364,"p75":0.6293967522298329,"p90":0.7162156792387455,"p95":0.8102223889976162}}].

## swe-2
Before N=20; paired N=20; final N=60.

| Metric/scope | Before | Empirical | Paired after | Final after | Reference |
|---|---:|---:|---:|---:|---|
| goals/MATCH | 50.650 | 61.615 | 60.550 | 60.083 | EXACT_COMPETITION_SEASON |
| outfieldShots/MATCH | 103.200 | NO_REFERENCE | 93.450 | 94.283 | NO_REFERENCE |
| outfieldConversion/MATCH | 0.489 | NO_REFERENCE | 0.648 | 0.637 | NO_REFERENCE |
| savePct/KEEPER | 0.469 | 0.286 | 0.239 | 0.240 | EXPLICIT_HBL_KEEPER_PROXY |
| sevenMetres/MATCH | 11.100 | 7.115 | 5.000 | 4.817 | EXACT_COMPETITION_SEASON |
| sevenMetreConversion/MATCH | 0.643 | 0.750 | 0.867 | 0.894 | EXACT_COMPETITION_SEASON |
| suspensions/MATCH | 11.850 | 5.769 | 7.650 | 7.267 | EXACT_COMPETITION_SEASON |
| scorerConcentration/TEAM | 0.440 | 0.245 | 0.297 | 0.295 | EXACT_COMPETITION_SEASON |
| shotConcentration/TEAM | 0.419 | NO_REFERENCE | 0.267 | 0.259 | NO_REFERENCE |

Keeper tails (minimum 10 faced): N=120; >50% 0, >60% 0, >70% 0. Mean saves 9.417, p95 15.000, maximum 20.000.

Shot taxonomy: {"n":5657,"goals":3605,"saves":1130,"blocks":496,"misses":426}.

Position shares: {"POSITION:M9":{"attempts":952,"goals":696,"shotShare":0.16828707795651404,"goalShare":0.1930651872399445},"POSITION:H9":{"attempts":1197,"goals":799,"shotShare":0.21159625243061694,"goalShare":0.2216366158113731},"POSITION:V9":{"attempts":958,"goals":593,"shotShare":0.1693477108007778,"goalShare":0.16449375866851595},"POSITION:H6":{"attempts":683,"goals":369,"shotShare":0.12073537210535619,"goalShare":0.10235783633841886},"POSITION:V6":{"attempts":790,"goals":476,"shotShare":0.13964999116139296,"goalShare":0.13203883495145632},"POSITION:M6":{"attempts":1077,"goals":672,"shotShare":0.19038359554534207,"goalShare":0.18640776699029127}}.

Half diagnostics: [{"period":1,"attempts":2949,"conversion":0.6378433367243134,"savePct":0.23161764705882354,"energy":{"n":2949,"mean":0.8823282487764512,"median":0.8861615864067826,"sd":0.07114010172630397,"min":0.6982220800404181,"max":0.9985778904106978,"p05":0.7647363150288077,"p10":0.7845488342885056,"p25":0.8255755858315184,"p75":0.9436730140315224,"p90":0.976484868985365,"p95":0.987172218499895},"quality":{"n":2949,"mean":0.5446624753934335,"median":0.5426540422031947,"sd":0.1434234769318852,"min":0.19082529602079448,"max":0.9130096460311954,"p05":0.28351053851663677,"p10":0.33633646313511506,"p25":0.46679928089437017,"p75":0.6302150879893398,"p90":0.716848327881783,"p95":0.8373437665099577}},{"period":2,"attempts":2708,"conversion":0.6366322008862629,"savePct":0.24617402710975075,"energy":{"n":2708,"mean":0.7485934683367874,"median":0.7202127366487766,"sd":0.12478940518182464,"min":0.41578503507484676,"max":0.998321740147683,"p05":0.5743236203193319,"p10":0.6161982473644608,"p25":0.6630556859933914,"p75":0.8236484520687126,"p90":0.9610425284336886,"p95":0.983201517513477},"quality":{"n":2708,"mean":0.5421703864298628,"median":0.5446023267929437,"sd":0.1405755859162864,"min":0.1736900737725993,"max":0.8870006762703598,"p05":0.27854640236694855,"p10":0.32295466566965253,"p25":0.4687623915801396,"p75":0.6271837719876984,"p90":0.7137184421572864,"p95":0.8112396090759529}}].

## How to read
Compare competition, observation unit, denominator and sample coverage first. Keeper exposure buckets and combined team goalkeeping are separate from per-keeper observations. Position-season shares are descriptive pooled aggregates, not match-share z-scores. Before/after differences are paired only for the retained first 20. No unsupported metric has a fabricated empirical target. Full distributions, tails, pairs and proof receipts are in comparison.json.
