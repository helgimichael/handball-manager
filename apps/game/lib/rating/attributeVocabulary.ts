// HM-RATINGS-0.4 Part A: the ONE canonical player-facing presentation
// vocabulary for the rating attribute model. Internal machine keys
// (OutcourtAttribute/GoalkeeperAttribute/family enum values) are stable
// persisted identifiers and MUST NEVER change; this module only maps
// them to a display label for the current locale. Adding a future
// locale means adding another label table here, never touching the
// internal keys or duplicating a translation map in a UI component.
import {
  GOALKEEPER_ATTRIBUTE_FAMILIES,
  OUTCOURT_ATTRIBUTE_FAMILIES,
  type GoalkeeperAttribute,
  type GoalkeeperAttributeFamily,
  type OutcourtAttribute,
  type OutcourtAttributeFamily,
} from "./types";

export type AttributeLocale = "sv";

// ---------------------------------------------------------------------------
// Family labels (shared by name across the outcourt/goalkeeper branches --
// "PERCEPTION_DECISION" and "MENTAL" mean the same thing in both).
// ---------------------------------------------------------------------------

type AnyAttributeFamily = OutcourtAttributeFamily | GoalkeeperAttributeFamily;

const FAMILY_LABELS_SV: Record<AnyAttributeFamily, string> = {
  TECHNICAL: "Teknik",
  PERCEPTION_DECISION: "Spelförståelse & beslut",
  TACTICAL: "Taktik",
  DEFENSIVE: "Försvar",
  PHYSICAL: "Fysik",
  MENTAL: "Mentalt",
  SHOT_STOPPING: "Räddningsspel",
  TRANSITION: "Omställning",
};

// ---------------------------------------------------------------------------
// Outcourt attribute labels -- audited term by term against Swedish
// handball terminology and the project's existing precedent (the old
// mock attribute set's Swedish names, positionLabel()'s style).
// ---------------------------------------------------------------------------

const OUTCOURT_ATTRIBUTE_LABELS_SV: Record<OutcourtAttribute, string> = {
  // TECHNICAL
  PASSING: "Passning",
  BALL_HANDLING: "Bollkontroll",
  SHOOTING_POWER: "Skottstyrka",
  SHOOTING_PLACEMENT: "Skottplacering",
  SHOOTING_VARIETY: "Skottvariation",
  BREAKTHROUGH: "Genombrott",
  FINISHING: "Avslutning",
  WING_FINISHING: "Kantavslutning",
  PIVOT_PLAY: "Pivotspel",
  SCREENING: "Skärmning",
  // PERCEPTION_DECISION
  GAME_READING: "Spelläsning",
  DECISION_MAKING: "Beslutsfattande",
  AWARENESS: "Spelöversikt",
  ANTICIPATION: "Förutseende",
  PLAYMAKING: "Speluppbyggnad",
  TEMPO_CONTROL: "Tempokontroll",
  TWO_V_TWO_READING: "2-mot-2-läsning",
  ADVANTAGE_RECOGNITION: "Överlägesläsning",
  // TACTICAL
  TACTICAL_UNDERSTANDING: "Taktisk förståelse",
  ROLE_DISCIPLINE: "Rolldisciplin",
  OFF_BALL_MOVEMENT: "Rörelse utan boll",
  SPACING: "Ytutnyttjande",
  TIMING: "Timing",
  TRANSITION_UNDERSTANDING: "Omställningsförståelse",
  SYSTEM_ADAPTABILITY: "Systemanpassning",
  SEVEN_V_SIX_UNDERSTANDING: "7-mot-6-förståelse",
  // DEFENSIVE
  CONTACT_ABILITY: "Kontaktförmåga",
  DEFENSIVE_POSITIONING: "Defensiv positionering",
  DEFENSIVE_TIMING: "Defensiv timing",
  LATERAL_DEFENCE: "Sidledsförsvar",
  DEPTH_DEFENCE: "Djupledsförsvar",
  CENTRAL_DEFENCE: "Centralförsvar",
  COVERING: "Täckning",
  SWITCHING_HANDOVER: "Växling",
  BALL_WINNING: "Bollerövring",
  SHOT_BLOCKING: "Skottblock",
  // PHYSICAL
  ACCELERATION: "Acceleration",
  TOP_SPEED: "Toppfart",
  LATERAL_QUICKNESS: "Sidledssnabbhet",
  AGILITY: "Smidighet",
  EXPLOSIVENESS: "Explosivitet",
  STRENGTH: "Styrka",
  CONTACT_BALANCE: "Kontaktbalans",
  JUMP_ABILITY: "Spänst",
  ENDURANCE: "Uthållighet",
  REPEAT_SPRINT_ABILITY: "Upprepad sprintförmåga",
  MOBILITY: "Rörlighet",
  // MENTAL
  CONSISTENCY: "Jämnhet",
  COMPOSURE: "Kyla",
  CONCENTRATION: "Koncentration",
  COMPETITIVE_MENTALITY: "Tävlingsinstinkt",
  RESILIENCE: "Motståndskraft",
  DISCIPLINE: "Disciplin",
  COACHABILITY: "Coachbarhet",
  LEADERSHIP: "Ledarskap",
  PRESSURE_HANDLING: "Presshantering",
};

