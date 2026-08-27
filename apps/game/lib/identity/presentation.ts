// HM-DATA-ALLSVENSKAN-1.2: the PRESENTATION LAYER between canonical
// identity data (types.ts/resolver.ts -- machine keys, enum values,
// evidence metadata, all UNCHANGED and untouched by this module) and
// normal-game-mode UI.
//
// Product principle this module exists to enforce:
//   DOMAIN / MACHINE DATA  ->  PRESENTATION LAYER  ->  PLAYER-FACING UI
// never
//   DOMAIN ENUM  ->  directly rendered text.
//
// `presentClaim(claim)` is the ONE function normal-game-mode UI should
// call to render an IdentityClaim -- it never mutates or re-derives the
// claim, only produces a natural Swedish sentence from its (key, value).
// Editor Mode/debug views may still read `claim.key`/`claim.value`/
// `claim.evidenceClass` directly; this module is additive, not a
// replacement for the canonical data.
import type { HMStaffRole, IdentityClaim } from "./types";

// ---------------------------------------------------------------------
// Shared intensity-scale vocabulary, reused across every key whose value
// is a simple qualitative level (STRONG/WEAK/HIGH/LOW/...). Kept as ONE
// table so every claim of this shape reads consistently, rather than
// re-inventing the adjective per key.
// ---------------------------------------------------------------------
const LEVEL_SV: Record<string, string> = {
  EXTREME: "extremt hög",
  VERY_HIGH: "mycket hög",
  HIGH: "hög",
  LOW_MODERATE: "låg till måttlig",
  MODERATE: "måttlig",
  LOW: "låg",
  VERY_LOW: "mycket låg",
  VERY_STRONG: "mycket stark",
  STRONG: "stark",
  BALANCED: "balanserad",
  WEAK: "svag",
  VERY_WEAK: "mycket svag",
};

function humanizeEnumFallback(raw: string): string {
  // Last-resort humanizer for a value this module hasn't been taught a
  // specific phrase for yet -- still never the raw SCREAMING_SNAKE_CASE
  // token, always at least lowercase, spaced, readable words.
  return raw.toLowerCase().replace(/_/g, " ");
}

