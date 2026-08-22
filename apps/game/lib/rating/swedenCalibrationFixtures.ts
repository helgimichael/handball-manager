// HM-RATINGS-0.1: Sweden 2026/27 calibration fixtures -- used ONLY to
// prove the Player Rating domain can REPRESENT the qualitative cases the
// design docs call out (docs/design/HANDBALL_MANAGER_SWEDEN_2026-27_PLAYER_RATING_ANCHORS_v0.1.docx,
// docs/design/HANDBALL_MANAGER_PLAYER_RATING_MODEL_v0.1.docx §17-18).
//
// These are validation fixtures, NOT a player database entry:
//  - no numeric CA, no numeric PA, no numeric attribute is assigned to
//    any of these real players in this milestone (ca/pa are left
//    genuinely unassessed; PA priors use only qualitative anchor bands,
//    never a point value -- see validators.ts's paRatingFromPotentialAnchor).
//  - every claim below is transcribed qualitatively from the source
//    anchors document (anchor labels, career-signal descriptions,
//    functional attribute anchors, injury-evidence status) -- nothing
//    invented, nothing numerically calibrated.
//  - HM-RATINGS-0.2 is the first milestone permitted to attach real
//    numbers to any Swedish player.
import { unassessedAbilityRating } from "./validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type PlayerRatingClaim, type PlayerRatingProfile } from "./types";

function claim(overrides: Pick<PlayerRatingClaim, "id" | "playerId" | "evidenceClass" | "domain" | "key" | "value"> & Partial<PlayerRatingClaim>): PlayerRatingClaim {
  return { sourceRefs: ["ev-sweden-2026-27-anchors"], ...overrides };
}

function unassessedProfile(playerId: string, position: PlayerRatingProfile["position"]): PlayerRatingProfile {
  return {
    playerId,
    position,
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
  };
}

// ---------------------------------------------------------------------------
// Gustav Davidsson (Hammarby) -- elite playmaker anchor: league-best
// expert playmaker assessment, exceptional passing/M6 cooperation.
// ---------------------------------------------------------------------------

export const GUSTAV_DAVIDSSON_ID = "se_player_gustav_davidsson";

