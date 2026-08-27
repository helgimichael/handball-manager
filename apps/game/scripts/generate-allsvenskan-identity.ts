// HM-DATA-ALLSVENSKAN-1.0: one-off, offline data-authoring script --
// generates the 14 Allsvenskan clubs' real-world identity/staff/coach
// JSON files from the approved CLUB IDENTITY v0.1 DOCX source profiles
// (already read/extracted; this script encodes that extraction into
// the exact lib/identity schema). Run once with `npx tsx
// scripts/generate-allsvenskan-identity.ts`, never at runtime -- mirrors
// the same "generated offline, read as static JSON" precedent
// staffIdentityLoader.ts documents for the Handbollsligan set. Not part
// of the app's own build/test graph.
import fs from "node:fs";
import path from "node:path";

const OUT_ROOT = path.join(__dirname, "..", "..", "..", "data", "real-world", "sweden", "2026-27", "allsvenskan", "identity");

type EvidenceClass =
  | "VERIFIED_EXTERNAL_DATA"
  | "VERIFIED_EXTERNAL_CLUB_STRATEGY"
  | "VERIFIED_EXTERNAL_CLUB_STATEMENT"
  | "USER_EXPERT_ASSESSMENT"
  | "USER_EXPERT_REQUIRES_VERIFICATION"
  | "USER_PROJECTION"
  | "INFERENCE";
type TemporalScope = "LONG_TERM" | "HISTORICAL" | "CURRENT" | "PROJECTED";
type ClaimField = "structuralIdentity" | "cultureIdentity" | "tacticalHeritage" | "developmentIdentity" | "recruitmentIdentity" | "financialStrategicIdentity" | "supporterEnvironmentIdentity";
type HMStaffRole =
  | "CHAIRPERSON" | "CLUB_DIRECTOR" | "SPORTING_DIRECTOR" | "HEAD_COACH" | "ASSISTANT_COACH" | "COACH" | "GOALKEEPER_COACH"
  | "STRENGTH_CONDITIONING_COACH" | "PHYSIOTHERAPIST" | "DOCTOR" | "TEAM_MANAGER" | "TEAM_ADMIN" | "EQUIPMENT_MANAGER" | "ANALYST" | "SCOUT" | "OTHER";

