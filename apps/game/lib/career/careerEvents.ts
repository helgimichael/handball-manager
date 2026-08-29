// Career Event domain model (HM-GAME-0.3), per
// docs/HANDBALL_MANAGER_CAREER_RHYTHM_SPEC_v0.1.md Sections 4, 14, 15.
//
// A CareerEvent describes something that happened in the game world. It
// stores semantic data only -- no React components, no JSX, no
// pre-rendered HTML (Spec S14, S37.14). The Inbox is a presentation layer
// that CONSUMES these events (see inboxBridge.ts); it must never invent
// world changes on its own (Spec S2.4, S28).

export type CareerEventType =
  | "TRAINING_COMPLETED"
  | "TRAINING_REPORT"
  | "PLAYER_STATUS_CHANGED"
  | "PLAYER_INJURED"
  | "SCOUT_REPORT_READY"
  | "SCOUT_DISCOVERY_READY"
  | "OPPONENT_REPORT_READY"
  | "MATCH_PREPARATION_READY"
  | "MATCHDAY_READY"
  | "MATCH_COMPLETED"
  | "COMPETITION_UPDATE"
  | "STAFF_REPORT"
  | "CLUB_NEWS"
  | "PLAYER_PLACEMENT_EXPIRED"
  | "PLAYER_CONTRACT_EXPIRED";

/** Spec S3: the three-tier priority model. */
export type EventPriority = "INFORMATION" | "IMPORTANT" | "ACTION_REQUIRED";

export type EntityType = "player" | "club" | "fixture" | "competition" | "task";

export interface EntityRef {
  entityType: EntityType;
  entityId: string;
}

/**
 * Spec S15: a typed deep-link destination, never a brittle raw href
 * string. HM-GAME-0.4 wires the four ANALYSIS_* routes (previously
 * reserved as `ANALYSIS_HUB`/`OPPONENT_ANALYSIS` in HM-GAME-0.3) into
 * the Analysis Hub built in HM-ANALYSIS-0.1 -- see destinations.ts. None
 * of them carry a clubId/fixtureId: Analysis Hub always derives the
 * current opponent/last match dynamically from CareerState itself, so a
 * destination never needs to (and must not) encode one.
 */
export type EventDestination =
  | { route: "HOME" }
  | { route: "INBOX" }
  | { route: "PLAYER_PROFILE"; playerId: string }
  | { route: "SQUAD" }
  | { route: "TACTICS" }
  | { route: "TRAINING" }
  | { route: "SCHEDULE" }
  | { route: "MATCH_PREVIEW" }
  | { route: "MATCH_DAY"; fixtureId: string }
  | { route: "MATCH_REPORT"; fixtureId: string }
  | { route: "SCOUTING" }
  | { route: "SCOUT_REPORT"; playerId: string }
  | { route: "RECRUITMENT" }
  | { route: "COMPETITION"; competitionId: string }
  | { route: "CLUB" }
  | { route: "ANALYSIS_OVERVIEW" }
  | { route: "ANALYSIS_OPPONENT" }
  | { route: "ANALYSIS_OUR_TEAM" }
  | { route: "ANALYSIS_LAST_MATCH" };

/** Spec S14: the CareerEvent shape. */
export interface CareerEvent {
  /** Stable/deterministic -- the deduplication key (Spec S27). Regenerating the same semantic event never produces a new id. */
  id: string;
  type: CareerEventType;
  /** The game date this event pertains to. */
  date: string;
  priority: EventPriority;
  /** Short semantic subject/title. Presentation text is rendered from this, not stored pre-rendered (Spec S14). */
  subject: string;
  summary: string;
  primaryEntity?: EntityRef;
  relatedEntities: EntityRef[];
  destinations: EventDestination[];
  requiresAction: boolean;
  resolved: boolean;
  read: boolean;
  createdAtGameDate: string;
}

/** Spec S19: ACTION_REQUIRED and IMPORTANT both stop Continue in v0.1; INFORMATION never does on its own. */
export function isStopWorthy(priority: EventPriority): boolean {
  return priority === "ACTION_REQUIRED" || priority === "IMPORTANT";
}

function baseEvent(
  id: string,
  type: CareerEventType,
  date: string,
  priority: EventPriority,
  subject: string,
  summary: string,
  destinations: EventDestination[],
  options?: { primaryEntity?: EntityRef; relatedEntities?: EntityRef[] },
): CareerEvent {
  return {
    id,
    type,
    date,
    priority,
    subject,
    summary,
    primaryEntity: options?.primaryEntity,
    relatedEntities: options?.relatedEntities ?? [],
    destinations,
    requiresAction: priority === "ACTION_REQUIRED",
    resolved: priority !== "ACTION_REQUIRED",
    read: false,
    createdAtGameDate: date,
  };
}

