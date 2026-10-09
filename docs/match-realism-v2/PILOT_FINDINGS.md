# Corrective pilot evidence

These are development pilots, not the final paired fifty-match AFTER sample. All use the first fixed baseline recipes and pinned career inputs. No undesirable case is excluded from the evidence.

## First pilot

`pilot-after/`: five full matches. The 15 m+ false-empty-goal attempts disappeared. Case 0 ended 2–7 with only 21 possessions/11 shots: two unrecovered loose-ball spells consumed 85.53% of official match time. The loose ball could retain a field collector inside an area it could not enter, or a stale approach action. Recovery has since been changed to an eligible physical claimant and an actual executing reception, preserving collision and ownership constraints.

The other four cases finished 24–28, 24–22, 35–31, and 11–28. Conventional save percentages were 6–12%; ready keeper stances could not enter the released-shot branch because an availability guard skipped them. The model now prepares for a visible throwing action and commits once to its actual released velocity. It does not read future aim.

## Second pilot

`pilot-2/`: five complete matches, source fingerprints stable. Mean and median total goals 30 (range 28–34), possessions 104/106 (94–112), shots 78.2/79 (72–87), backcourt share 71.35%, wing share 6.88%, other share 21.77%. Non-shot losses 27.8, career turnover endings 33, saves 35.4, conventional save rate 53.90%, blocks 11.6, seven-metre attempts 1.2, suspensions 0.4. Mean official event-span per possession 34.76 s, 9.78 completed passes/attack, transition shots zero, top scorer share 43.82%.

The old loose-ball stall disappeared: longest attacks were 100.2–122.15 s and retained actual play facts to the end. Shot/save/block action IDs reconcile without save/goal overlap or duplicate save/block inflation. Sampled controller/release-origin checks found no error; these are sampled observations, not proof of every tick.

This pilot exposed a causal transition problem: goalkeeper throws waited for a receiver to reach a fixed 22/26 m local depth. Players reset while waiting, so a legally available outlet lost its advantage. The final correction removes that artificial receiving-location requirement; it retains the existing lawful restart gate and actual throw/catch. A review also found that wide-shot height interpolated against the wrong distance. Height now progresses to the actual goal plane. Specialized seven-metre reading is integrated into the actual released-penalty read, with the ordinary physical span retained.

Pilot 2's mean simulation runtime was 22.69 s (13.80–26.39), total batch 143.78 s, while full tests and the production build ran concurrently. These wall times are not a controlled isolated performance regression. Final sample and separate acceptance timings are reported with their context.