interface ClaimSpec {
  field: ClaimField;
  domain: string;
  key: string;
  value: string | number | boolean;
  ev: EvidenceClass;
  temporal: TemporalScope;
  notes?: string;
}
interface StaffSpec {
  name: string;
  officialRole: string;
  standardRoles: HMStaffRole[];
  status?: "CONFIRMED" | "PROBABLE" | "HISTORICAL";
  personKind?: "COLLECTIVE_GROUP";
}
interface CoachClaimSpec {
  field: "coachingStyleClaims" | "tacticalPreferenceClaims" | "communicationLeadershipClaims" | "developmentClaims" | "adaptabilityClaims" | "cultureBuildingClaims";
  domain: string;
  key: string;
  value: string | number | boolean;
  ev: EvidenceClass;
  temporal: TemporalScope;
}
interface ClubSpec {
  clubId: string;
  sourceDoc: string;
  staff: StaffSpec[];
  claims: ClaimSpec[];
  /** Name of the staff person (must match a `staff` entry) this coach profile belongs to -- links coach file to the HEAD_COACH assignment. */
  coachOf?: string;
  coachClaims?: CoachClaimSpec[];
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (å/ä/ö/é/á -> a/a/o/e/a, etc.)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function personId(name: string, clubId: string): string {
  return `person-${slug(name)}-${slug(clubId)}`;
}

const clubs: ClubSpec[] = [
  // ---------------------------------------------------------------- Guif
  {
    clubId: "swe2-guif",
    sourceDoc: "Eskilstuna Guif IF CLUB IDENTITY v0.1",
    staff: [
      { name: "Stephan Eriksson", officialRole: "Tillförordnad ordförande", standardRoles: ["CHAIRPERSON"] },
      { name: "Ludwig Krontorp", officialRole: "Klubbchef", standardRoles: ["CLUB_DIRECTOR"] },
      { name: "Jesper Nielsen", officialRole: "Sportchef Herr/Dam", standardRoles: ["SPORTING_DIRECTOR"] },
      { name: "Stefan Karlsson", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Mikael Löfstedt Johansson", officialRole: "Assisterande tränare", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Richard Larsson", officialRole: "Målvaktstränare", standardRoles: ["GOALKEEPER_COACH"] },
      { name: "Gunnar Lögdahl", officialRole: "Fystränare", standardRoles: ["STRENGTH_CONDITIONING_COACH"] },
      { name: "Mats Johansson", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Jonas Andreasson", officialRole: "Fysioterapeut", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Peter Skog", officialRole: "Fysioterapeut", standardRoles: ["PHYSIOTHERAPIST"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "6:0", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "alternativeFormations", value: "5:1, 3:2:1, situational 4:2", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "formationVersatility", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "ATTACK", key: "overZoneOrientation", value: "STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "TRANSITION", key: "transitionIdentity", value: "STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthPathwayOrientation", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "playerProfilePreference", value: "SMALLER_QUICK_INTELLIGENT", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "SEVERE_PRESSURE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "2026 rebuild/restart after previous economic turbulence; squad construction visibly constrained." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "organisationalPhase", value: "REBUILD_RESTART", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
    ],
    coachOf: "Stefan Karlsson",
    coachClaims: [
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "matchRiskTolerance", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "interventionBoldness", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "adaptabilityClaims", domain: "TACTICAL_COGNITIVE", key: "willingnessToChangeStructure", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------- Kroppskultur
  {
    clubId: "swe2-kroppskultur",
    sourceDoc: "GF Kroppskultur CLUB IDENTITY v0.1",
    staff: [
      { name: "Svante Olsson", officialRole: "Ordförande", standardRoles: ["CHAIRPERSON"] },
      { name: "Robin Malm", officialRole: "Vice ordförande", standardRoles: ["OTHER"] },
      { name: "Joakim Eriksson", officialRole: "Styrelseledamot / Sportchef", standardRoles: ["SPORTING_DIRECTOR"] },
      { name: "Micael Bratt", officialRole: "Klubbchef", standardRoles: ["CLUB_DIRECTOR"] },
      { name: "Filip Pettersson", officialRole: "Spelarrekrytering/scouting", standardRoles: ["SCOUT"] },
      { name: "Pontus Ward Wiklund", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Phillip Karlefeldt", officialRole: "Assisterande tränare", standardRoles: ["ASSISTANT_COACH"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "6:0", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Heavy central defenders, high aggressive 2-defenders." },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "sevenVSixUsage", value: "VERY_LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthInvestment", value: "VERY_STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "developmentClubIdentity", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM", notes: "Combines internal development with recruitment of young players for further progression." },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "youngPlayerRecruitment", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "organisationalPhase", value: "GROWTH_PROFESSIONALISATION", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
      { field: "cultureIdentity", domain: "SQUAD_COMPOSITION", key: "squadDepth2026_27", value: "LOW_SMALL_EXPERIENCED_CORE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Current squad state, deliberately not permanent club philosophy." },
    ],
    coachOf: "Pontus Ward Wiklund",
    coachClaims: [
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "analyticalOrientation", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "developmentClaims", domain: "DEVELOPMENT", key: "developmentInvolvement", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "sevenVSixPreference", value: "VERY_LOW_AVOIDS", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- H43 Lund
  {
    clubId: "swe2-h43lund",
    sourceDoc: "H43 Lund HF CLUB IDENTITY v0.1",
    staff: [
      { name: "Per Albin Borhammar", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Patrik Åsvärd", officialRole: "Tränarstab (roll ej specificerad)", standardRoles: ["COACH"] },
      { name: "Jonathan Hall", officialRole: "Tränarstab (roll ej specificerad)", standardRoles: ["COACH"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "6:0", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "alternativeFormation", value: "5:1", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "ATTACK", key: "rullespelAsPrimaryWeapon", value: "PRIMARY_OFFENSIVE_WEAPON", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Release ball -> move defence -> next player attacks -> continue rullespel. Simple, high execution quality." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "communityOrientation", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthBreadth", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "cultureIdentity", domain: "CULTURE", key: "collectiveOrientation", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Low star dependency; strength lies in execution quality rather than tactical complexity." },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "RECENT_STRESS_STABILIZED", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT", notes: "Publicly communicated 2026 liquidity challenges, subsequently stabilized." },
    ],
    coachOf: "Per Albin Borhammar",
    coachClaims: [
      { field: "cultureBuildingClaims", domain: "CULTURE", key: "collectiveBuilding", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "complexityPreference", value: "LOW_MODERATE", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "roleClarity", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- Aranäs
  {
    clubId: "swe2-aranas",
    sourceDoc: "HK Aranäs CLUB IDENTITY v0.1",
    staff: [{ name: "Carlos Martin Santos", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] }],
    claims: [
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "3:3", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "3:3 assessed as a club-policy element, belongs to Club Tactical Identity, not only the current senior team." },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "projected2026_27Formation", value: "3:3", ev: "USER_PROJECTION", temporal: "PROJECTED", notes: "High probability projection under new head coach." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthBreadth", value: "VERY_STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "genuineDevelopmentClub", value: true, ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Treated as a genuine development club, not merely a club with many youth teams." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "paraHandballIntegration", value: "ESTABLISHED", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "cultureIdentity", domain: "SQUAD_COMPOSITION", key: "squadAgeOrientation2026_27", value: "YOUNG_HIGH_UPSIDE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
    ],
    coachOf: "Carlos Martin Santos",
    coachClaims: [
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "sevenVSixWillingness", value: "EXPECTED_NOT_AVERSE", ev: "USER_PROJECTION", temporal: "PROJECTED" },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "fullTacticalProfileEvidence", value: "INSUFFICIENT_EVIDENCE_NEW_COACH", ev: "USER_EXPERT_REQUIRES_VERIFICATION", temporal: "CURRENT", notes: "Biographical details (age, nationality, prior Iceland coaching) treated as expert-source data pending separate external verification." },
    ],
  },
  // ---------------------------------------------------------------- Drott Halmstad
  {
    clubId: "swe2-drott",
    sourceDoc: "HK Drott Halmstad CLUB IDENTITY v0.1",
    staff: [
      { name: "Bengt Carlsson", officialRole: "Ordförande", standardRoles: ["CHAIRPERSON"] },
      { name: "Claes Andersson", officialRole: "Klubbchef", standardRoles: ["CLUB_DIRECTOR"] },
      { name: "Drott Sportkommitté", officialRole: "Sportkommitté", standardRoles: ["SPORTING_DIRECTOR"], personKind: "COLLECTIVE_GROUP" },
      { name: "Håkan Hallberg", officialRole: "Vice ordförande / Sportkommittén", standardRoles: ["OTHER"] },
      { name: "Johan Jedborg", officialRole: "Ledamot / Sportkommittén", standardRoles: ["OTHER"] },
      { name: "Göran Almén", officialRole: "Marknadsansvarig", standardRoles: ["OTHER"] },
      { name: "David Löfgren", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Johan Gustafsson", officialRole: "Målvaktstränare", standardRoles: ["GOALKEEPER_COACH"] },
      { name: "Dennis Suoraniemi", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Alicia Hataichanok Johansson", officialRole: "Idrottsmassör / Mindsetcoach", standardRoles: ["PHYSIOTHERAPIST"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "TACTICAL_FLEXIBILITY", key: "formationDogmatism", value: "LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Willingness to change defensive structure and use offensive defence when required to win, rather than a fixed primary formation." },
      { field: "tacticalHeritage", domain: "TACTICAL_FLEXIBILITY", key: "sevenVSixWillingness", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "High willingness does not mean high frequency." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "historicalDevelopmentClub", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "HISTORICAL" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthOrientation2026_27", value: "VERY_STRONG_INCREASING", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "LONG_TERM_CONSTRAINED", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Difficult economic conditions for roughly a decade; youth-oriented squad strategy assessed partly as a response." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "sportingGovernance", value: "DISTRIBUTED_SPORT_COMMITTEE", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT", notes: "Sportkommittén is explicitly treated as the sporting-director function, never an invented individual sporting director." },
    ],
    coachOf: "David Löfgren",
    coachClaims: [
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "authorityWithVeterans", value: "WEAK", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "relationshipWithYoungPlayers", value: "STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "tacticalStrength", value: "WEAK", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "A club can have a tradition of tactical pragmatism/flexibility while the current head coach is tactically weak -- kept distinct from Club Tactical Identity." },
    ],
  },
  // ---------------------------------------------------------------- Torslanda
  {
    clubId: "swe2-torslanda",
    sourceDoc: "HK Torslanda Elit CLUB IDENTITY v0.1",
    staff: [
      { name: "Tommy Atterhäll", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Sebastian Wiik", officialRole: "Tränare", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Nikolas Alektoridis", officialRole: "Fystränare/fysiolog", standardRoles: ["STRENGTH_CONDITIONING_COACH"] },
      { name: "Malin Fors", officialRole: "Massör", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Peter Neuwirth", officialRole: "Materialansvarig", standardRoles: ["EQUIPMENT_MANAGER"] },
      { name: "Ralf Carlson", officialRole: "Materialansvarig", standardRoles: ["EQUIPMENT_MANAGER"] },
    ],
    claims: [
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthBreadth", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "ownPlayerPathway", value: "ACTIVE", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM", notes: "Documented example: player progressing from handbollskul to the senior men's team." },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "m6ArchetypePreference", value: "SMALL_TECHNICAL_MOBILE", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "cultureIdentity", domain: "SUPPORTER_ENVIRONMENT", key: "homeDifficulty", value: "STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Assessed as a difficult opponent at home; cause not decomposed in v0.1." },
    ],
    coachOf: "Tommy Atterhäll",
    coachClaims: [
      { field: "tacticalPreferenceClaims", domain: "TRANSITION", key: "transitionCoaching", value: "VERY_STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Clearest coaching signature: getting players to run and sustaining aggressive tempo." },
      { field: "coachingStyleClaims", domain: "DEFENCE", key: "defensiveCoaching", value: "WEAK", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "sevenVSixWillingness", value: "POSITIVE_WILL_USE", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- Varberg
  {
    clubId: "swe2-varberg",
    sourceDoc: "HK Varberg CLUB IDENTITY v0.1",
    staff: [
      { name: "Ulf Sivertsson", officialRole: "Tränare", standardRoles: ["HEAD_COACH"] },
      { name: "Eric Deliaune Aronius", officialRole: "Assisterande tränare", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Roger Jonasson", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Conny Karlsing", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "6:0", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Very physical, boundary-pushing." },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "goalkeeperLinkedShotSteering", value: true, ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Defence willing to concede wing/wide-Y9 shots because the current goalkeeper is particularly strong there -- a working rule (Goalkeeper Capability -> Defensive Working Rule -> Opponent Shot Distribution), not just a high goalkeeper rating." },
      { field: "tacticalHeritage", domain: "ATTACK", key: "backcourtOrientation", value: "LARGE_M9_OVER_ZONE", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthBreadth", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "VERY_STRONG_FOR_ALLSVENSKAN", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Approximately comparable to a mid-table Handbollsligan club; exact figures belong to the Club Economy model, not this claim." },
      { field: "supporterEnvironmentIdentity", domain: "SUPPORTER_ENVIRONMENT", key: "homeSupport", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "leagueStatus2026_27", value: "PROMOTION_FAVOURITE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
    ],
    coachOf: "Ulf Sivertsson",
    coachClaims: [
      { field: "cultureBuildingClaims", domain: "CULTURE", key: "teamBuilding", value: "VERY_STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Clearest signature: getting a squad to perform strongly together." },
      { field: "coachingStyleClaims", domain: "DEFENCE", key: "defensivePhysicalityPreference", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- Huddinge
  {
    clubId: "swe2-huddinge",
    sourceDoc: "Huddinge HK CLUB IDENTITY v0.1",
    staff: [
      { name: "Helen Edlund", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Johan Cassebaum", officialRole: "Coach", standardRoles: ["COACH"] },
      { name: "Johan Eklund", officialRole: "Coach / videoanalys", standardRoles: ["COACH", "ANALYST"] },
      { name: "Oscar Johansson", officialRole: "Coach", standardRoles: ["COACH"] },
      { name: "Fredrik Green", officialRole: "Assisterande / Herr U-junioransvar", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Stefan Strömberg", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Walter Cassebaum", officialRole: "Administration/material", standardRoles: ["TEAM_ADMIN"] },
      { name: "Johnny Ejderskog", officialRole: "Sportansvar herr", standardRoles: ["SPORTING_DIRECTOR"] },
      { name: "Nathalie Skogäng", officialRole: "Fysioterapeut", standardRoles: ["PHYSIOTHERAPIST"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "TACTICAL_FLEXIBILITY", key: "systemDogmatism", value: "VERY_LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Plays primarily according to the qualities of the available squad rather than maintaining a strong permanent identity." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "aTeamDevelopmentPathway", value: "VERY_STRONG_STRUCTURAL_CONNECTION", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "leagueStatus2026_27", value: "NEWLY_PROMOTED", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "season2026_27Objective", value: "ESTABLISH_IN_ALLSVENSKAN", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "riskAppetite", value: "LOW_CAUTIOUS", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
      { field: "cultureIdentity", domain: "SQUAD_COMPOSITION", key: "squadContinuity2026_27", value: "MAJOR_TRANSITION_DECLINING_VETERAN_CONTINUITY", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Correction of an earlier external continuity signal -- the more specific, current expert assessment indicates substantial squad change; rapid promotion trajectory must not automatically imply high current team strength." },
    ],
    coachOf: "Helen Edlund",
    coachClaims: [
      { field: "adaptabilityClaims", domain: "TACTICAL_COGNITIVE", key: "playerAutonomy", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Highly delegating -- gives players substantial decision responsibility rather than prescribing a coach-controlled model. Low tactical control is not evidence of low tactical knowledge." },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "prescriptiveCoaching", value: "LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- Tumba
  {
    clubId: "swe2-tumba",
    sourceDoc: "IFK Tumba HK CLUB IDENTITY v0.1",
    staff: [
      { name: "Mats Kardell", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Helgi Magnusson", officialRole: "Assisterande tränare / Analys / Utveckling", standardRoles: ["ASSISTANT_COACH", "ANALYST"] },
      { name: "Malin Kardell", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Marie Hellkvist", officialRole: "Materialansvarig / Lagledare", standardRoles: ["TEAM_MANAGER", "EQUIPMENT_MANAGER"] },
      { name: "Samir Svedin", officialRole: "Materialansvarig / Lagledare", standardRoles: ["TEAM_MANAGER", "EQUIPMENT_MANAGER"] },
      { name: "Naman Raja Gul", officialRole: "Sportchef", standardRoles: ["SPORTING_DIRECTOR"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "ATTACK", key: "sevenVSixDependency", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Estimated ~90% usage (insider estimate, needs match-data calibration) -- among the most extreme 7v6 identities in the league." },
      { field: "tacticalHeritage", domain: "ATTACK", key: "positionalTempo", value: "LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "6:0", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Working rule: the 2 defenders frequently break inward toward M9 while the central 3 maintain a more defensive/deep orientation." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthPipeline", value: "VERY_STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthSeniorPathwayImportance", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Limited club finances increase the strategic importance of internal player production." },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "regionalOrientation", value: "VERY_HIGH_STOCKHOLM", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "WEAK", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "keyPositionStaffContinuity", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Key positions and coaching staff enter approximately their third season together." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "sportingDirectorResourcing", value: "ZERO_COST_NON_SALARIED_FIRST_ROLE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Job title != staff quality != professionalisation != financial investment -- organisational professionalisation must never be inferred from title alone." },
    ],
    coachOf: "Mats Kardell",
    coachClaims: [
      { field: "cultureBuildingClaims", domain: "CULTURE", key: "clubIdentification", value: "EXTREME", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "commitmentExtraction", value: "VERY_STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "sevenVSixWillingness", value: "EXTREME", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "adaptabilityClaims", domain: "TACTICAL_COGNITIVE", key: "tacticalFlexibility", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- Ystad
  {
    clubId: "swe2-ystad2",
    sourceDoc: "IFK Ystad HK CLUB IDENTITY v0.1",
    staff: [
      { name: "Fredrik Petersen", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Henrik Knudsen", officialRole: "Assisterande tränare", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Mats Kleman", officialRole: "Analys", standardRoles: ["ANALYST"] },
      { name: "Leif Wedberg", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Caroline Hansson", officialRole: "Massör", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Freddy Johnstone", officialRole: "Sjukgymnast", standardRoles: ["PHYSIOTHERAPIST"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "TACTICAL_FLEXIBILITY", key: "systemBreadth", value: "NOT_FIXED_MULTIPLE_SYSTEMS", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "currentDevelopmentSignal", value: "STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT", notes: "Lowe Knutsson development outcome cited as a strong current example." },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "underlyingFinancialStrength", value: "CONSTRAINED_LONG_TERM", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Not among the wealthiest Herrallsvenskan clubs -- normal spending power not high." },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "exceptionalPlayerFunding", value: "RING_FENCED_EXTERNAL", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT", notes: "Jim Gottfridsson's 3-year return is an externally/ring-fenced-funded transformative squad event, not proof the club's underlying economy moved to Handbollsligan-top level -- must never inherit a permanently higher wage budget merely because the contract exists." },
      { field: "cultureIdentity", domain: "SQUAD_COMPOSITION", key: "rotationBreadth", value: "LOW_VERY_HIGH_CORE_RELIANCE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
    ],
    coachOf: "Fredrik Petersen",
    coachClaims: [
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_FLEXIBILITY", key: "systemRepertoire", value: "VERY_BROAD", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "playerDemands", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "overcomplicationRisk", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Highly flexible but the team can at times make the game more complicated than necessary." },
    ],
  },
  // ---------------------------------------------------------------- Kungälv
  {
    clubId: "swe2-kungalv",
    sourceDoc: "Kungälvs HK CLUB IDENTITY v0.1",
    staff: [
      { name: "Maher El Aaraj", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Tobias Johansson", officialRole: "Assisterande tränare", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Hannes Boström", officialRole: "Massör / fysioterapeut", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Markus Börjesson Grahn", officialRole: "Materialansvarig", standardRoles: ["EQUIPMENT_MANAGER"] },
      { name: "Annika Pennebratt", officialRole: "Lagledare / admin", standardRoles: ["TEAM_MANAGER"] },
    ],
    claims: [
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "historicalYouthReputation", value: "STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "HISTORICAL" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "currentYouthPipeline", value: "WEAK_DECLINING", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Historical reputation vs current output must be kept separate -- do not let reputation generate unrealistically strong current academy output." },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "externalRecruitmentDependency", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "regionalTalentPoolAccess", value: "STRATEGIC_OPPORTUNITY_GREATER_GOTHENBURG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "BALANCED_AVERAGE", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Neither a financially powerful Allsvenskan club nor in acute financial distress -- a useful calibration baseline." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "clubTrajectory", value: "DECLINING_RECOVERING", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "One men's-team promotion is not proof the club's underlying structural trajectory has fully reversed." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "leagueStatus2026_27", value: "NEWLY_PROMOTED", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
    ],
  },
  // ---------------------------------------------------------------- Redbergslid
  {
    clubId: "swe2-redbergslid",
    sourceDoc: "Redbergslids IK CLUB IDENTITY v0.1",
    staff: [
      { name: "RIK Sportkommitté", officialRole: "Sportkommitté", standardRoles: ["SPORTING_DIRECTOR"], personKind: "COLLECTIVE_GROUP" },
      { name: "Mikael Franzén", officialRole: "Huvudtränare / Sportkommittén", standardRoles: ["HEAD_COACH"] },
      { name: "Jasmin Zuta", officialRole: "Tränarstab", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Fikret Handan", officialRole: "Målvaktstränare", standardRoles: ["GOALKEEPER_COACH"] },
      { name: "Jerry Hallbäck", officialRole: "Sporting/Development/Market / Sportkommittén", standardRoles: ["OTHER"] },
      { name: "Martin Boquist", officialRole: "Sportkommittén (handbollsexpertis)", standardRoles: ["OTHER"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "DEFENCE", key: "primaryFormation", value: "6:0", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "alternativeFormation", value: "5:1", ev: "USER_EXPERT_ASSESSMENT", temporal: "HISTORICAL", notes: "Strong historical tactical signal -- part of RIK's historical tactical culture, a candidate for a future Tactical Heritage layer, not just current coach choice." },
      { field: "tacticalHeritage", domain: "ATTACK", key: "sevenVSixUsage", value: "VERY_LOW_NEAR_ZERO", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalHeritage", domain: "ATTACK", key: "balkanYugoslavInfluence", value: "STRONG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Traditional relationship-based backcourt play, crossing/switch actions, heavy shooting threats -- stored as a tactical influence, not a stereotype." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "ownPlayerPhilosophy", value: "VERY_STRONG_EXPLICIT", ev: "VERIFIED_EXTERNAL_CLUB_STRATEGY", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "homegrownShareTarget", value: ">=50%", ev: "VERIFIED_EXTERNAL_CLUB_STRATEGY", temporal: "LONG_TERM" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "historicalReputation", value: "EXTREME", ev: "VERIFIED_EXTERNAL_DATA", temporal: "HISTORICAL", notes: "20 senior Swedish championships -- historical prestige vs current ability must be kept separate." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "sportingGovernance", value: "COMMITTEE", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT", notes: "Uses a sporting-committee model rather than requiring a fictional single sporting director." },
      { field: "cultureIdentity", domain: "SQUAD_COMPOSITION", key: "squadContinuity", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
    ],
    coachOf: "Mikael Franzén",
    coachClaims: [
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "sevenVSixPreference", value: "EXTREMELY_LOW_OPPOSED", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Useful philosophical counterpoint to high-7v6 teams -- tactical AI should reflect coach preference, not automatically select 7v6 whenever a generic efficiency model favors it." },
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "tacticalCompetence", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalPreferenceClaims", domain: "ATTACK", key: "traditionalHandballInfluence", value: "HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- Tyresö
  {
    clubId: "swe2-tyreso",
    sourceDoc: "Tyresö Handboll CLUB IDENTITY v0.1",
    staff: [
      { name: "Mattias Bejbom", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Magnus Elmgren", officialRole: "Tränare / Herr Utveckling", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Christopher Berry", officialRole: "Målvaktstränare", standardRoles: ["GOALKEEPER_COACH"] },
      { name: "Conny Jädersten", officialRole: "Målvaktstränare", standardRoles: ["GOALKEEPER_COACH"] },
      { name: "Sabina Ingesson", officialRole: "Fysioterapeut", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Erik Borgenhäll", officialRole: "Naprapat", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Felix Sjöstrand", officialRole: "Naprapat", standardRoles: ["PHYSIOTHERAPIST"] },
      { name: "Per Eckelöv", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Ulf Bengtsson", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Jan Flinckman", officialRole: "Sportchef herr", standardRoles: ["SPORTING_DIRECTOR"] },
    ],
    claims: [
      { field: "tacticalHeritage", domain: "ATTACK", key: "sevenVSixFrequency", value: "EXTREME", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Assessed as one of the most extreme 7v6 teams in the division, close to IFK Tumba. No exact percentage until match data is available." },
      { field: "tacticalHeritage", domain: "ATTACK", key: "oneVOneReliance", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Kamikaze attacks retained as scouting language, mapped to high-commitment, direct 1v1 attacking behavior." },
      { field: "tacticalHeritage", domain: "DEFENCE", key: "defensivePerformance", value: "VERY_WEAK", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Low-priority, low-effectiveness; experiments with multiple systems (incl. 3:3) but struggles to create defensive impact -- tactical flexibility != tactical effectiveness." },
      { field: "cultureIdentity", domain: "CULTURE", key: "entertainmentPhilosophy", value: "EXTREME", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Handball as show -- expressive freedom, high risk acceptance and technical-error tolerance as part of the attacking identity." },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "developmentInfrastructure", value: "VERY_STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "currentEliteYouthOutput", value: "WEAK", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Academy infrastructure != current academy output; next strong cohort assessed as distant." },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "LOW_RESOURCES_BALANCED_DISCIPLINED", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "Low financial resources != financial instability -- very low risk tolerance, very high financial discipline." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "staffTacticalCentralisation", value: "EXTREME_AROUND_HEAD_COACH", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "Staff competence != staff influence -- Elmgren has strong formal qualifications, but actual tactical influence assessed as potentially low due to head-coach centralisation." },
    ],
    coachOf: "Mattias Bejbom",
    coachClaims: [
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "decisionCentralisation", value: "VERY_HIGH", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "communicationLeadershipClaims", domain: "LEADERSHIP", key: "staffDelegation", value: "VERY_LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalPreferenceClaims", domain: "TACTICAL_PREFERENCE", key: "sevenVSixWillingness", value: "EXTREME", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "tacticalPreferenceClaims", domain: "DEFENCE", key: "defensivePriority", value: "LOW", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "cultureBuildingClaims", domain: "CULTURE", key: "clubIdentification", value: "EXTREME", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
    ],
  },
  // ---------------------------------------------------------------- VästeråsIrsta
  {
    clubId: "swe2-vasterasirsta",
    sourceDoc: "VästeråsIrsta HF CLUB IDENTITY v0.1",
    staff: [
      { name: "Anton Andreasson", officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH"] },
      { name: "Joakim Eriksson", officialRole: "Assisterande tränare", standardRoles: ["ASSISTANT_COACH"] },
      { name: "Tobias Sjöberg", officialRole: "Målvaktstränare", standardRoles: ["GOALKEEPER_COACH"] },
      { name: "Måns Sjögreen", officialRole: "Fysioterapeut / fystränare", standardRoles: ["PHYSIOTHERAPIST", "STRENGTH_CONDITIONING_COACH"] },
      { name: "Björn Törnkvist", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Suss Löfgren", officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER"] },
      { name: "Mattias Zachrisson", officialRole: "Sportchef", standardRoles: ["SPORTING_DIRECTOR"] },
    ],
    claims: [
      { field: "developmentIdentity", domain: "DEVELOPMENT", key: "youthBreadth", value: "VERY_STRONG", ev: "VERIFIED_EXTERNAL_DATA", temporal: "LONG_TERM" },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "sportingModel", value: "PLAYER_DEVELOPMENT_AND_TRADING", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "IDENTIFY -> ACQUIRE VALUE -> DEVELOP -> APPRECIATE -> SELL -> REINVEST -- explicit core club model." },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "buyLowOrientation", value: "VERY_HIGH_PRIORITY", ev: "VERIFIED_EXTERNAL_CLUB_STRATEGY", temporal: "LONG_TERM" },
      { field: "recruitmentIdentity", domain: "RECRUITMENT", key: "recruitmentAgePreference", value: "YOUNG", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM" },
      { field: "financialStrategicIdentity", domain: "FINANCIAL_STRATEGIC", key: "clubWealthVsRecruitmentIntelligence", value: "NOT_EQUIVALENT", ev: "USER_EXPERT_ASSESSMENT", temporal: "LONG_TERM", notes: "A strong sporting director can build a squad above the level suggested by raw spending power through superior identification of undervalued potential." },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "sportingGovernance", value: "SPORTING_DIRECTOR_HIGH_PROXIMITY", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
      { field: "structuralIdentity", domain: "STRUCTURAL", key: "leagueStatus2026_27", value: "RELEGATED_FROM_HANDBOLLSLIGAN", ev: "VERIFIED_EXTERNAL_DATA", temporal: "CURRENT" },
      { field: "cultureIdentity", domain: "SQUAD_COMPOSITION", key: "clubModelContinuity", value: "HIGH_DESPITE_NEW_COACH", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT", notes: "The club's long-term squad-building philosophy is much clearer than the first-team tactical identity entering 2026/27." },
    ],
    coachOf: "Anton Andreasson",
    coachClaims: [
      { field: "coachingStyleClaims", domain: "TACTICAL_COGNITIVE", key: "careerStage", value: "YOUNG_EMERGING", ev: "USER_EXPERT_ASSESSMENT", temporal: "CURRENT" },
      { field: "developmentClaims", domain: "DEVELOPMENT", key: "previousEnkopingPerformance", value: "STRONG_POSITIVE_SIGNAL", ev: "USER_EXPERT_ASSESSMENT", temporal: "HISTORICAL" },
    ],
  },
];

function buildClubIdentityFile(spec: ClubSpec) {
  const clubSlug = slug(spec.clubId);
  const evRefId = `ev-${clubSlug}-tactical-domain-mapping`;
  const profile: Record<string, unknown[]> = {
    structuralIdentity: [],
    cultureIdentity: [],
    tacticalHeritage: [],
    developmentIdentity: [],
    recruitmentIdentity: [],
    financialStrategicIdentity: [],
    supporterEnvironmentIdentity: [],
  };
  for (const c of spec.claims) {
    (profile[c.field] as unknown[]).push({
      id: `club-${clubSlug}-${c.field}-${slug(c.key)}`,
      subjectType: "CLUB",
      subjectId: spec.clubId,
      domain: c.domain,
      key: c.key,
      value: c.value,
      evidenceClass: c.ev,
      temporalScope: c.temporal,
      sourceRefs: [evRefId],
      ...(c.notes ? { notes: c.notes } : {}),
    });
  }
  return {
    clubId: spec.clubId,
    sourceDocument: spec.sourceDoc,
    evidenceReferences: [{ id: evRefId, sourceDocument: spec.sourceDoc, sourceType: "APPROVED_PROFILE_DOCX", locator: "TACTICAL/CLUB DOMAIN MAPPING" }],
    profile: { clubId: spec.clubId, seasonReference: "2026/27", ...profile },
  };
}

function buildStaffFile(spec: ClubSpec) {
  const clubSlug = slug(spec.clubId);
  const orgEvId = `ev-${clubSlug}-organisation`;
  const coachEvId = `ev-${clubSlug}-coaching-staff`;
  const people = spec.staff.map((s) => ({
    id: personId(s.name, spec.clubId),
    ...(s.personKind ? { personKind: s.personKind } : {}),
    displayName: s.name,
  }));
  const assignments = spec.staff.map((s) => {
    const isOrgRole = s.standardRoles.some((r) => ["CHAIRPERSON", "CLUB_DIRECTOR", "SPORTING_DIRECTOR"].includes(r)) && !s.standardRoles.includes("HEAD_COACH");
    return {
      personId: personId(s.name, spec.clubId),
      clubId: spec.clubId,
      officialRole: s.officialRole,
      standardRoles: s.standardRoles,
      status: s.status ?? "CONFIRMED",
      season: "2026/27",
      evidence: [{ id: isOrgRole ? orgEvId : coachEvId, sourceDocument: spec.sourceDoc, sourceType: "APPROVED_PROFILE_DOCX", locator: isOrgRole ? "ORGANISATION" : "COACHING STAFF" }],
    };
  });
  return { clubId: spec.clubId, season: "2026/27", sourceDocument: spec.sourceDoc, people, assignments };
}

function buildCoachFile(spec: ClubSpec) {
  if (!spec.coachOf || !spec.coachClaims || spec.coachClaims.length === 0) return null;
  const clubSlug = slug(spec.clubId);
  const pid = personId(spec.coachOf, spec.clubId);
  const evId = `ev-${slug(spec.coachOf)}-${clubSlug}-coaching-development`;
  const profile: Record<string, unknown[]> = {
    coachingStyleClaims: [],
    tacticalPreferenceClaims: [],
    communicationLeadershipClaims: [],
    developmentClaims: [],
    adaptabilityClaims: [],
    cultureBuildingClaims: [],
  };
  for (const c of spec.coachClaims) {
    (profile[c.field] as unknown[]).push({
      id: `coach-${slug(spec.coachOf)}-${clubSlug}-${slug(c.key)}`,
      subjectType: "COACH",
      subjectId: pid,
      domain: c.domain,
      key: c.key,
      value: c.value,
      evidenceClass: c.ev,
      temporalScope: c.temporal,
      sourceRefs: [evId],
    });
  }
  return {
    personId: pid,
    clubId: spec.clubId,
    sourceDocument: spec.sourceDoc,
    evidenceReferences: [{ id: evId, sourceDocument: spec.sourceDoc, sourceType: "APPROVED_PROFILE_DOCX", locator: "COACHING / DEVELOPMENT IDENTITY" }],
    profile: { personId: pid, ...profile },
  };
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

let count = 0;
for (const spec of clubs) {
  writeJson(path.join(OUT_ROOT, `${spec.clubId}.json`), buildStaffFile(spec));
  writeJson(path.join(OUT_ROOT, "club", `${spec.clubId}.json`), buildClubIdentityFile(spec));
  count += 2;
  const coachFile = buildCoachFile(spec);
  if (coachFile) {
    writeJson(path.join(OUT_ROOT, "coach", `${coachFile.personId}.json`), coachFile);
    count += 1;
  }
}
console.log(`Wrote ${count} files for ${clubs.length} clubs under ${OUT_ROOT}`);