// ---------------------------------------------------------------------------
// Event builders -- one per CareerEventType, each producing a stable id.
// ---------------------------------------------------------------------------

export function buildTrainingCompletedEvent(date: string): CareerEvent {
  return baseEvent(`TRAINING_COMPLETED:${date}`, "TRAINING_COMPLETED", date, "INFORMATION", "Träning genomförd", "Dagens träningspass genomfördes enligt plan.", []);
}

export function buildTrainingReportEvent(date: string): CareerEvent {
  return baseEvent(
    `TRAINING_REPORT:${date}`,
    "TRAINING_REPORT",
    date,
    "IMPORTANT",
    "Veckans träningsrapport",
    "En sammanställning av veckans träning finns tillgänglig.",
    [{ route: "TRAINING" }],
  );
}

export function buildStaffReportEvent(date: string): CareerEvent {
  return baseEvent(
    `STAFF_REPORT:${date}`,
    "STAFF_REPORT",
    date,
    "IMPORTANT",
    "Rapport från tränarstaben",
    "Tränarstaben har sammanställt en lägesrapport.",
    [{ route: "SQUAD" }],
  );
}

export function buildPlayerStatusChangedEvent(playerId: string, date: string, toAvailable: boolean): CareerEvent {
  return baseEvent(
    `PLAYER_STATUS_CHANGED:${date}:${playerId}`,
    "PLAYER_STATUS_CHANGED",
    date,
    "IMPORTANT",
    toAvailable ? "Spelare tillgänglig igen" : "Spelarstatus ändrad",
    toAvailable ? "En spelare är åter tillgänglig för spel." : "En spelares tillgänglighet har ändrats.",
    [{ route: "PLAYER_PROFILE", playerId }],
    { primaryEntity: { entityType: "player", entityId: playerId } },
  );
}

export function buildPlayerInjuredEvent(playerId: string, date: string): CareerEvent {
  return baseEvent(
    `PLAYER_INJURED:${date}:${playerId}`,
    "PLAYER_INJURED",
    date,
    "IMPORTANT",
    "Spelare skadad",
    "En spelare har ådragit sig en skada.",
    [{ route: "PLAYER_PROFILE", playerId }, { route: "SQUAD" }],
    { primaryEntity: { entityType: "player", entityId: playerId } },
  );
}

export function buildScoutReportReadyEvent(taskId: string, playerId: string, date: string): CareerEvent {
  return baseEvent(
    `SCOUT_REPORT_READY:${taskId}`,
    "SCOUT_REPORT_READY",
    date,
    "IMPORTANT",
    "Scoutingrapport klar",
    "En scoutingbevakning har slutförts.",
    [{ route: "SCOUT_REPORT", playerId }, { route: "SCOUTING" }, { route: "RECRUITMENT" }],
    { primaryEntity: { entityType: "player", entityId: playerId } },
  );
}

/**
 * HM-SCOUTING-1.1: fires once per completed discovery CYCLE of a broad
 * (CLUB/COMPETITION/REGION/POSITION/AGE_BAND) assignment -- one event per
 * (assignmentId, cycleIndex) pair, so a multi-cycle assignment produces
 * one message per cycle, never a single message retroactively covering
 * every cycle. `discoveredCount` drives the deterministic, honest
 * summary text ("Claes Hellgren har hittat 4 spelare i Bundesliga", never
 * a claim about exhaustiveness/ranking against the full database).
 */
export function buildScoutDiscoveryReadyEvent(assignmentId: string, cycleIndex: number, scoutName: string, scopeLabel: string, discoveredCount: number, date: string): CareerEvent {
  const summary =
    discoveredCount > 0
      ? `${scoutName} har hittat ${discoveredCount} spelare ${scopeLabel}.`
      : `${scoutName} hittade inga nya spelare ${scopeLabel} den här gången.`;
  return baseEvent(
    `SCOUT_DISCOVERY_READY:${assignmentId}:${cycleIndex}`,
    "SCOUT_DISCOVERY_READY",
    date,
    discoveredCount > 0 ? "IMPORTANT" : "INFORMATION",
    "Nya spelare upptäckta",
    summary,
    [{ route: "SCOUTING" }, { route: "RECRUITMENT" }],
  );
}

export function buildOpponentReportReadyEvent(taskId: string, clubId: string, date: string): CareerEvent {
  return baseEvent(
    `OPPONENT_REPORT_READY:${taskId}`,
    "OPPONENT_REPORT_READY",
    date,
    "IMPORTANT",
    "Motståndaranalys klar",
    "Analysen av nästa motståndare är klar.",
    [{ route: "ANALYSIS_OPPONENT" }],
    { primaryEntity: { entityType: "club", entityId: clubId } },
  );
}

