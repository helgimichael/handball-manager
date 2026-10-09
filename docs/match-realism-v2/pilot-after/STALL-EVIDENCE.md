# First post-change pilot: lifecycle stall retained

All five cases reached the official full-time state; this was not sufficient evidence of healthy play. Case 0, canonical seed `1765851951`, finished **2–7** with only **21 attacks and 11 shots**. No case is removed from the recorded pilot.

| Case 0 possession | Team | Official interval | Span | Passes | Shots | Ending |
|---|---|---|---:|---:|---:|---|
| possession-7601 | HOME | 01:37.2–30:00 | 1,702.8s | 12 | 0 | PERIOD_END |
| possession-41543 | HOME | 37:03.6–60:00 | 1,376.4s | 10 | 0 | PERIOD_END |

These two recorded attack spans consume **85.53%** of official match time. They include play before the ball becomes stranded, so their opening timestamps are not the exact stall onset. Other case-0 attacks are much shorter; one 58.45s away attack ends in canonical passive play.

The preserved first-half contact window still shows genuine moving play through **02:09.7**. Its stored event/frame window ends there, before the long stall's onset can be established. The second-half stranded phase has no late-onset window retained. The files therefore prove a lifecycle stall but cannot by themselves prove the suspected goalkeeper-collector target overwrite.

Case 0 has only one controller-present chunk sample: tick 40,000, Jim Gottfridsson, 0.299m ball/body separation, on court, no concurrent flight. Other 10,000-tick chunk boundaries had no controller. Zero sampled-control errors must not be described as an every-tick proof. All 11 released shots have exact same-tick production shooter frames and no release/body-separation error.

Case-0 counts include eight BALL_LOOSE events, four RECEPTION_FAILED, four PASS_DEFLECTED, two SAVE_CAUGHT, no SAVE_PARRY, seven fouls and no suspensions. Every release is within 15m. The stall is not hidden by half-court shooting or a score multiplier.

| Pilot case | Score | Attacks | Shots | Non-shot losses | Technical losses | Interceptions | Duel loss |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 2–7 | 21 | 11 | 8 | 1 | 2 | 4 |
| 1 | 24–28 | 112 | 72 | 43 | 6 | 15 | 19 |
| 2 | 24–22 | 99 | 62 | 41 | 6 | 16 | 18 |
| 3 | 35–31 | 125 | 79 | 45 | 1 | 21 | 23 |
| 4 | 11–28 | 108 | 62 | 48 | 3 | 15 | 25 |

Saved-event counts equal unique shot actions marked saved in all five cases: 2, 7, 3, 4 and 5. There is no observed save-count inflation from deflections. In cases 1–4, saves/(saves+goals) is 11.86%, 6.12%, 5.71% and 11.36%; saves/all-attempts is 9.72%, 4.84%, 5.06% and 8.06%. Low goalkeeper impact is a separate outcome concern, not a denominator disagreement.

Pilot batch runtime was 44.21s. Canonical simulation runtime per case averaged 6.983s, median 7.788s, maximum 8.438s. The stalled case was faster, so it must not be used as a successful performance example. Source fingerprints were stable throughout the pilot. Exact input/seed/state records remain alongside this note. No engine, UI or baseline data was changed while reading this evidence.
