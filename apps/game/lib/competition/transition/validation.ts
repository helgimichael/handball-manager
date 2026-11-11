import type { Dependency, PlannerInput } from "./types";

/** Reject malformed/unsupported inputs before any sporting claim is made. Missing data is handled by the planner. */
export function validatePlannerInput(input: PlannerInput): Dependency[] {
  const findings: Dependency[] = [];
  const fail = (code: string, ref: string, message: string) => findings.push({ code, ref, message, status: "BLOCKED" });
  const unique = (ids: readonly string[], ref: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id || seen.has(id)) fail("DUPLICATE_OR_EMPTY_ID", `${ref}:${id}`, "Identifiers must be nonempty and unique in their namespace.");
      seen.add(id);
    }
  };
  const r = input.rules;
  if (!r.leagues.length || !r.families.length) fail("EMPTY_COMPETITION_MODEL",r.id,"A transition/readiness proposal needs at least one modeled league and its family.");
  if (input.seasonId !== r.seasonId) fail("SEASON_MISMATCH", input.seasonId, `Rule package governs ${r.seasonId}, not ${input.seasonId}.`);
  if (r.ranking !== "POINTS_GD_GF_MUTUAL_NEUTRAL") fail("UNSUPPORTED_RANKING_POLICY", r.id, "No fallback ranking policy is available.");
  if (!r.id || !r.nextSeasonId || r.nextSeasonId === r.seasonId) fail("INVALID_RULES", r.id, "Rules must identify distinct source and target seasons.");
  if (![r.points.win,r.points.draw,r.points.loss].every((n) => Number.isSafeInteger(n) && n >= 0) || r.points.win <= r.points.draw || r.points.draw <= r.points.loss) fail("INVALID_POINTS_RULE", r.id, "Invalid points definition.");
  unique(r.families.map((f) => f.id), "families");
  unique(r.leagues.map((l) => l.id), "leagues");
  unique(r.boundaryLeagues?.map(b => b.id) ?? [], "boundary-leagues");
  for (const b of r.boundaryLeagues ?? []) if (r.leagues.some(l => l.id === b.id) || !r.families.some(f => f.id === b.familyId && f.boundary)) fail("INVALID_BOUNDARY_LEAGUE", b.id, "Boundary destinations need unique IDs and an explicit boundary family.");
  unique(r.entries.map((e) => e.id), "entries");
  unique(r.stages.map((s) => s.id), "stages");
  unique(input.clubs.map((c) => c.id), "canonical-clubs");
  unique(input.standings.map((t) => t.competitionId), "tables");
  const families = new Map(r.families.map((f) => [f.id,f]));
  const leagues = new Map(r.leagues.map((l) => [l.id,l]));
  const entries = new Map(r.entries.map((e) => [e.id,e]));
  const clubs = new Map(input.clubs.map((c) => [c.id,c]));
  for (const f of r.families) if (!Number.isSafeInteger(f.tier) || f.tier < 1 || !f.nation || !f.category) fail("INVALID_FAMILY", f.id, "A family needs a country, category and positive sporting tier.");
  for (const l of r.leagues) {
    if (!families.has(l.familyId) || families.get(l.familyId)?.boundary || !Number.isSafeInteger(l.size) || l.size < 2 || l.legs !== 2) fail("UNSUPPORTED_LEAGUE_DEFINITION", l.id, "A modeled double round-robin league needs a non-boundary family and valid size.");
    for (let rank = 1; rank <= l.size; rank++) {
      if (r.entries.filter((e) => e.selector.kind === "RANK" && e.selector.competitionId === l.id && e.selector.rank === rank).length !== 1) fail("INVALID_RANK_COVERAGE", `${l.id}:${rank}`, "Every rank must have exactly one ordinary entry rule.");
    }
  }
  unique(r.entries.flatMap((e) => e.selector.kind === "EXTERNAL" ? [e.selector.slotId] : []), "external-slots");
  for (const e of r.entries) {
    const from = e.selector.kind === "RANK" ? families.get(leagues.get(e.selector.competitionId)?.familyId ?? "") : families.get(e.selector.familyId);
    const to = families.get(e.targetFamilyId);
    if (!from || !to || from.nation !== to.nation || from.category !== to.category || Math.abs(from.tier-to.tier) > 1 || (e.purpose === "RETAIN" && from.id !== to.id) || (e.purpose === "DIRECT" && from.tier === to.tier)) fail("INVALID_DIVISION_BOUNDARY", e.id, "Unknown, cross-country/category or non-adjacent division boundary.");
    if (e.selector.kind === "RANK") {
      const l = leagues.get(e.selector.competitionId);
      if (!l || !Number.isSafeInteger(e.selector.rank) || e.selector.rank < 1 || e.selector.rank > l.size) fail("INVALID_SELECTOR", e.id, "Rank outside source league.");
      if (e.replacement === "UPPER_HALF" && (!l || e.selector.rank > Math.ceil(l.size/2) || !e.eligibility || !from || !to || to.tier !== from.tier-1)) fail("INVALID_REPLACEMENT_POLICY", e.id, "Upper-half replacements apply only to eligible upward entries.");
    } else if (!from?.boundary || e.replacement !== "NONE") fail("INVALID_EXTERNAL_SELECTOR", e.id, "External slots must explicitly name a boundary; their replacements require an organizer decision.");
    if (!["NONE","UPPER_HALF"].includes(e.replacement) || !["DIRECT","RETAIN","QUALIFY"].includes(e.purpose)) fail("UNSUPPORTED_ENTRY_POLICY", e.id, "Unknown entry policy.");
    if (!e.source.url || !e.source.section) fail("MISSING_RULE_SOURCE", e.id, "Every entry needs an official regulation locator.");
  }
  const seenStages = new Set<string>(), usedEntries: string[] = [], usedWinners: string[] = [];
  const stageSources = new Map<string,Set<string>>();
  for (const s of r.stages) {
    const games = s.format === "BEST_OF_3" ? 3 : s.format === "BEST_OF_5" ? 5 : s.format === "TWO_LEG" ? 2 : 0;
    if (!games || s.entrants.length !== 2 || (s.homeOrder !== null && (s.homeOrder.length !== games || s.homeOrder.some((n) => n !== 0 && n !== 1)))) fail("UNSUPPORTED_STAGE_FORMAT", s.id, "Unsupported format, entrant count or home order.");
    if (s.equalRankHomeOrder && (r.provenance !== "GAME_CONTINUITY" || s.equalRankHomeOrder.length !== games || s.equalRankHomeOrder.some(side => side !== 0 && side !== 1))) fail("UNSUPPORTED_HOME_POLICY", s.id, "Equal-rank draws require an explicit game-continuity policy and complete home order.");
    if (s.homeReference !== undefined && s.homeReference !== "BETTER_SOURCE_RANK") fail("UNSUPPORTED_HOME_POLICY", s.id, "Unknown reference-entrant policy.");
    const iso = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
    if (s.gameWindows && (s.gameWindows.length !== games || s.gameWindows.some((w,i) => !iso(w.startDate) || !iso(w.endDate) || w.startDate < `${r.seasonId.slice(0,4)}-07-01` || w.endDate > `${Number(r.seasonId.slice(0,4))+1}-06-30` || w.startDate > w.endDate || (i > 0 && s.gameWindows![i-1]!.endDate >= w.startDate) || !w.source.url || !w.source.section))) fail('INVALID_QUALIFICATION_CALENDAR',s.id,'Each game needs a valid, chronological, sourced date window.');
    if (s.terminalDecider && (s.terminalDecider.kind !== 'SEVEN_METRES_AFTER_TWO_OVERTIMES' || !s.terminalDecider.source.url || !s.terminalDecider.source.section)) fail('UNSUPPORTED_TERMINAL_DECIDER',s.id,'Unsupported or unsourced qualification decider.');
    const origins = new Set<string>();
    for (const entrant of s.entrants) {
      if (entrant.kind === "ENTRY") {
        if (entries.get(entrant.entryId)?.purpose !== "QUALIFY") fail("INVALID_STAGE_ENTRY", s.id, "Stage references a missing or non-qualification entry.");
        usedEntries.push(entrant.entryId);
        const e = entries.get(entrant.entryId);
        if (e) origins.add(e.selector.kind === "RANK" ? leagues.get(e.selector.competitionId)?.familyId ?? "" : e.selector.familyId);
      } else if (entrant.kind === "WINNER") {
        if (!seenStages.has(entrant.stageId)) fail("INVALID_QUALIFICATION_GRAPH", s.id, "Missing, cyclic or forward winner reference.");
        usedWinners.push(entrant.stageId);
        stageSources.get(entrant.stageId)?.forEach((id) => origins.add(id));
      } else fail("UNSUPPORTED_STAGE_ENTRANT", s.id, "Unknown entrant policy.");
    }
    if (!s.loserFamilyId || !families.has(s.loserFamilyId) || (s.winnerFamilyId && !families.has(s.winnerFamilyId)) || !s.source.url || !s.source.section) fail("INVALID_STAGE_OUTCOME", s.id, "Stage needs sourced, known terminal destinations.");
    for (const destination of [s.winnerFamilyId,s.loserFamilyId].filter((id): id is string => Boolean(id))) {
      const to = families.get(destination);
      for (const origin of origins) {
        const from = families.get(origin);
        if (!from || !to || from.nation !== to.nation || from.category !== to.category || Math.abs(from.tier-to.tier) > 1) fail("INVALID_DIVISION_BOUNDARY", s.id, "Qualification outcome crosses an unsupported division boundary.");
      }
    }
    stageSources.set(s.id,origins);
    seenStages.add(s.id);
  }
  unique(usedEntries, "stage-entry-usage");
  unique(usedWinners, "stage-winner-usage");
  for (const e of r.entries.filter((e) => e.purpose === "QUALIFY")) if (!usedEntries.includes(e.id)) fail("UNUSED_QUALIFICATION_ENTRY", e.id, "Qualification entry has no stage.");
  for (const s of r.stages) if (Boolean(s.winnerFamilyId) === usedWinners.includes(s.id)) fail("INVALID_WINNER_DESTINATION", s.id, "Winner must either feed one stage or receive a terminal destination.");

  const membership = new Set<string>();
  for (const t of input.standings) {
    const l = leagues.get(t.competitionId), f = families.get(l?.familyId ?? "");
    if (!l) { fail("UNKNOWN_COMPETITION", t.competitionId, "Standings do not belong to a modeled league."); continue; }
    if (t.seasonId !== r.seasonId) fail("SEASON_MISMATCH", t.competitionId, "Standings belong to another season.");
    if (t.rows.length !== l.size) fail("LEAGUE_SIZE_MISMATCH", t.competitionId, `Expected ${l.size} rows; got ${t.rows.length}. No clubs will be padded or removed.`);
    for (const row of t.rows) {
      const c = clubs.get(row.clubId);
      if (!c || c.nation !== f?.nation || c.category !== f?.category) fail("INVALID_CLUB_IDENTITY", row.clubId, "Unknown canonical identity or wrong country/category.");
      if (membership.has(row.clubId)) fail("DUPLICATE_CLUB_MEMBERSHIP", row.clubId, "A club appears in multiple table positions or leagues.");
      membership.add(row.clubId);
      const counts = [row.played,row.won,row.drawn,row.lost,row.goalsFor,row.goalsAgainst,row.points];
      if (!counts.every((n) => Number.isSafeInteger(n) && n >= 0) || !Number.isSafeInteger(row.goalDifference) || row.won+row.drawn+row.lost !== row.played || row.goalsFor-row.goalsAgainst !== row.goalDifference || row.points !== row.won*r.points.win+row.drawn*r.points.draw+row.lost*r.points.loss || (t.completed && row.played !== (l.size-1)*l.legs)) fail("INVALID_STANDINGS_TOTALS", `${t.competitionId}:${row.clubId}`, "Inconsistent or incomplete round-robin totals.");
    }
    const sum = (key: "won" | "lost" | "drawn" | "goalsFor" | "goalsAgainst") => t.rows.reduce((total,row) => total+row[key],0);
    if (sum("won") !== sum("lost") || sum("drawn")%2 !== 0 || sum("goalsFor") !== sum("goalsAgainst")) fail("INVALID_LEAGUE_TOTALS", t.competitionId, "League wins/losses, draws or goals do not balance.");
    const pairs = new Set<string>(), ids = new Set(t.rows.map((row) => row.clubId));
    for (const game of t.mutualResults ?? []) {
      const pair = JSON.stringify([game.homeClubId,game.awayClubId]);
      if (!ids.has(game.homeClubId) || !ids.has(game.awayClubId) || game.homeClubId === game.awayClubId || pairs.has(pair) || ![game.homeGoals,game.awayGoals].every((n) => Number.isSafeInteger(n) && n >= 0)) fail("INVALID_MUTUAL_RESULT", t.competitionId, "Mutual results must be unique, valid home/away games between table clubs.");
      pairs.add(pair);
    }
    for (const row of t.rows) {
      const games = (t.mutualResults ?? []).filter((g) => g.homeClubId === row.clubId || g.awayClubId === row.clubId);
      let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
      for (const game of games) {
        const own = game.homeClubId === row.clubId ? game.homeGoals : game.awayGoals;
        const other = game.homeClubId === row.clubId ? game.awayGoals : game.homeGoals;
        goalsFor += own; goalsAgainst += other;
        if (own > other) won++; else if (own === other) drawn++; else lost++;
      }
      if (games.length > row.played || won > row.won || drawn > row.drawn || lost > row.lost || goalsFor > row.goalsFor || goalsAgainst > row.goalsAgainst || (games.length === row.played && (goalsFor !== row.goalsFor || goalsAgainst !== row.goalsAgainst))) fail("MUTUAL_TOTALS_MISMATCH", `${t.competitionId}:${row.clubId}`, "Supplied mutual results contradict the completed league totals.");
    }
    const decisionClubs: string[] = [];
    for (const d of t.rankingDecisions ?? []) {
      const named = d.orderedClubIds.map((id) => t.rows.find((row) => row.clubId === id));
      const first = named[0];
      const tied = first ? t.rows.filter((row) => row.points === first.points && row.goalDifference === first.goalDifference && row.goalsFor === first.goalsFor) : [];
      if (!d.evidence.trim() || !["NEUTRAL_MATCH","ORGANIZER_RULING"].includes(d.kind) || named.length < 2 || named.some((row) => !row || !first || row.points !== first.points || row.goalDifference !== first.goalDifference || row.goalsFor !== first.goalsFor) || tied.length !== named.length || (d.kind === "NEUTRAL_MATCH" && named.length !== 2)) fail("INVALID_RANKING_DECISION", t.competitionId, "An evidenced decision must cover the whole tied group; a neutral match resolves two clubs only.");
      decisionClubs.push(...d.orderedClubIds);
    }
    unique(decisionClubs, `ranking-decisions:${t.competitionId}`);
  }
  const eligibility = input.eligibility ?? [];
  unique(eligibility.map((e) => `${e.clubId}:${e.targetFamilyId}`), "eligibility");
  for (const e of eligibility) if (!clubs.has(e.clubId) || !families.has(e.targetFamilyId) || e.seasonId !== r.seasonId || !["ELIGIBLE","INELIGIBLE","UNKNOWN"].includes(e.status) || (e.status !== "UNKNOWN" && !e.evidence.trim())) fail("INVALID_ELIGIBILITY_EVIDENCE", e.clubId, "Eligibility needs a known club, target, season and evidence. Unknown is not eligible.");
  const external = input.externalEntrants ?? [];
  unique(external.map((e) => e.slotId), "external-entrants");
  unique(external.map((e) => e.clubId), "external-clubs");
  for (const e of external) {
    const rule = r.entries.find((x) => x.selector.kind === "EXTERNAL" && x.selector.slotId === e.slotId);
    const f = rule?.selector.kind === "EXTERNAL" ? families.get(rule.selector.familyId) : undefined;
    const c = clubs.get(e.clubId);
    if (!f || !c || c.nation !== f.nation || c.category !== f.category || !e.evidence.trim() || membership.has(e.clubId)) fail("INVALID_EXTERNAL_ENTRANT", e.slotId, "External entrant must be an evidenced, distinct canonical club in the right country/category.");
  }
  const results = input.qualificationResults ?? [];
  unique(results.map((q) => q.stageId), "qualification-results");
  for (const q of results) if (!seenStages.has(q.stageId) || q.seasonId !== r.seasonId || q.participants.length !== 2 || new Set(q.participants).size !== 2 || q.participants.some((id) => !clubs.has(id)) || !q.participants.includes(q.winnerClubId) || !q.evidence.trim() || !["CAREER_SIMULATED","OFFICIAL_IMPORTED","ADMINISTRATIVE_DECISION"].includes(q.origin)) fail("INVALID_QUALIFICATION_RESULT", q.stageId, "Result must name a known stage, season, distinct canonical opponents and an evidenced winner.");
  const fixtures = input.qualificationFixtures ?? [];
  unique(fixtures.map((f) => f.id),"qualification-fixture-ids");
  unique(fixtures.map((f) => `${f.stageId}:${f.game}`),"qualification-fixture-games");
  for (const f of fixtures) {
    const s = r.stages.find((s) => s.id === f.stageId);
    const max = s?.format === "BEST_OF_5" ? 5 : s?.format === "BEST_OF_3" ? 3 : 2;
    if (!s || f.seasonId !== r.seasonId || !Number.isSafeInteger(f.game) || f.game < 1 || f.game > max || f.homeClubId === f.awayClubId || !clubs.has(f.homeClubId) || !clubs.has(f.awayClubId)) fail("INVALID_QUALIFICATION_FIXTURE",f.id,"Fixture must identify a known stage/season, valid game number and distinct canonical opponents.");
    const result = f.result;
    if (result && (!Number.isSafeInteger(result.homeGoals) || result.homeGoals < 0 || !Number.isSafeInteger(result.awayGoals) || result.awayGoals < 0 || !result.evidence.trim() || !["CAREER_SIMULATED","OFFICIAL_IMPORTED","ADMINISTRATIVE_DECISION"].includes(result.origin))) fail("INVALID_QUALIFICATION_SCORE",f.id,"Completed fixture scores need nonnegative integer goals, origin and evidence.");
    if (result?.decider && (![f.homeClubId,f.awayClubId].includes(result.decider.winnerClubId) || !result.decider.evidence.trim())) fail("INVALID_FIXTURE_DECIDER",f.id,"Observed terminal decision needs an opponent winner and evidence.");
  }
  unique((input.groupAllocations ?? []).map((a) => a.clubId), "group-allocations");
  for (const a of input.groupAllocations ?? []) if (!clubs.has(a.clubId) || (!leagues.has(a.competitionId) && !r.boundaryLeagues?.some(l => l.id === a.competitionId)) || !a.evidence.trim()) fail("INVALID_GROUP_ALLOCATION", a.clubId, "Allocation requires a canonical club, modeled target league and evidence.");
  return findings;
}
