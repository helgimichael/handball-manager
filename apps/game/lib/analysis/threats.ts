// Arena Nights -- MDY-01d / ANL-03 threat cards: 3-4 things the next opponent does well, each with how
// sure we are and "Vårt svar" linking to the plan setting. Built only from the completed opponent
// scouting report (its own claims and confidence) and the opponent's public results compared with
// ours (MirrorRow). Nothing hidden is read: no player abilities, no unscouted line-up.
import type { OpponentScoutReport, ScoutingConfidence } from "../scouting/opponentScouting";
import type { MirrorRow } from "./trends";

export interface ThreatCard {
  id: string;
  title: string;
  text: string;
  /** "Scouting" claims carry the report's confidence; "Resultat" cards are public facts. */
  source: "SCOUTING" | "RESULTS";
  confidence: ScoutingConfidence | "FACT";
  /** Confidence in percent: the report's reliability for scouting claims, 100 for public results. */
  confidencePct: number;
  answer: string;
  href: string;
}

const PLAN = "/career/tactics#plan-attack";
const SQUAD = "/career/tactics#plan-squad";
const CLAIM_ANSWER: Record<string, { title: string; answer: string; href: string }> = {
  "Försvarsstruktur": { title: "Deras försvar", answer: "Välj anfallsmönster mot deras försvarssystem", href: PLAN },
  "Tempo": { title: "Deras tempo", answer: "Anpassa vårt tempo och omställningsförsvar", href: PLAN },
  "Anfallsmönster": { title: "Deras anfall", answer: "Ställ in försvarssystem och aggressivitet", href: PLAN },
  "Nyckelspelare": { title: "Nyckelspelare", answer: "Matcha försvarsuppställningen mot deras skyttar", href: SQUAD },
};
const RESULT_THREAT: Record<string, { title: string; answer: string; href: string }> = {
  GF: { title: "Målfarligt anfall", answer: "Stabilare försvar: system och aggressivitet", href: PLAN },
  SHOTS: { title: "Många avslut", answer: "Pressa tidigare i försvaret", href: PLAN },
  SHOT_PCT: { title: "Effektiva avslut", answer: "Stäng skottlägena: försvarssystemet", href: PLAN },
  TURNOVERS: { title: "Säkra med bollen", answer: "Aggressivare försvar för att tvinga fram misstag", href: PLAN },
  SEVEN_M: { title: "Säkra från 7 meter", answer: "Undvik onödiga frikast nära målgården", href: PLAN },
  GA: { title: "Tätt försvar", answer: "Tålamod och bredd i anfallet", href: PLAN },
  SAVE_PCT: { title: "Stark målvakt", answer: "Skapa lägen från kanter och linje", href: PLAN },
  TWO_MIN: { title: "Disciplinerade", answer: "Räkna inte med spel i överläge", href: SQUAD },
};

/** Up to `limit` threat cards. Scouting claims first (LOW-confidence claims are left out unless nothing else exists), then public-result strengths. */
export function threatCards(report: OpponentScoutReport | undefined, mirror: readonly MirrorRow[], limit = 4): ThreatCard[] {
  const out: ThreatCard[] = [];
  const pct = report ? Math.round(report.reliability * 100) : 0;
  if (report) {
    const claims = report.scouted.filter((c) => CLAIM_ANSWER[c.topic]);
    const trusted = claims.filter((c) => c.confidence !== "LOW");
    for (const c of (trusted.length ? trusted : claims)) {
      const a = CLAIM_ANSWER[c.topic]!;
      out.push({ id: `claim:${c.topic}`, title: a.title, text: c.text, source: "SCOUTING", confidence: c.confidence, confidencePct: pct, answer: recommendationFor(report, c.topic) ?? a.answer, href: a.href });
    }
  }
  const stronger = mirror.filter((m) => m.stronger === "them" && RESULT_THREAT[m.id]);
  for (const m of stronger) {
    const t = RESULT_THREAT[m.id]!;
    out.push({ id: `result:${m.id}`, title: t.title, text: `${m.label}: ${fmt(m.them, m.pct)} mot vårt ${fmt(m.us, m.pct)}.`, source: "RESULTS", confidence: "FACT", confidencePct: 100, answer: t.answer, href: t.href });
  }
  // Scouting first, but never more than half the row when results also show something.
  const scouting = out.filter((c) => c.source === "SCOUTING"), results = out.filter((c) => c.source === "RESULTS");
  const take = results.length ? Math.min(scouting.length, Math.ceil(limit / 2)) : Math.min(scouting.length, limit);
  return [...scouting.slice(0, take), ...results].slice(0, limit);
}

function recommendationFor(report: OpponentScoutReport, topic: string): string | undefined {
  if (topic === "Försvarsstruktur") return report.recommendations.find((r) => r.startsWith("Mot "));
  return undefined;
}

function fmt(v: number | null, pct: boolean): string {
  if (v === null) return "—";
  return pct ? `${Math.round(v * 100)} %` : v.toFixed(1).replace(".", ",");
}
