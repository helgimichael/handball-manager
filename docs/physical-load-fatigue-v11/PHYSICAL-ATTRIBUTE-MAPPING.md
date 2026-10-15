# Physical attributes and functional capacity

The actual HM outcourt physical family has eleven attributes, all on the existing 1–20 scale. The retained Allsvenskan production input contains 228 outcourt players; most physical p10 values are 11 and p90 values 15–16. Controlled trials therefore use 11 and 16, with technical attributes held at 13. See `attribute-distribution.json`. These are game ratings, often generated priors; this is not measured physiological evidence.

| Physical concept | Existing attributes and engine mapping | Used for | Not used for |
| --- | --- | --- | --- |
| Sustained reserve | `ENDURANCE` → existing `profile.endurance`, `(rating−1)/19` | Running energy efficiency, some speed retention, readiness recovery and bounded rest reserve recovery | Passing or shooting talent, Intelligence, position taxes |
| Acceleration | `ACCELERATION` and `EXPLOSIVENESS` → existing `profile.acceleration = 3.6 + 4 × mean(normalized attributes)`; raw normalized acceleration retained in optional `profile.physical` | Absolute acceleration, acceleration work efficiency and repeat first-step retention | Contact tolerance or generic technical skill |
| Top speed | `TOP_SPEED`, `AGILITY` → existing `4.4 + 3 × mean(TOP_SPEED, TOP_SPEED, AGILITY)` | Absolute useful speed and relative running intensity | Universal energy discount |
| Footwork | `AGILITY`, `LATERAL_QUICKNESS`, `MOBILITY` → normalized, separate optional profile fields | Direction-change cost/retention; braking efficiency uses mobility. A turn-retention blend is limited to this physical task | Shooting talent or contact cost |
| Contact resistance | `STRENGTH`, `CONTACT_BALANCE` → existing strength/balance capacities | Actual contact reserve cost; balance can protect body control under execution pressure | Running reserve cost, automatic fouls or suspensions |
| Jump demand | `JUMP_ABILITY`, `EXPLOSIVENESS` → normalized optional profile fields | Cost of an executed takeoff; repeated takeoffs add acute work affecting difficult execution | A jump-height/biomechanics simulator, static block/jump penalties |
| Repeat-action tolerance | `REPEAT_SPRINT_ABILITY` → normalized optional profile field | Acute accumulation, repeated-work reserve surcharge, readiness recovery and functional acceleration/execution retention | Any forced substitution, score bonus or action quota |
| Recovery | No separate recovery or conditioning attribute exists. `ENDURANCE` and `REPEAT_SPRINT_ABILITY` are explicitly used as readiness-recovery proxies | Decay of recent exertion during actual low work, bench, halftime, stoppages and timeout windows | Weekly fitness, injury, fixture congestion or medical predictions |
| Work rate / effort | No physical work-rate attribute is added. Actual velocity changes, speed, executed contact and takeoff supply work | Observed demand, including transition and retreat exposure | Position/role energy tax, hidden overall ability |
| Technical protection | Existing passing, handling/composure and shooting-placement/finishing/wing-finishing capacities | Technique protects the corresponding difficult execution against physical degradation | A generic average of all physical attributes |

`profile.physical` exposes existing rating capacities previously omitted by the engine adapter. No new permanent player attribute, CA/PA proxy or global PHYSICAL_SCORE is introduced. The existing technical and goalkeeper mappings are retained. Goalkeepers do not receive field-player physical load, acute penalties or a rotation requirement.

Old active sessions can omit both `profile.physical` and `condition.physicalLoad`. Missing new dimensions use existing endurance/acceleration where applicable, otherwise the neutral normalized anchor; no database lookup or rating rewrite occurs while resuming. Exact mappings are visible in `profile.ts` and `physicalLoad.ts`. The save envelope schema and archive format are unchanged.
