// HM-ALPHA2-04D: 7v6 at the plan/engine boundary. The plan already carries
// `attackPlan.sevenVSixPolicy` ({ level, activeFromKickoff }). Its default
// (SITUATIONAL, not active from kickoff) was never shown to a manager, so a
// policy only reaches kickoff when it is marked active; everything else starts
// a played match in 6v6, exactly as before. The live control can switch it.
import type { SevenVSixMode } from "@handball-manager/handball-engine/src/v2/core/coaching";
import type { SevenVSixPolicy } from "./types";

/** The engine mode a stored policy starts the match with. */
export function engineSevenVSixMode(policy: SevenVSixPolicy | undefined): SevenVSixMode {
  if (!policy?.activeFromKickoff || policy.level === "NEVER") return "OFF";
  if (policy.level === "SITUATIONAL") return "SITUATIONAL";
  return policy.level === "FREQUENT" || policy.level === "PRIMARY" ? "ALWAYS" : "OFF";
}

/** The stored policy for a mode chosen on the tactics page. */
export function sevenVSixPolicyFor(mode: SevenVSixMode): SevenVSixPolicy {
  return mode === "OFF" ? { level: "NEVER", activeFromKickoff: false } : { level: mode === "ALWAYS" ? "PRIMARY" : "SITUATIONAL", activeFromKickoff: true };
}