// ---------------------------------------------------------------------------
// Goalkeeper attribute labels -- deliberately its own table (never
// merged with the outcourt one, matching the domain's own branch split).
// ---------------------------------------------------------------------------

const GOALKEEPER_ATTRIBUTE_LABELS_SV: Record<GoalkeeperAttribute, string> = {
  // SHOT_STOPPING
  GK_POSITIONING: "Positionering",
  SET_POSITION: "Utgångsställning",
  REACTION: "Reaktionsförmåga",
  GK_EXPLOSIVENESS: "Explosivitet",
  LOW_SAVES: "Låga räddningar",
  HIGH_SAVES: "Höga räddningar",
  CLOSE_RANGE_SAVES: "Räddningar nära håll",
  LONG_RANGE_SAVES: "Räddningar långt håll",
  WING_SAVES: "Räddningar mot kantskott",
  SEVEN_M_SAVES: "Straffräddningar",
  // PERCEPTION_DECISION
  SHOOTER_READING: "Skyttläsning",
  SHOT_ANTICIPATION: "Skottförutseende",
  PATIENCE: "Tålamod",
  DECISION_TIMING: "Beslutstiming",
  // TRANSITION
  OUTLET_PASSING: "Utkastpassning",
  RESTART_SPEED: "Omstartssnabbhet",
  TRANSITION_DECISION: "Omställningsbeslut",
  // MENTAL
  GK_CONSISTENCY: "Jämnhet",
  GK_COMPOSURE: "Kyla",
  GK_CONCENTRATION: "Koncentration",
  GK_PRESSURE_HANDLING: "Presshantering",
};

// ---------------------------------------------------------------------------
// Reverse lookups (attribute -> family) -- derived once from the
// families tables in types.ts so this module never needs to duplicate
// that grouping.
// ---------------------------------------------------------------------------

function buildFamilyLookup<TFamily extends string, TAttribute extends string>(
  families: Record<TFamily, readonly string[]>,
): Record<TAttribute, TFamily> {
  const lookup = {} as Record<TAttribute, TFamily>;
  for (const family of Object.keys(families) as TFamily[]) {
    for (const attribute of families[family]) {
      lookup[attribute as TAttribute] = family;
    }
  }
  return lookup;
}

export const OUTCOURT_ATTRIBUTE_TO_FAMILY = buildFamilyLookup<OutcourtAttributeFamily, OutcourtAttribute>(OUTCOURT_ATTRIBUTE_FAMILIES);
export const GOALKEEPER_ATTRIBUTE_TO_FAMILY = buildFamilyLookup<GoalkeeperAttributeFamily, GoalkeeperAttribute>(GOALKEEPER_ATTRIBUTE_FAMILIES);

function isOutcourtAttribute(attribute: string): attribute is OutcourtAttribute {
  return attribute in OUTCOURT_ATTRIBUTE_LABELS_SV;
}

// ---------------------------------------------------------------------------
// Public helpers -- the only API UI code should use. Never render a raw
// enum key directly.
// ---------------------------------------------------------------------------

/**
 * Player-facing label for one outcourt or goalkeeper attribute.
 * `locale` is accepted (and forwarded to whichever label table matches
 * it once a second locale exists) purely so future callers never need
 * to change -- only a new label table needs adding here.
 */
export function getAttributeLabel(attribute: OutcourtAttribute | GoalkeeperAttribute, locale: AttributeLocale = "sv"): string {
  assertLocaleSupported(locale);
  return isOutcourtAttribute(attribute) ? OUTCOURT_ATTRIBUTE_LABELS_SV[attribute] : GOALKEEPER_ATTRIBUTE_LABELS_SV[attribute];
}

/** Which family (technical/mental/etc.) an attribute belongs to. */
export function getAttributeFamily(attribute: OutcourtAttribute | GoalkeeperAttribute): AnyAttributeFamily {
  return isOutcourtAttribute(attribute) ? OUTCOURT_ATTRIBUTE_TO_FAMILY[attribute] : GOALKEEPER_ATTRIBUTE_TO_FAMILY[attribute];
}

/** Player-facing label for an attribute family. */
export function getAttributeFamilyLabel(family: AnyAttributeFamily, locale: AttributeLocale = "sv"): string {
  assertLocaleSupported(locale);
  return FAMILY_LABELS_SV[family];
}

function assertLocaleSupported(locale: AttributeLocale): void {
  if (locale !== "sv") throw new Error(`Unsupported attribute locale: ${locale}`);
}
