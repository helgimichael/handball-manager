import type { StaffRole } from "./types";

export type Ambition = "STABILITY" | "PROGRESSION" | "HEAD_ROLE";

export type LeadershipDesire = "SUPPORT" | "DEPARTMENT_LEAD" | "ORGANISATION_HEAD";
export type PrestigeDesire = "REGIONAL" | "NATIONAL_ELITE" | "INTERNATIONAL";
export type WageExpectationTier = "MODEST" | "STANDARD" | "PREMIUM";

export interface StaffAmbitionProfile {
  ambition: Ambition;
  role: StaffRole;
  label: string;
  description: string;
  leadershipDesire: LeadershipDesire;
  prestigeDesire: PrestigeDesire;
  wageExpectationTier: WageExpectationTier;
}

/** Fallback labels preserved for legacy callers */
export const AMBITION_LABEL: Record<Ambition, string> = {
  STABILITY: "Trivs och vill stanna",
  PROGRESSION: "Vill ta nästa steg",
  HEAD_ROLE: "Siktar på en egen huvudroll",
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** Deterministic base ambition category for a staff person */
export function ambitionOf(staffId: string, _role?: StaffRole): Ambition {
  const r = hash(`${staffId}:ambition`);
  return r < 0.45 ? "STABILITY" : r < 0.8 ? "PROGRESSION" : "HEAD_ROLE";
}

interface RoleAmbitionDefinition {
  label: string;
  description: string;
  leadershipDesire: LeadershipDesire;
  prestigeDesire: PrestigeDesire;
  wageExpectationTier: WageExpectationTier;
}

const ROLE_AMBITION_DEFINITIONS: Record<StaffRole, Record<Ambition, RoleAmbitionDefinition>> = {
  HEAD_COACH: {
    STABILITY: {
      label: "Bygger kontinuitet",
      description: "Trivs med förtroendet och vill bygga långsiktig stabilitet och spelarutveckling i klubben.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Siktar mot toppen",
      description: "Siktar på att etablera laget i toppen och ta nästa steg mot slutspel och titelkamp.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Titlar och Europa",
      description: "Siktar på SM-guld, internationellt cupspel och framtida landslagsuppdrag.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "INTERNATIONAL",
      wageExpectationTier: "PREMIUM",
    },
  },
  ASSISTANT_COACH: {
    STABILITY: {
      label: "Trivs som assisterande",
      description: "Trivs i rollen som assisterande och med det dagliga tränings- och matcharbetet nära truppen.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill ta mer ansvar",
      description: "Vill ta mer taktiskt ansvar och förbereda sig för en framtida roll som huvudtränare.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på huvudtränarroll",
      description: "Siktar på en egen huvudtränarroll i Handbollsligan eller Allsvenskan.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "PREMIUM",
    },
  },
  GOALKEEPER_COACH: {
    STABILITY: {
      label: "Trivs i målvaktsteamet",
      description: "Trivs med att slipa målvaktsteamets teknik, positionsspel och matchförberedelser.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill utveckla elitmålvakter",
      description: "Vill utveckla målvakter på högsta nationella elitnivå och förfina moderna räddningsmetoder.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på landslagsnivå",
      description: "Siktar på specialistroll för landslagsmålvakter och internationell elithandboll.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "INTERNATIONAL",
      wageExpectationTier: "PREMIUM",
    },
  },
  PHYSICAL_COACH: {
    STABILITY: {
      label: "Trivs med truppens fys",
      description: "Trivs med truppens dagliga atletiska utveckling, styrkebyggnad och belastningsstyrning.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Söker större fysresurser",
      description: "Vill etablera modern fyskultur och prestationsutveckling i en resursstark förening.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på prestandachef",
      description: "Siktar på att leda fys- och prestandateam i Handbollsligan eller internationell toppklubb.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "INTERNATIONAL",
      wageExpectationTier: "PREMIUM",
    },
  },
  ANALYST: {
    STABILITY: {
      label: "Trivs med videoanalys",
      description: "Trivs med matchklippning, motståndarscouting och taktiska videogenomgångar för ledarstaben.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill utveckla data/video",
      description: "Vill utveckla datadriven och modern taktisk analys i en ambitiös elitklubb.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på chefsanalytiker",
      description: "Siktar på roll som chefsanalytiker i Handbollsligan eller utländsk toppklubb.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "INTERNATIONAL",
      wageExpectationTier: "PREMIUM",
    },
  },
  PHYSIO: {
    STABILITY: {
      label: "Trivs nära truppen",
      description: "Trivs nära truppen med daglig behandling, tejpning och rehabilitering av skador.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill utvecklas inom elitidrott",
      description: "Vill arbeta med elitidrottsmedicin och avancerad skadeprevention på högsta nivå.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Medicinskt ledaransvar",
      description: "Siktar på att leda klubbens medicinska team och skadepreventiva organisation.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "PREMIUM",
    },
  },
  SCOUT: {
    STABILITY: {
      label: "Trivs med lokal scouting",
      description: "Trivs med regional talangspaning och matchbevakning i närområdet.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill bygga större nätverk",
      description: "Vill utöka sitt scoutnätverk och bevaka nationella ungdomsturneringar och seniorserier.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på chefsscoutroll",
      description: "Siktar på roll som chefsscout eller rekryteringsansvarig på elitnivå.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "PREMIUM",
    },
  },
  SPORTING_DIRECTOR: {
    STABILITY: {
      label: "Förvaltar klubbens struktur",
      description: "Trivs med att förvalta klubbens sportsliga organisation och bygga långsiktig stabilitet.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill etablera klubben i toppen",
      description: "Vill ta klubben till en etablerad position i toppen av svensk handboll.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Internationell toppklubb",
      description: "Siktar på att leda en internationell elitklubb med europeiska titelambitioner.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "INTERNATIONAL",
      wageExpectationTier: "PREMIUM",
    },
  },
  TEAM_MANAGER: {
    STABILITY: {
      label: "Trivs med lagets rutiner",
      description: "Trivs med att sköta matchlogistik, material och rutiner kring laget.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill professionalisera driften",
      description: "Vill professionalisera lagets administrativa och praktiska matchmiljö.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på driftsansvar",
      description: "Siktar på samordnande chefsansvar för elitverksamhetens driftsorganisation.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
  },
  HEAD_OF_RECRUITMENT: {
    STABILITY: {
      label: "Trivs med spelarkartläggning",
      description: "Trivs med att kartlägga spelarmarknaden och stödja sportchef och tränarstab.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill bygga scoutingorganisation",
      description: "Vill bygga ett mer strukturerat nationellt rekryteringssystem.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på sportchefsroll",
      description: "Siktar på sportchefsroll i högsta serien eller utomlands.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "PREMIUM",
    },
  },
  HEAD_OF_ACADEMY: {
    STABILITY: {
      label: "Trivs i ungdomsverksamheten",
      description: "Trivs med att leda ungdomstränarna och utveckla den röda tråden i föreningen.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Vill bygga ledande akademi",
      description: "Vill utveckla en av landets ledande talangakademier för unga handbollsspelare.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Siktar på sportslig ledning",
      description: "Siktar på överordnad sportslig ledarroll på seniornivå eller förbundsuppdrag.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "INTERNATIONAL",
      wageExpectationTier: "PREMIUM",
    },
  },
  DEVELOPMENT_COACH: {
    STABILITY: {
      label: "Trivs med talangutveckling",
      description: "Trivs med individuell teknisk slipning och övergången mellan junior- och seniorhandboll.",
      leadershipDesire: "SUPPORT",
      prestigeDesire: "REGIONAL",
      wageExpectationTier: "MODEST",
    },
    PROGRESSION: {
      label: "Siktar mot representationslaget",
      description: "Vill ta större tränaransvar i representationslaget och utveckla elitspelare.",
      leadershipDesire: "DEPARTMENT_LEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "STANDARD",
    },
    HEAD_ROLE: {
      label: "Akademi- eller seniorroll",
      description: "Siktar på att bli akademichef eller ta klivet till huvudtränare för ett seniorlag.",
      leadershipDesire: "ORGANISATION_HEAD",
      prestigeDesire: "NATIONAL_ELITE",
      wageExpectationTier: "PREMIUM",
    },
  },
};

export function getStaffAmbitionProfile(staffId: string, role: StaffRole = "ASSISTANT_COACH"): StaffAmbitionProfile {
  const ambition = ambitionOf(staffId, role);
  const def = ROLE_AMBITION_DEFINITIONS[role]?.[ambition] ?? ROLE_AMBITION_DEFINITIONS.ASSISTANT_COACH[ambition];
  return {
    ambition,
    role,
    label: def.label,
    description: def.description,
    leadershipDesire: def.leadershipDesire,
    prestigeDesire: def.prestigeDesire,
    wageExpectationTier: def.wageExpectationTier,
  };
}

export function formatStaffAmbition(ambition: Ambition, role: StaffRole = "ASSISTANT_COACH"): string {
  const def = ROLE_AMBITION_DEFINITIONS[role]?.[ambition];
  return def ? def.label : AMBITION_LABEL[ambition];
}

export function staffAmbitionDescription(staffId: string, role: StaffRole = "ASSISTANT_COACH"): string {
  return getStaffAmbitionProfile(staffId, role).description;
}