export const gustavDavidssonProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(GUSTAV_DAVIDSSON_ID, "M9");
  profile.attackRoleProficiencies = [{ role: "PRIMARY_PLAYMAKER" }]; // role vocabulary only -- no numeric role-ability value assigned in this milestone
  profile.claims = [
    claim({ id: "gd-cs-1", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "seniorInternational", value: "Swedish senior international" }),
    claim({ id: "gd-cs-2", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "foreignClubExperience", value: "Rhein-Neckar Löwen; IK Sävehof" }),
    claim({ id: "gd-an-1", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" }),
    claim({ id: "gd-an-2", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "PRIMARY_PLAYMAKER" }),
    claim({ id: "gd-an-3", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "ATTACK_ORGANIZER" }),
    claim({ id: "gd-fa-1", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "PASSING", value: "EXCEPTIONAL" }),
    claim({ id: "gd-fa-2", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "PIVOT_PLAY_COOPERATION", value: "EXCEPTIONAL" }),
    claim({ id: "gd-fa-3", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "PLAYMAKING", value: "LEAGUE_BEST_EXPERT_ASSESSMENT" }),
    claim({ id: "gd-fa-4", playerId: GUSTAV_DAVIDSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "OWN_SCORING_THREAT", value: "STRONG" }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Niclas Ekberg (Ystads IF) -- club icon/star, league-best H6 benchmark.
// ---------------------------------------------------------------------------

export const NICLAS_EKBERG_ID = "se_player_niclas_ekberg";

export const niclasEkbergProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(NICLAS_EKBERG_ID, "H6");
  profile.claims = [
    claim({ id: "ne-cs-1", playerId: NICLAS_EKBERG_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "eliteCareer", value: "Extensive international top-level career and major championship/European club experience" }),
    claim({ id: "ne-an-1", playerId: NICLAS_EKBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_ICON" }),
    claim({ id: "ne-an-2", playerId: NICLAS_EKBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" }),
    claim({ id: "ne-an-3", playerId: NICLAS_EKBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "ELITE_H6" }),
    claim({ id: "ne-fa-1", playerId: NICLAS_EKBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "H6_POSITIONAL_STANDING", value: "LEAGUE_BEST" }),
    claim({ id: "ne-fa-2", playerId: NICLAS_EKBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "EXPERIENCE", value: "ELITE" }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Andreas Nilsson (Önnereds HK) -- offensive M6 + weaker defence
// specialism: elite offensive impact, explicitly BELOW_PROFILE_EXPECTATION
// on defence -- a specialist profile that must not be flattened.
// ---------------------------------------------------------------------------

export const ANDREAS_NILSSON_ID = "se_player_andreas_nilsson";

export const andreasNilssonProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(ANDREAS_NILSSON_ID, "M6");
  profile.attackRoleProficiencies = [{ role: "OFFENSIVE_PIVOT" }];
  profile.defenceRoleProficiencies = []; // no defensive role claimed -- weaker defence is evidenced, not proficiency-assigned
  profile.claims = [
    claim({ id: "an-cs-1", playerId: ANDREAS_NILSSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "seniorInternational", value: "150+ Swedish senior internationals; Olympic silver; Champions League winner with HSV Hamburg" }),
    claim({ id: "an-cs-2", playerId: ANDREAS_NILSSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "leagueProduction", value: "158 Handbollsligan goals in 2025/26" }),
    claim({ id: "an-an-1", playerId: ANDREAS_NILSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "SUPER_CLUB_STAR" }),
    claim({ id: "an-an-2", playerId: ANDREAS_NILSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "ELITE_M6" }),
    claim({ id: "an-an-3", playerId: ANDREAS_NILSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "OFFENSIVE_SPECIALIST" }),
    claim({ id: "an-fa-1", playerId: ANDREAS_NILSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "M6_POSITIONAL_STANDING", value: "LEAGUE_BEST" }),
    claim({ id: "an-fa-2", playerId: ANDREAS_NILSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "OFFENSIVE_IMPACT", value: "ELITE" }),
    // The specialist's weaker phase, preserved honestly rather than smoothed away:
    claim({ id: "an-fa-3", playerId: ANDREAS_NILSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "DEFENSIVE_ABILITY", value: "BELOW_PROFILE_EXPECTATION" }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Liam Hultberg (Ystads IF) -- high current ability + very high potential
// coexisting: already CLUB_STAR-level importance while young, with a
// VERY_HIGH_TO_EXTREME future ceiling. CA/PA are both left genuinely
// unassessed in this milestone; only the PA anchor's PRIOR BAND is used
// (a range, never a point value).
// ---------------------------------------------------------------------------

export const LIAM_HULTBERG_ID = "se_player_liam_hultberg";

export const liamHultbergProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(LIAM_HULTBERG_ID, "M6");
  profile.claims = [
    claim({ id: "lh-cs-1", playerId: LIAM_HULTBERG_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "clubDeveloped", value: "Born 2006; YIF-developed; contracted through 2028" }),
    claim({ id: "lh-cs-2", playerId: LIAM_HULTBERG_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "youthAllStar", value: "All Star Team signal from Sverigecupen" }),
    claim({ id: "lh-an-1", playerId: LIAM_HULTBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" }),
    claim({ id: "lh-an-2", playerId: LIAM_HULTBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "potential", value: "VERY_HIGH_POTENTIAL" }),
    claim({ id: "lh-fa-1", playerId: LIAM_HULTBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "CURRENT_IMPORTANCE", value: "CLUB_STAR_LEVEL" }),
    claim({ id: "lh-fa-2", playerId: LIAM_HULTBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "FUTURE_CEILING", value: "VERY_HIGH_TO_EXTREME" }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Anders Wik Rydberg (Hammarby) -- defensive specialist test case:
// ROLE_SPECIALIST/DEFENSIVE_SPECIALIST with an exceptional club-
// continuity signal, no major attacking anchor claimed.
// ---------------------------------------------------------------------------

export const ANDERS_WIK_RYDBERG_ID = "se_player_anders_wik_rydberg";

export const andersWikRydbergProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(ANDERS_WIK_RYDBERG_ID, "M6");
  profile.attackRoleProficiencies = [];
  profile.defenceRoleProficiencies = [{ role: "DEFENSIVE_SPECIALIST" }];
  profile.claims = [
    claim({ id: "awr-cs-1", playerId: ANDERS_WIK_RYDBERG_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "clubContinuity", value: "Exceptional Hammarby continuity signal; entering roughly a sixteenth season in the club organisation in 2026/27" }),
    claim({ id: "awr-an-1", playerId: ANDERS_WIK_RYDBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "ROLE_SPECIALIST" }),
    claim({ id: "awr-an-2", playerId: ANDERS_WIK_RYDBERG_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "DEFENSIVE_SPECIALIST" }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Baldur Fritz Bjarnason (Ystads IF... research context: recruited as
// major talent) -- large CA/PA gap calibration case: VERY_HIGH_POTENTIAL
// with a separately-tracked, unverified injury-tendency claim.
// ---------------------------------------------------------------------------

export const BALDUR_FRITZ_BJARNASON_ID = "se_player_baldur_fritz_bjarnason";

export const baldurFritzBjarnasonProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(BALDUR_FRITZ_BJARNASON_ID, "V9");
  profile.claims = [
    claim({ id: "bfb-cs-1", playerId: BALDUR_FRITZ_BJARNASON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "youthProduction", value: "Born 2007; Icelandic top-league scoring champion 2024/25 at very young age; Iceland youth international" }),
    claim({ id: "bfb-an-1", playerId: BALDUR_FRITZ_BJARNASON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "potential", value: "VERY_HIGH_POTENTIAL" }),
    claim({
      id: "bfb-inj-1",
      playerId: BALDUR_FRITZ_BJARNASON_ID,
      evidenceClass: "INJURY_AVAILABILITY",
      domain: "INJURY",
      key: "injuryTendency",
      value: "User reports some injury tendency",
    }),
    claim({
      id: "bfb-proj-1",
      playerId: BALDUR_FRITZ_BJARNASON_ID,
      evidenceClass: "PROJECTION_EXPECTATION",
      domain: "PROJECTION",
      key: "marketInterest",
      value: "User reports that major German clubs are already monitoring him",
      notes: "USER EXPERT -- VERIFY: do not promote to verified career evidence until externally supported.",
    }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Robin Järling (Hammarby) -- potential separate from injury risk:
// HIGH_POTENTIAL anchor with a major, EXPLICITLY UNVERIFIED injury-
// history claim -- durability evidence must never contaminate the
// potential anchor itself.
// ---------------------------------------------------------------------------

export const ROBIN_JARLING_ID = "se_player_robin_jarling";

export const robinJarlingProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(ROBIN_JARLING_ID, "V9");
  profile.claims = [
    claim({ id: "rj-an-1", playerId: ROBIN_JARLING_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "potential", value: "HIGH_POTENTIAL" }),
    claim({
      id: "rj-inj-1",
      playerId: ROBIN_JARLING_ID,
      evidenceClass: "INJURY_AVAILABILITY",
      domain: "INJURY",
      key: "kneeInjuryHistory",
      value: "User reports two ACL injuries within approximately 3-4 years",
      confidence: "UNCERTAIN",
      notes: "USER EXPERT -- REQUIRES EXTERNAL VERIFICATION. Keep HIGH_POTENTIAL/ability separate from durability and availability.",
    }),
  ];
  return profile;
})();

// ---------------------------------------------------------------------------
// Malte Haglund (Skånela IF) -- anti-bias PA case: a prestigious foreign
// (VfL Gummersbach) pathway must NOT automatically create HIGH_POTENTIAL.
// Explicit NORMAL_OR_UNCERTAIN_POTENTIAL anchor overrides the superficial
// CV impression.
// ---------------------------------------------------------------------------

export const MALTE_HAGLUND_ID = "se_player_malte_haglund";

export const malteHaglundProfile: PlayerRatingProfile = (() => {
  const profile = unassessedProfile(MALTE_HAGLUND_ID, "V6");
  profile.claims = [
    claim({ id: "mh-cs-1", playerId: MALTE_HAGLUND_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "foreignAcademyPathway", value: "Skånela-developed; moved to VfL Gummersbach at 16 after being scouted in youth competition; returns from Gummersbach environment" }),
    claim({
      id: "mh-an-1",
      playerId: MALTE_HAGLUND_ID,
      evidenceClass: "USER_EXPERT_PLAYER_ANCHOR",
      domain: "ANCHOR",
      key: "potential",
      value: "NORMAL_OR_UNCERTAIN_POTENTIAL",
      notes: "Despite the Gummersbach pathway, user expert assessment does not identify him as HIGH_POTENTIAL -- prestigious environment is evidence about exposure, not automatic proof of high ceiling.",
    }),
  ];
  return profile;
})();

export const SWEDEN_CALIBRATION_PROFILES: readonly PlayerRatingProfile[] = [
  gustavDavidssonProfile,
  niclasEkbergProfile,
  andreasNilssonProfile,
  liamHultbergProfile,
  andersWikRydbergProfile,
  baldurFritzBjarnasonProfile,
  robinJarlingProfile,
  malteHaglundProfile,
];
