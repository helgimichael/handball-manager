/**
 * MATCH-EXPERIENCE-2.0 M16: run the match bench.
 *
 *   npm run bench --workspace=packages/handball-engine
 *
 * Prints the deterministic bench report. The intended use is to run it once
 * before an engine change and once after, and read the two outputs side by
 * side -- which is why the formatting is stable and the seed set is fixed.
 *
 * `--uncoached` plays the same seeds with M12's automatic coach switched off,
 * which is occasionally useful for telling a coaching effect apart from an
 * engine one. Nothing else is configurable from here on purpose: a bench whose
 * inputs drift is a bench whose numbers cannot be compared.
 */
import { formatBenchReport, runMatchBench } from "../src/bench/matchBench";

const coached = !process.argv.includes("--uncoached");
process.stdout.write(`${formatBenchReport(runMatchBench({ coached }))}\n`);
