// M8D: print the ageing curve (mean CA lost per season by age and position).
import { ageingDeclineChanges } from "../../lib/career/playerLifecycle";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES } from "../../lib/rating/types";
const attrs = (list: readonly string[]) => Object.fromEntries(list.map((a) => [a, { value: 15 }]));
for (const [pos, br] of [["V9", "OUTCOURT"], ["V6", "OUTCOURT"], ["M9", "OUTCOURT"], ["M6", "OUTCOURT"], ["MV", "GOALKEEPER"]] as const) {
  const row: string[] = [];
  for (let age = 29; age <= 40; age++) {
    let t = 0;
    for (let i = 0; i < 400; i++) t -= ageingDeclineChanges(`p${i}`, "2030", age, pos, br, attrs(br === "GOALKEEPER" ? GOALKEEPER_ATTRIBUTES : OUTCOURT_ATTRIBUTES)).reduce((a, c) => a + c.caDelta, 0);
    row.push(`${age}:${(t / 400).toFixed(1)}`);
  }
  console.log(pos, row.join(" "));
}