export function buildMatchPreparationReadyEvent(fixtureId: string, date: string): CareerEvent {
  return baseEvent(
    `MATCH_PREPARATION_READY:${fixtureId}`,
    "MATCH_PREPARATION_READY",
    date,
    "IMPORTANT",
    "Matchförberedelser klara",
    "Förberedelserna inför nästa match är klara.",
    [{ route: "MATCH_PREVIEW" }, { route: "ANALYSIS_OPPONENT" }, { route: "TACTICS" }],
    { primaryEntity: { entityType: "fixture", entityId: fixtureId } },
  );
}

export function buildMatchdayReadyEvent(fixtureId: string, date: string): CareerEvent {
  return baseEvent(
    `MATCHDAY_READY:${fixtureId}`,
    "MATCHDAY_READY",
    date,
    "ACTION_REQUIRED",
    "Matchdag",
    "Dagens match väntar och måste spelas eller simuleras.",
    [{ route: "MATCH_PREVIEW" }],
    { primaryEntity: { entityType: "fixture", entityId: fixtureId } },
  );
}

export function buildMatchCompletedEvent(fixtureId: string, competitionId: string, date: string): CareerEvent {
  return baseEvent(
    `MATCH_COMPLETED:${fixtureId}`,
    "MATCH_COMPLETED",
    date,
    "IMPORTANT",
    "Matchen är klar",
    "Matchrapporten och matchanalysen är tillgängliga.",
    // HM-GAME-0.4 (Spec §12/§15): the manager can move straight from a
    // completed match into either the raw report or Last Match Analysis
    // -- Analysis Hub derives the latter instantly from the same stored
    // FastMatchResult, so this is never a fake "analysis is processing"
    // delay (Spec §29).
    [{ route: "MATCH_REPORT", fixtureId }, { route: "ANALYSIS_LAST_MATCH" }, { route: "COMPETITION", competitionId }],
    { primaryEntity: { entityType: "fixture", entityId: fixtureId } },
  );
}

export function buildCompetitionUpdateEvent(date: string, competitionId: string): CareerEvent {
  return baseEvent(
    `COMPETITION_UPDATE:${date}`,
    "COMPETITION_UPDATE",
    date,
    "INFORMATION",
    "Tabellen är uppdaterad",
    "Resultat från andra lag har uppdaterat tabellen.",
    [{ route: "COMPETITION", competitionId }],
    { primaryEntity: { entityType: "competition", entityId: competitionId } },
  );
}

export function buildClubNewsEvent(id: string, date: string, subject: string, summary: string): CareerEvent {
  return baseEvent(`CLUB_NEWS:${id}:${date}`, "CLUB_NEWS", date, "INFORMATION", subject, summary, [{ route: "CLUB" }]);
}

// --- HM-CLUB-PARTNERSHIPS-1.1: player development placement lifecycle ---
// Only the time-driven end (the underlying partnership itself expiring)
// gets a CareerEvent, matching the rest of this file's own established
// split: dailyTick-driven world changes emit an event (buildPartnershipExpiredEvent
// and friends); direct manager actions (starting a placement, an
// explicit recall) do not, same as terminatePartnership/renewPartnership/
// startDevelopmentPartnership never emitting one either -- an inbox
// message about an action the manager just took themselves would be
// pure noise (Part: "anti-spam").

export function buildPlacementExpiredEvent(placementId: string, playerId: string, date: string): CareerEvent {
  return baseEvent(
    `PLAYER_PLACEMENT_EXPIRED:${placementId}`,
    "PLAYER_PLACEMENT_EXPIRED",
    date,
    "IMPORTANT",
    "Placering avslutad -- samarbetet har löpt ut",
    "Spelarens placering hos partnerklubben avslutades eftersom samarbetsavtalet inte längre är aktivt.",
    [{ route: "PLAYER_PROFILE", playerId }],
    { primaryEntity: { entityType: "player", entityId: playerId } },
  );
}

/** HM-PLAYER-CONTRACT-LIFECYCLE-1.0: only ever emitted for the manager's OWN club (Part: "Undvik inbox spam" -- every other club's departures are silent world state, same precedent as CPU recruitment's own cpuDecisionLog-not-CareerEvent choice). */
export function buildPlayerContractExpiredEvent(playerId: string, date: string): CareerEvent {
  return baseEvent(
    `PLAYER_CONTRACT_EXPIRED:${playerId}:${date}`,
    "PLAYER_CONTRACT_EXPIRED",
    date,
    "IMPORTANT",
    "Spelare lämnar klubben -- kontraktet har löpt ut",
    "Spelarens kontrakt har löpt ut utan förlängning och spelaren är nu fri agent.",
    [{ route: "PLAYER_PROFILE", playerId }, { route: "SQUAD" }],
    { primaryEntity: { entityType: "player", entityId: playerId } },
  );
}
