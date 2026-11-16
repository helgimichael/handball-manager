// Arena Nights MGR-01b C: the job market as an application pipeline --
// Lediga -> Ansökt -> Intervju -> Erbjudande -> Avgjort. Pure view model over
// the existing vacancies, applications and offers; fit uses the existing
// candidate assessment (reputation vs club stature). Changes no job rules.
import type { JobApplication, JobOffer, ManagerCareerState, Vacancy } from "../board/types";
import type { CandidateAssessment } from "./managerCareer";

export type PipelineStage = "OPEN" | "APPLIED" | "INTERVIEW" | "OFFER" | "DECIDED";

export const PIPELINE_STAGES: readonly { id: PipelineStage; label: string; hint: string }[] = [
  { id: "OPEN", label: "Lediga", hint: "Klubbar som söker tränare" },
  { id: "APPLIED", label: "Ansökt", hint: "Intervjun är gjord, klubben svarar" },
  { id: "INTERVIEW", label: "Intervju", hint: "Styrelsen väntar på dina svar" },
  { id: "OFFER", label: "Erbjudande", hint: "Klubbar som vill ha dig" },
  { id: "DECIDED", label: "Avgjort", hint: "Klart, åt ena eller andra hållet" },
];

export type FitLevel = "STRONG" | "CLOSE" | "STRETCH";

export interface JobFit {
  level: FitLevel;
  label: string;
  /** Your standing (reputation + experience) and what the club wants. */
  standing: number;
  need: number;
  factors: string[];
}

export type PipelineAction = "APPLY" | "ANSWER" | "ACCEPT" | null;

export interface PipelineCard {
  id: string;
  stage: PipelineStage;
  clubId: string;
  /** The date the next step must happen by, when there is one. */
  deadline: string | null;
  deadlineLabel: string | null;
  fit: JobFit | null;
  /** The action the manager can take now (the card glows). */
  action: PipelineAction;
  status: string;
  note: string | null;
  vacancy?: Vacancy;
  application?: JobApplication;
  offer?: JobOffer;
}

export interface JobPipeline {
  stages: { id: PipelineStage; label: string; hint: string; cards: PipelineCard[] }[];
  needsAction: number;
  total: number;
}

export function jobFit(a: CandidateAssessment): JobFit {
  const standing = a.reputation + a.experiencePoints;
  const level: FitLevel = standing >= a.need ? "STRONG" : standing >= a.need - 8 ? "CLOSE" : "STRETCH";
  return {
    level,
    label: level === "STRONG" ? "Du är en stark kandidat" : level === "CLOSE" ? "Du är nära vad de söker" : "Jobbet är ett stort kliv",
    standing,
    need: a.need,
    factors: [`ditt rykte ${a.reputation} mot jobbets nivå ${a.need}`, ...a.parts.map((p) => `${p.label} (${p.points > 0 ? "+" : ""}${p.points})`)],
  };
}

const APP_STATUS: Record<JobApplication["status"], string> = {
  INTERVIEW: "Intervju väntar",
  ANSWERED: "Väntar på svar",
  OFFERED: "Erbjuden jobbet",
  REJECTED: "Fick inte jobbet",
  WITHDRAWN: "Återtagen",
};
const OFFER_STATUS: Record<JobOffer["status"], string> = { OPEN: "Öppet", ACCEPTED: "Accepterat", DECLINED: "Du tackade nej", EXPIRED: "Gick ut" };

/**
 * @param assess the existing candidate assessment for a club (injected so the model stays pure and testable).
 * @param openVacancies vacancies still open today; @param today the game date.
 */
export function buildJobPipeline(mc: ManagerCareerState, openVacancies: readonly Vacancy[], today: string, assess: (clubId: string) => CandidateAssessment, decidedLimit = 6): JobPipeline {
  const apps = Object.values(mc.applications);
  const offers = Object.values(mc.offers);
  const fitOf = (clubId: string) => jobFit(assess(clubId));
  const cards: PipelineCard[] = [];

  for (const v of openVacancies) {
    const applied = apps.find((a) => a.clubId === v.clubId && a.appliedOn >= v.openedOn);
    if (applied) continue; // the application card carries the club from here
    cards.push({ id: `vac:${v.clubId}`, stage: "OPEN", clubId: v.clubId, deadline: v.closesOn, deadlineLabel: `Ansök senast ${v.closesOn}`, fit: fitOf(v.clubId), action: "APPLY", status: v.reason, note: null, vacancy: v });
  }

  for (const a of apps) {
    const vacancy = openVacancies.find((v) => v.clubId === a.clubId);
    if (a.status === "INTERVIEW") {
      cards.push({ id: `app:${a.id}`, stage: "INTERVIEW", clubId: a.clubId, deadline: vacancy?.closesOn ?? null, deadlineLabel: vacancy ? `Tjänsten stänger ${vacancy.closesOn}` : null, fit: fitOf(a.clubId), action: "ANSWER", status: APP_STATUS[a.status], note: a.note ?? null, application: a, vacancy });
    } else if (a.status === "ANSWERED") {
      cards.push({ id: `app:${a.id}`, stage: "APPLIED", clubId: a.clubId, deadline: a.decisionOn ?? null, deadlineLabel: a.decisionOn ? `Svar ${a.decisionOn}` : null, fit: fitOf(a.clubId), action: null, status: APP_STATUS[a.status], note: a.note ?? null, application: a });
    } else if (a.status === "OFFERED") {
      // An offered application continues as its offer card; only keep it when the offer is gone.
      const offer = offers.find((o) => o.clubId === a.clubId && o.offeredOn >= a.appliedOn);
      if (offer) continue;
      cards.push({ id: `app:${a.id}`, stage: "DECIDED", clubId: a.clubId, deadline: null, deadlineLabel: null, fit: null, action: null, status: APP_STATUS[a.status], note: a.note ?? null, application: a });
    } else {
      cards.push({ id: `app:${a.id}`, stage: "DECIDED", clubId: a.clubId, deadline: null, deadlineLabel: a.decisionOn ?? a.appliedOn, fit: null, action: null, status: APP_STATUS[a.status], note: a.note ?? null, application: a });
    }
  }

  for (const o of offers) {
    if (o.status === "OPEN" && o.expiresOn >= today) {
      cards.push({ id: `offer:${o.id}`, stage: "OFFER", clubId: o.clubId, deadline: o.expiresOn, deadlineLabel: `Svar senast ${o.expiresOn}`, fit: fitOf(o.clubId), action: "ACCEPT", status: o.source === "APPROACH" ? "Klubben hörde av sig" : o.source === "APPLICATION" ? "Efter intervjun" : "Vill ge dig en chans", note: o.pitch, offer: o });
    } else {
      cards.push({ id: `offer:${o.id}`, stage: "DECIDED", clubId: o.clubId, deadline: null, deadlineLabel: o.expiresOn, fit: null, action: null, status: o.status === "OPEN" ? OFFER_STATUS.EXPIRED : OFFER_STATUS[o.status], note: null, offer: o });
    }
  }

  const byDeadline = (a: PipelineCard, b: PipelineCard) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
  const stages = PIPELINE_STAGES.map((s) => {
    const list = cards.filter((c) => c.stage === s.id);
    return { ...s, cards: s.id === "DECIDED" ? list.sort((a, b) => (b.deadlineLabel ?? "").localeCompare(a.deadlineLabel ?? "")).slice(0, decidedLimit) : list.sort(byDeadline) };
  });
  return { stages, needsAction: cards.filter((c) => c.action && c.action !== "APPLY").length, total: cards.length };
}