function levelWord(value: string | number | boolean): string {
  const raw = String(value);
  return LEVEL_SV[raw] ?? humanizeEnumFallback(raw);
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function boolWord(value: string | number | boolean, whenTrue: string, whenFalse: string): string {
  return value === true || value === "True" || value === "true" ? whenTrue : whenFalse;
}

// ---------------------------------------------------------------------
// Keys whose value is a plain intensity level -- rendered generically as
// "{Swedish label}: {level}". This covers the majority of claims: the
// key alone already explains WHAT is being rated, so no bespoke sentence
// is needed, just a natural Swedish label for the key.
// ---------------------------------------------------------------------
const GENERIC_LEVEL_LABEL: Record<string, string> = {
  analyticalOrientation: "Analytisk inriktning",
  authorityWithVeterans: "Auktoritet gentemot rutinerade spelare",
  balkanYugoslavInfluence: "Balkan-/Jugoslavientraditionens inflytande",
  clubIdentification: "Klubbkänsla i spelartruppen",
  collectiveBuilding: "Kollektivt kulturbygge",
  collectiveOrientation: "Kollektiv lagkänsla",
  commitmentExtraction: "Förmåga att kräva engagemang",
  communityOrientation: "Förankring i föreningen/samhället",
  complexityPreference: "Preferens för komplexa spelsystem",
  currentDevelopmentSignal: "Aktuell utvecklingstrend",
  currentEliteYouthOutput: "Aktuellt elitungdomsutfall",
  decisionCentralisation: "Centralisering av beslut",
  defensiveCoaching: "Kvalitet i försvarsträning",
  defensivePerformance: "Försvarsprestation",
  defensivePhysicalityPreference: "Preferens för fysiskt försvarsspel",
  defensivePriority: "Prioritet på försvarsspel",
  developmentClubIdentity: "Identitet som utvecklingsklubb",
  developmentInfrastructure: "Utvecklingsinfrastruktur",
  developmentInvolvement: "Engagemang i spelarutveckling",
  entertainmentPhilosophy: "Underhållningsfilosofi i spelet",
  externalRecruitmentDependency: "Beroende av extern rekrytering",
  formationDogmatism: "Fasthet vid en enskild formation",
  formationVersatility: "Formationsflexibilitet",
  historicalDevelopmentClub: "Historisk status som utvecklingsklubb",
  historicalReputation: "Historiskt anseende",
  historicalYouthReputation: "Historiskt ungdomsrykte",
  homeDifficulty: "Svårighet att möta laget på hemmaplan",
  homeSupport: "Hemmapublikens stöd",
  interventionBoldness: "Mod att göra taktiska ingripanden",
  keyPositionStaffContinuity: "Kontinuitet i nyckelroller i tränarstaben",
  matchRiskTolerance: "Risktolerans i matchsituationer",
  oneVOneReliance: "Beroende av 1-mot-1-spel",
  overZoneOrientation: "Inriktning mot spel i överzonen",
  overcomplicationRisk: "Risk för överkomplicerat spel",
  playerAutonomy: "Spelarnas eget ansvar på planen",
  playerDemands: "Krav som ställs på spelarna",
  positionalTempo: "Tempo i positionsanfall",
  prescriptiveCoaching: "Detaljstyrning från tränarstaben",
  relationshipWithYoungPlayers: "Relation till unga spelare",
  riskAppetite: "Riskaptit",
  roleClarity: "Tydlighet i roller",
  rotationBreadth: "Bredd i spelarrotationen",
  squadContinuity: "Truppkontinuitet",
  staffDelegation: "Delegering inom tränarstaben",
  systemDogmatism: "Fasthet vid ett enskilt spelsystem",
  tacticalCompetence: "Taktisk kompetens hos tränaren",
  tacticalFlexibility: "Taktisk flexibilitet",
  tacticalStrength: "Taktisk styrka",
  teamBuilding: "Lagbygge",
  traditionalHandballInfluence: "Inflytande från traditionellt handbollsarv",
  transitionCoaching: "Kvalitet i omställningsträning",
  transitionIdentity: "Identitet i omställningsspel",
  willingnessToChangeStructure: "Vilja att förändra strukturen",
  youngPlayerRecruitment: "Rekrytering av unga spelare",
  youthBreadth: "Bredd i ungdomsverksamheten",
  youthInvestment: "Investering i ungdomsverksamhet",
  youthPathwayOrientation: "Inriktning på väg från ungdom till a-lag",
  youthSeniorPathwayImportance: "Vikt av väg från ungdom till seniorlag",
  youthPipeline: "Ungdomsproduktion",
};

// ---------------------------------------------------------------------
// Custom formatters -- keys whose value needs a bespoke sentence rather
// than the generic "{label}: {level}" pattern (a different verb per
// value, a literal formation code, a governance description, a
// season-specific fact, a boolean, ...).
// ---------------------------------------------------------------------
type ClaimFormatter = (value: string | number | boolean) => string;

const SEVEN_V_SIX_FREQUENCY_SV: Record<string, string> = {
  EXTREME: "mycket ofta",
  VERY_HIGH: "mycket ofta",
  HIGH: "ofta",
  MODERATE: "ibland",
  LOW: "sällan",
  VERY_LOW: "mycket sällan",
  VERY_LOW_NEAR_ZERO: "nästan aldrig",
};

const CUSTOM: Record<string, ClaimFormatter> = {
  sevenVSixFrequency: (v) => `7 mot 6: Används ${SEVEN_V_SIX_FREQUENCY_SV[String(v)] ?? humanizeEnumFallback(String(v))}`,
  sevenVSixUsage: (v) => `7 mot 6: Används ${SEVEN_V_SIX_FREQUENCY_SV[String(v)] ?? humanizeEnumFallback(String(v))}`,
  sevenVSixDependency: (v) => `7 mot 6: Laget är ${levelWord(v)}t beroende av taktiken`,
  sevenVSixWillingness: (v) => {
    const table: Record<string, string> = {
      EXTREME: "mycket positivt inställd till att använda det",
      HIGH: "positivt inställd till att använda det",
      POSITIVE_WILL_USE: "villig att använda det",
      EXPECTED_NOT_AVERSE: "inte motståndare till att använda det, om än ännu oprövat",
    };
    return `7 mot 6: Tränaren är ${table[String(v)] ?? humanizeEnumFallback(String(v))}`;
  },
  sevenVSixPreference: (v) => {
    const table: Record<string, string> = {
      EXTREMELY_LOW_OPPOSED: "starkt emot att använda det",
      VERY_LOW_AVOIDS: "undviker det i det närmaste helt",
    };
    return `7 mot 6: Tränaren är ${table[String(v)] ?? humanizeEnumFallback(String(v))}`;
  },

  primaryFormation: (v) => `Grundformation i försvar: ${v}`,
  alternativeFormation: (v) => `Alternativ formation: ${v}`,
  alternativeFormations: (v) => `Alternativa formationer: ${v}`,
  projected2026_27Formation: (v) => `Planerad formation 2026/27: ${v}`,
  systemBreadth: () => "Använder flera olika spelsystem, inte låst vid ett enda",
  systemRepertoire: (v) => `Repertoar av spelsystem: ${levelWord(v)}`,
  backcourtOrientation: () => "Stort fokus på mittbacken i överzonen",
  m6ArchetypePreference: () => "Föredrar en liten, teknisk och rörlig mittsexa",
  rullespelAsPrimaryWeapon: () => "Rullande anfallsspel (rullespel) är lagets främsta offensiva vapen",
  goalkeeperLinkedShotSteering: (v) => boolWord(v, "Försvaret styr medvetet motståndarnas skott mot målvaktens styrkor", "Ingen medveten koppling mellan försvar och målvaktens styrkor"),

  financialStrength: (v) => {
    const table: Record<string, string> = {
      BALANCED_AVERAGE: "Balanserad ekonomi, ungefär i nivå med genomsnittet i Allsvenskan",
      LONG_TERM_CONSTRAINED: "Långsiktigt ansträngd ekonomi",
      LOW_RESOURCES_BALANCED_DISCIPLINED: "Begränsade resurser, men skött med disciplin",
      RECENT_STRESS_STABILIZED: "Nyligen ekonomiskt pressad, nu stabiliserad",
      SEVERE_PRESSURE: "Under kraftig ekonomisk press",
      VERY_STRONG_FOR_ALLSVENSKAN: "Mycket stark ekonomi för att vara en Allsvenskan-klubb",
      WEAK: "Svag ekonomi",
    };
    return `Ekonomisk ställning: ${table[String(v)] ?? humanizeEnumFallback(String(v))}`;
  },
  underlyingFinancialStrength: () => "Underliggande ekonomi: långsiktigt ansträngd",
  exceptionalPlayerFunding: () => "En enskild stjärnspelares kontrakt finansieras separat, utanför klubbens ordinarie ekonomi",

  sportingGovernance: (v) => {
    const table: Record<string, string> = {
      COMMITTEE: "Sportsliga beslut fattas av en kommitté, inte av en enskild sportchef",
      DISTRIBUTED_SPORT_COMMITTEE: "Sportsliga beslut är fördelade inom en sportgrupp",
      SPORTING_DIRECTOR_HIGH_PROXIMITY: "En sportchef med nära insyn i truppen leder sportsliga beslut",
    };
    return table[String(v)] ?? humanizeEnumFallback(String(v));
  },
  sportingDirectorResourcing: () => "Sportchefsrollen är klubbens första i sitt slag och sköts ideellt, utan lön",
  sportingModel: () => "Sportslig modell byggd på spelarutveckling och vidareförsäljning",

  leagueStatus2026_27: (v) => {
    const table: Record<string, string> = {
      NEWLY_PROMOTED: "Nyuppflyttad till Allsvenskan inför 2026/27",
      PROMOTION_FAVOURITE: "Tippad som favorit för uppflyttning 2026/27",
      RELEGATED_FROM_HANDBOLLSLIGAN: "Nedflyttad från Handbollsligan inför 2026/27",
    };
    return table[String(v)] ?? humanizeEnumFallback(String(v));
  },
  season2026_27Objective: () => "Målsättning 2026/27: etablera sig i Allsvenskan",
  squadAgeOrientation2026_27: () => "Ung trupp med hög utvecklingspotential inför 2026/27",
  squadContinuity2026_27: () => "Stor omställning inför 2026/27, minskande andel rutinerade spelare kvar",
  squadDepth2026_27: () => "Liten trupp med låg bredd, byggd kring en erfaren kärna",
  youthOrientation2026_27: () => "Mycket stark och växande ungdomsinriktning inför 2026/27",
  organisationalPhase: (v) => {
    const table: Record<string, string> = {
      GROWTH_PROFESSIONALISATION: "Klubben genomgår tillväxt och professionalisering",
      REBUILD_RESTART: "Klubben återuppbygger och startar om",
    };
    return table[String(v)] ?? humanizeEnumFallback(String(v));
  },
  clubTrajectory: () => "Nedåtgående trend som nu vänder uppåt igen",
  clubModelContinuity: () => "Hög kontinuitet i klubbmodellen trots ny tränare",
  clubWealthVsRecruitmentIntelligence: () => "Klubbens rekrytering presterar bättre än vad dess ekonomiska styrka ensam skulle antyda",

  aTeamDevelopmentPathway: () => "Mycket stark strukturell koppling mellan ungdomsverksamheten och a-laget",
  buyLowOrientation: () => "Mycket hög prioritet på att köpa lågt värderade spelare",
  currentYouthPipeline: () => "Svag och minskande ungdomsproduktion just nu",
  genuineDevelopmentClub: (v) => boolWord(v, "Betraktas som en genuin utvecklingsklubb", "Betraktas inte primärt som en utvecklingsklubb"),
  homegrownShareTarget: (v) => `Mål: minst ${String(v).replace(/^>=/, "")} egenutbildade spelare i truppen`,
  ownPlayerPathway: () => "Aktiv satsning på egen spelarväg till a-laget",
  ownPlayerPhilosophy: () => "Mycket stark, uttalad filosofi om att satsa på egna spelare",
  recruitmentAgePreference: () => "Föredrar att rekrytera unga spelare",
  regionalOrientation: () => "Mycket starkt fokus på Stockholmsregionen i rekryteringen",
  regionalTalentPoolAccess: () => "Ser en strategisk möjlighet i talangbasen i Storgöteborg",
  playerProfilePreference: () => "Föredrar mindre, snabba och spelförståeliga spelarprofiler",

  paraHandballIntegration: () => "Etablerad parahandbollsverksamhet inom klubben",
  previousEnkopingPerformance: () => "Starkt positivt resultat i tidigare tränaruppdrag",
  fullTacticalProfileEvidence: () => "Otillräckligt underlag för en fullständig taktisk profil ännu -- ny tränare",
  careerStage: () => "Tidig karriärfas, tränare på frammarsch",

  staffTacticalCentralisation: (v) => {
    const table: Record<string, string> = {
      EXTREME_AROUND_HEAD_COACH: "Huvudtränaren har mycket stort taktiskt inflytande",
    };
    return `Beslutsfattande: ${table[String(v)] ?? humanizeEnumFallback(String(v))}`;
  },
};

// ---------------------------------------------------------------------
// HM_STAFF_ROLES (the broad, 20-value governance/coaching vocabulary
// lib/identity/types.ts defines) -- a real staff assignment's
// `standardRoles` must never be rendered as raw SCREAMING_SNAKE_CASE
// codes in normal game mode either (same principle as presentClaim).
// ---------------------------------------------------------------------
const HM_STAFF_ROLE_LABEL_SV: Record<HMStaffRole, string> = {
  CHAIRPERSON: "Ordförande",
  CLUB_DIRECTOR: "Klubbchef",
  SPORTING_DIRECTOR: "Sportchef",
  SENIOR_DIRECTOR: "Direktör",
  ELITE_DIRECTOR: "Elitverksamhetschef",
  HEAD_COACH: "Huvudtränare",
  ASSISTANT_COACH: "Assisterande tränare",
  COACH: "Tränare",
  GOALKEEPER_COACH: "Målvaktstränare",
  STRENGTH_CONDITIONING_COACH: "Fystränare",
  PHYSIOTHERAPIST: "Fysioterapeut",
  DOCTOR: "Läkare",
  PERFORMANCE_STAFF: "Prestationsstaben",
  TEAM_MANAGER: "Lagledare",
  TEAM_ADMIN: "Administratör",
  EQUIPMENT_MANAGER: "Materialansvarig",
  ANALYST: "Analytiker",
  SCOUT: "Scout",
  OTHER: "Övrig roll",
  ACTIVE_PLAYER: "Aktiv spelare",
};

/** Renders one, several, or a combination of HM_STAFF_ROLES values as natural Swedish, never the raw enum. */
export function presentStaffRoles(roles: readonly HMStaffRole[]): string {
  if (roles.length === 0) return "—";
  return roles.map((r) => HM_STAFF_ROLE_LABEL_SV[r] ?? humanizeEnumFallback(r)).join(" + ");
}

/**
 * Renders one IdentityClaim as a single, natural Swedish sentence for
 * normal-game-mode UI. Never mutates/reads back into the claim; the
 * canonical (key, value, evidenceClass, ...) stays exactly as loaded.
 * Every claim in the current 14-club Allsvenskan dataset resolves
 * through either a bespoke CUSTOM formatter or the GENERIC_LEVEL
 * pattern -- the raw-enum humanizer is a safety net for a future claim
 * this module hasn't been taught yet, not the expected path today.
 */
export function presentClaim(claim: IdentityClaim): string {
  const custom = CUSTOM[claim.key];
  if (custom) return custom(claim.value);

  const genericLabel = GENERIC_LEVEL_LABEL[claim.key];
  if (genericLabel) return `${genericLabel}: ${capitalize(levelWord(claim.value))}`;

  // Safety net: still never the raw camelCase key or SCREAMING_SNAKE
  // value verbatim, even for a key this module doesn't know about yet.
  const fallbackLabel = claim.key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  return `${capitalize(fallbackLabel)}: ${humanizeEnumFallback(String(claim.value))}`;
}
