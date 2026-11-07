import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStandings } from "@handball-manager/game-simulation";
import { CLUBS } from "../../game-data/clubs";
import { planCompetitionTransition } from "./planner";
import { canonicalCompetitionClubs, snapshotCompetitionTransitionInput } from "./careerSnapshot";
import { SWEDISH_2026_RULES as rules, SWEDISH_FAMILIES as F, SWEDISH_LEAGUES as L } from "./sweden2026";
import { rankCompletedTable } from "./ranking";
import type { KnownQualificationResult, LeagueTableInput, PlannerInput, Standing } from "./types";
import type { CareerState } from "../../career/types";

function syntheticSeason(): PlannerInput {
  const standings = rules.leagues.map((l): LeagueTableInput => {
    const ids = CLUBS.filter((c) => c.competitionId === l.id).map((c) => c.id).sort();
    const mutualResults = ids.flatMap((homeClubId,h) => ids.flatMap((awayClubId,a) => h === a ? [] : [{ homeClubId, awayClubId, homeGoals: h < a ? 30 : 20, awayGoals: h < a ? 20 : 30 }]));
    return { competitionId: l.id, seasonId: rules.seasonId, completed: true, rows: computeStandings(ids,mutualResults,rules.points), mutualResults };
  });
  return { seasonId: rules.seasonId, rules, clubs: canonicalCompetitionClubs(), standings,
    eligibility: standings.flatMap((t) => {
      const family = rules.leagues.find((l) => l.id === t.competitionId)!.familyId;
      const sourceTier = rules.families.find((f) => f.id === family)!.tier;
      return t.rows.flatMap((row) => rules.families.filter((f) => f.tier === sourceTier-1 || f.id === family).map((f) => ({ clubId: row.clubId, targetFamilyId: f.id, seasonId: rules.seasonId, status: "ELIGIBLE" as const, evidence: "Synthetic acceptance/licence/cooperation attestation for this deterministic test season." })));
    }),
  };
}
const at = (input: PlannerInput, league: string, rank: number) => input.standings.find((t) => t.competitionId === league)!.rows[rank-1]!.clubId;
const entry = (league: string, rank: number) => `${league}:rank:${rank}`;
const dep = (plan: ReturnType<typeof planCompetitionTransition>, code: string) => plan.dependencies.some((d) => d.code === code);
function result(stageId: string, a: string, b: string, winnerClubId = a): KnownQualificationResult {
  return { stageId, seasonId: rules.seasonId, participants: [a,b], winnerClubId, origin: "CAREER_SIMULATED", evidence: "Synthetic concluded series, not a real-world result." };
}
function topResults(input: PlannerInput): KnownQualificationResult[] {
  const n2=at(input,L.norra,2), n3=at(input,L.norra,3), s2=at(input,L.sodra,2), s3=at(input,L.sodra,3);
  return [
    ...[11,12,13].map((h) => result(`hbl-${h}`,at(input,L.hbl,h),at(input,L.allsvenskan,15-h))),
    result("ha-semi-n",n2,s3), result("ha-semi-s",s2,n3),
    result("ha-final-11",at(input,L.allsvenskan,11),n2), result("ha-final-12",at(input,L.allsvenskan,12),s2),
  ];
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

test("verified season package covers every modeled rank and all district ports without fake clubs", () => {
  const input = syntheticSeason(), plan = planCompetitionTransition(input);
  assert.equal(plan.entries.length,64);
  assert.equal(plan.clubs.length,52);
  assert.deepEqual(rules.leagues.map((l) => l.size),[14,14,12,12]);
  assert.equal(rules.families.find((f) => f.id === F.division1)!.tier,3);
  assert.equal(plan.qualification.length,15);
  assert.ok(!dep(plan,"INVALID_RANK_COVERAGE"));
  assert.equal(plan.directPromotions.length,3);
  assert.equal(plan.directRelegations.length,7);
  assert.equal(plan.remaining.length,26);
  assert.deepEqual(new Set(plan.directPromotions.map((m) => m.clubId)),new Set([at(input,L.allsvenskan,1),at(input,L.norra,1),at(input,L.sodra,1)]));
  assert.equal(plan.directRelegations.find((m) => m.clubId === at(input,L.allsvenskan,13))!.toFamilyId,F.division1);
  assert.equal(plan.directRelegations.find((m) => m.clubId === at(input,L.norra,12))!.toFamilyId,F.division2);
  assert.equal(plan.directRelegations.find((m) => m.clubId === at(input,L.allsvenskan,13))!.toCompetitionId,undefined);
});

test("unknown qualification results stay unresolved with the verified pairings and conditional games", () => {
  const input=syntheticSeason(), plan=planCompetitionTransition(input);
  const hbl=plan.qualification.find((q) => q.stageId === "hbl-11")!;
  assert.deepEqual(hbl.participants,[at(input,L.hbl,11),at(input,L.allsvenskan,4)]);
  assert.deepEqual(hbl.unresolvedFixtures.map((f) => f.homeClubId),[hbl.participants[1],hbl.participants[0],hbl.participants[0],hbl.participants[1],hbl.participants[0]]);
  assert.deepEqual(hbl.unresolvedFixtures.map((f) => f.conditional),[false,false,false,true,true]);
  assert.ok(plan.qualification.every((q) => !q.winnerClubId));
  assert.equal(plan.qualificationMovements.length,0);
  assert.equal(plan.qualification.find((q) => q.stageId === "ha-final-11")!.participants[1],null);
  assert.ok(dep(plan,"QUALIFICATION_RESULT_UNKNOWN"));
});

test("concluded qualification results feed the graph and confirmed destination counts without extra games", () => {
  const base=syntheticSeason(), input={ ...base, qualificationResults: topResults(base) }, plan=planCompetitionTransition(input);
  assert.ok(plan.qualification.filter((q) => q.stageId.startsWith("hbl-") || q.stageId.startsWith("ha-")).every((q) => q.status === "CONFIRMED" && !q.unresolvedFixtures.length));
  assert.equal(plan.remaining.find((m) => m.clubId === at(base,L.norra,2))!.toFamilyId,F.division1);
  assert.equal(plan.remaining.find((m) => m.clubId === at(base,L.hbl,11))!.toFamilyId,F.hbl);
  assert.deepEqual(plan.sizes.filter((s) => [F.hbl,F.allsvenskan].includes(s.scopeId as typeof F.hbl)),[
    { scopeId: F.hbl, expected:14, confirmed:14, status:"VALID" },
    { scopeId: F.allsvenskan, expected:14, confirmed:14, status:"VALID" },
  ]);
  const promoted=planCompetitionTransition({ ...input, qualificationResults: topResults(base).map((q) => q.stageId === "hbl-11" ? { ...q, winnerClubId: q.participants[1] } : q) });
  assert.ok(promoted.qualificationMovements.some((m) => m.clubId === at(base,L.allsvenskan,4) && m.kind === "PROMOTION"));
  assert.ok(promoted.qualificationMovements.some((m) => m.clubId === at(base,L.hbl,11) && m.kind === "RELEGATION"));
});

test("Division 2 is an explicit incomplete boundary and Norra feeds one final", () => {
  const plan=planCompetitionTransition(syntheticSeason());
  assert.equal(plan.dependencies.filter((d) => d.code === "MISSING_EXTERNAL_ENTRANT").length,12);
  assert.ok(dep(plan,"GROUP_ALLOCATION_REQUIRED"));
  assert.ok(dep(plan,"EXTERNAL_DESTINATION_UNRESOLVED"));
  assert.equal(plan.qualification.find((q) => q.stageId === "d1-n-semi-10")!.status,"BLOCKED");
  assert.ok(plan.qualification.find((q) => q.stageId === "d1-n-semi-10")!.unresolvedFixtures.every((f) => f.homeClubId === null));
  const nFinal=rules.stages.find((s) => s.id === "d1-n-final")!;
  assert.deepEqual(nFinal.entrants,[{ kind:"WINNER",stageId:"d1-n-semi-9" },{ kind:"WINNER",stageId:"d1-n-semi-10" }]);
  assert.deepEqual(rules.stages.find((s) => s.id === "d1-n-pre")!.homeOrder,[0,1]);
});

test("missing Division 1 standings cannot be replaced by strength or a legacy result", () => {
  const base=syntheticSeason();
  const plan=planCompetitionTransition({ ...base, standings:base.standings.filter((t) => t.competitionId !== L.norra) });
  assert.ok(dep(plan,"MISSING_STANDINGS"));
  assert.equal(plan.directPromotions.length,2);
  assert.equal(plan.entries.find((e) => e.entryId === entry(L.norra,1))!.status,"UNRESOLVED");
  assert.equal(plan.qualification.find((q) => q.stageId === "ha-semi-n")!.participants[0],null);
});

test("upper-half replacement walks eligible ranks once and removes consumed retention claims", () => {
  const base=syntheticSeason(), n1=at(base,L.norra,1);
  const plan=planCompetitionTransition({ ...base, eligibility:base.eligibility!.map((e) => e.clubId === n1 && e.targetFamilyId === F.allsvenskan ? { ...e,status:"INELIGIBLE" } : e) });
  assert.equal(plan.directPromotions.find((m) => m.fromCompetitionId === L.norra)!.clubId,at(base,L.norra,2));
  assert.deepEqual(plan.entries.find((e) => e.entryId === entry(L.norra,1))!.skippedClubIds,[n1]);
  assert.deepEqual(plan.qualification.find((q) => q.stageId === "ha-semi-n")!.participants,[at(base,L.norra,3),at(base,L.sodra,3)]);
  assert.equal(plan.qualification.find((q) => q.stageId === "ha-semi-s")!.participants[1],at(base,L.norra,4));
  assert.ok(plan.remaining.some((m) => m.clubId === n1));
  assert.ok(!plan.remaining.some((m) => m.clubId === at(base,L.norra,4)));
  assert.equal(plan.entries.find((e) => e.entryId === entry(L.norra,4))!.status,"SUPERSEDED");
  assert.ok(!dep(plan,"CONFLICTING_MEMBERSHIP_CLAIMS"));
});

test("pending replacements withhold normally retained upper-half candidates instead of inventing retention", () => {
  const base=syntheticSeason();
  const input={ ...base,eligibility:base.eligibility!.map((e) => {
    if (e.targetFamilyId !== F.allsvenskan) return e;
    if ([1,2,3].some((rank) => at(base,L.norra,rank) === e.clubId)) return { ...e,status:"INELIGIBLE" as const };
    return at(base,L.norra,4) === e.clubId ? { ...e,status:"UNKNOWN" as const,evidence:"" } : e;
  }) };
  const plan=planCompetitionTransition(input);
  assert.ok(dep(plan,"REPLACEMENT_SLOT_UNRESOLVED"));
  for (const rank of [4,5,6]) {
    assert.ok(!plan.remaining.some((m) => m.clubId === at(base,L.norra,rank)));
    assert.equal(plan.clubs.find((c) => c.clubId === at(base,L.norra,rank))!.status,"UNRESOLVED");
  }
  assert.ok(plan.remaining.some((m) => m.clubId === at(base,L.norra,7)));
});

test("unknown eligibility blocks later replacements; exhausted upper half requires a ruling", () => {
  const base=syntheticSeason();
  const unknown=planCompetitionTransition({ ...base, eligibility:[] });
  assert.equal(unknown.directPromotions.length,0);
  assert.ok(dep(unknown,"UNKNOWN_ELIGIBILITY"));
  assert.ok(dep(unknown,"PRIOR_ENTRY_UNRESOLVED"));
  const exhausted=planCompetitionTransition({ ...base, eligibility:base.eligibility!.map((e) => e.targetFamilyId === F.allsvenskan ? { ...e,status:"INELIGIBLE" } : e) });
  assert.ok(dep(exhausted,"VACANCY_OR_CANCELLATION_REQUIRED"));
  assert.ok(!exhausted.directPromotions.some((m) => m.fromCompetitionId === L.norra));
});

test("ranking uses points, GD and GF independent of input order", () => {
  const input=syntheticSeason(), table=input.standings[0]!;
  assert.deepEqual(rankCompletedTable({ ...table, rows:[...table.rows].reverse() },rules),rankCompletedTable(table,rules));
  const rows: Standing[] = [
    { ...table.rows[0]!,clubId:"a",points:10,goalDifference:2,goalsFor:20 },
    { ...table.rows[0]!,clubId:"b",points:10,goalDifference:3,goalsFor:19 },
    { ...table.rows[0]!,clubId:"c",points:10,goalDifference:3,goalsFor:21 },
  ];
  assert.deepEqual(rankCompletedTable({ ...table,rows },rules).flatMap((g) => g.clubIds),["c","b","a"]);
});

test("two-club mutual results resolve equal totals; equal mutual results require a neutral match", () => {
  const base=syntheticSeason(), table=base.standings[0]!, a=table.rows[0]!, b=table.rows[1]!;
  const rows=[a,{ ...a,clubId:b.clubId }];
  const mutualResults=[{ homeClubId:a.clubId,awayClubId:b.clubId,homeGoals:30,awayGoals:20 },{ homeClubId:b.clubId,awayClubId:a.clubId,homeGoals:25,awayGoals:20 }];
  assert.deepEqual(rankCompletedTable({ ...table,rows,mutualResults },rules).map((g) => g.clubIds),[[a.clubId],[b.clubId]]);
  mutualResults[1]!.homeGoals=30;
  const tied={ ...table,rows,mutualResults };
  assert.equal(rankCompletedTable(tied,rules)[0]!.reason,"NEUTRAL_MATCH_REQUIRED");
  assert.deepEqual(rankCompletedTable({ ...tied,rankingDecisions:[{ kind:"NEUTRAL_MATCH",orderedClubIds:[b.clubId,a.clubId],evidence:"Synthetic neutral deciding match" }] },rules).map((g) => g.clubIds),[[b.clubId],[a.clubId]]);
  assert.equal(rankCompletedTable({ ...tied,mutualResults:[] },rules)[0]!.reason,"MISSING_MUTUAL_RESULTS");
});

function tiedSeason(base: PlannerInput, competitionId: string): PlannerInput {
  return { ...base, standings:base.standings.map((t) => {
    if (t.competitionId !== competitionId) return t;
    const n=t.rows.length, played=(n-1)*2;
    return { ...t, mutualResults:[],rows:t.rows.map((row): Standing => ({ clubId:row.clubId,played,won:0,lost:0,drawn:played,goalsFor:played*20,goalsAgainst:played*20,goalDifference:0,points:played })) };
  }) };
}
test("multiway sporting ties block rank slots without awarding places alphabetically", () => {
  const input=tiedSeason(syntheticSeason(),L.norra), plan=planCompetitionTransition(input);
  assert.ok(dep(plan,"MULTIWAY_RULING_REQUIRED"));
  assert.ok(!plan.directPromotions.some((m) => m.fromCompetitionId === L.norra));
  assert.ok(!plan.directRelegations.some((m) => m.fromCompetitionId === L.norra));
  const table=input.standings.find((t) => t.competitionId === L.norra)!;
  const orderedClubIds=table.rows.map((row) => row.clubId).reverse();
  const resolved=planCompetitionTransition({ ...input,standings:input.standings.map((t) => t === table ? { ...t,rankingDecisions:[{ kind:"ORGANIZER_RULING",orderedClubIds,evidence:"Synthetic organizer order for entire tie" }] } : t) });
  assert.equal(resolved.directPromotions.find((m) => m.fromCompetitionId === L.norra)!.clubId,orderedClubIds[0]);
});

test("malformed membership, totals, results, season and division definitions are blocked", () => {
  const base=syntheticSeason();
  const mutations: [PlannerInput,string][] = [
    [{ ...base,seasonId:"2027/28" },"SEASON_MISMATCH"],
    [{ ...base,clubs:[...base.clubs,base.clubs[0]!] },"DUPLICATE_OR_EMPTY_ID"],
    [{ ...base,standings:base.standings.map((t,i) => i ? t : { ...t,rows:t.rows.slice(1) }) },"LEAGUE_SIZE_MISMATCH"],
    [{ ...base,standings:base.standings.map((t,i) => i ? t : { ...t,rows:t.rows.map((row,j) => j ? row : { ...row,points:999 }) }) },"INVALID_STANDINGS_TOTALS"],
    [{ ...base,standings:base.standings.map((t,i) => i !== 1 ? t : { ...t,rows:t.rows.map((row,j) => j ? row : { ...row,clubId:at(base,L.hbl,1) }) }) },"DUPLICATE_CLUB_MEMBERSHIP"],
    [{ ...base,rules:{ ...rules,entries:rules.entries.map((e) => e.id === entry(L.hbl,14) ? { ...e,targetFamilyId:F.division2 } : e) } },"INVALID_DIVISION_BOUNDARY"],
    [{ ...base,qualificationResults:[result("hbl-11",at(base,L.hbl,11),at(base,L.allsvenskan,4),"invented-club")] },"INVALID_QUALIFICATION_RESULT"],
    [{ ...base,externalEntrants:[{ slotId:"division2-n-1",clubId:at(base,L.norra,12),evidence:"not actually external" }] },"INVALID_EXTERNAL_ENTRANT"],
  ];
  for (const [input,code] of mutations) {
    const plan=planCompetitionTransition(input);
    assert.equal(plan.status,"BLOCKED",code);
    assert.ok(dep(plan,code),code);
    assert.equal(plan.directPromotions.length+plan.directRelegations.length,0,code);
  }
});

test("wrong opponents, duplicate results and downstream results cannot bypass unresolved paths", () => {
  const base=syntheticSeason();
  const wrong=planCompetitionTransition({ ...base,qualificationResults:[result("hbl-11",at(base,L.hbl,11),at(base,L.allsvenskan,3))] });
  assert.ok(dep(wrong,"RESULT_PARTICIPANTS_MISMATCH"));
  const q=topResults(base)[0]!;
  assert.ok(dep(planCompetitionTransition({ ...base,qualificationResults:[q,q] }),"DUPLICATE_OR_EMPTY_ID"));
  const downstream=planCompetitionTransition({ ...base,qualificationResults:[topResults(base).find((x) => x.stageId === "ha-final-11")!] });
  assert.ok(dep(downstream,"RESULT_AWAITS_ENTRANTS"));
  assert.equal(downstream.qualification.find((x) => x.stageId === "ha-final-11")!.winnerClubId,undefined);
});

test("deterministic repeated and permuted inputs do not mutate frozen source data or read strength", () => {
  const base=syntheticSeason();
  const input=freeze({ ...base,qualificationResults:topResults(base) });
  const before=JSON.stringify(input), first=planCompetitionTransition(input);
  assert.deepEqual(planCompetitionTransition(input),first);
  const permuted={ ...input,clubs:[...input.clubs].reverse(),standings:[...input.standings].reverse().map((t) => ({ ...t,rows:[...t.rows].reverse(),mutualResults:[...(t.mutualResults ?? [])].reverse() })),eligibility:[...input.eligibility!].reverse(),qualificationResults:[...input.qualificationResults].reverse() };
  assert.deepEqual(planCompetitionTransition(permuted),first);
  assert.equal(JSON.stringify(input),before);
  const ratingsTrap=input.clubs.map((c) => Object.defineProperty({ ...c },"strength",{ get() { throw new Error("Strength must never be read"); } }));
  assert.deepEqual(planCompetitionTransition({ ...input,clubs:ratingsTrap }),first);
});

test("career snapshot is read-only, excludes non-league scores and ignores legacy strength-picked outcomes", () => {
  const base=syntheticSeason();
  const fixtures=base.standings.slice(0,2).flatMap((t) => t.mutualResults!.map((game,i) => ({ id:`${t.competitionId}:${i}`,competitionId:t.competitionId,round:1,date:"2027-03-01",type:"LEAGUE" as const,homeClubId:game.homeClubId,awayClubId:game.awayClubId })));
  const results=Object.fromEntries(fixtures.map((f) => [f.id,{ fixtureId:f.id,...base.standings.find((t) => t.competitionId === f.competitionId)!.mutualResults![Number(f.id.split(":").at(-1))] }]));
  const extra=(["CUP","FRIENDLY"] as const).map((type) => ({ ...fixtures[0]!,id:`extra:${type}`,type }));
  const state=freeze({ seasonId:rules.seasonId,fixtures:[...fixtures,...extra],results:{ ...results,...Object.fromEntries(extra.map((f) => [f.id,{ fixtureId:f.id,homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeGoals:999,awayGoals:0 }])) },competitionMembership:{},seasonOutcome:{ nextMembership:{ [at(base,L.norra,1)]:L.allsvenskan } },worldSquads:{ untouched:"sentinel" },gameplayRatings:{ untouched:"sentinel" } });
  const before=JSON.stringify(state);
  const snapshot=snapshotCompetitionTransitionInput(state as unknown as CareerState,{ eligibility:base.eligibility });
  const plan=planCompetitionTransition(snapshot);
  assert.equal(snapshot.standings.length,2);
  assert.deepEqual(snapshot.standings[0]!.rows,base.standings[0]!.rows);
  assert.ok(dep(plan,"MISSING_STANDINGS"));
  assert.ok(!plan.directPromotions.some((m) => m.fromCompetitionId === L.norra));
  assert.equal(JSON.stringify(state),before);
  assert.ok(!("seasonOutcome" in snapshot));
  const badCalendar={ ...state,fixtures:state.fixtures.slice(1) };
  assert.equal(snapshotCompetitionTransitionInput(badCalendar as unknown as CareerState).standings[0]!.completed,false);
});

function tiePair(base: PlannerInput, competitionId: string, firstRank: number): PlannerInput {
  return { ...base,standings:base.standings.map((t) => {
    if (t.competitionId !== competitionId) return t;
    const a=t.rows[firstRank-1]!, b=t.rows[firstRank]!;
    const averaged={ played:a.played, won:(a.won+b.won)/2, drawn:(a.drawn+b.drawn)/2, lost:(a.lost+b.lost)/2, goalsFor:(a.goalsFor+b.goalsFor)/2, goalsAgainst:(a.goalsAgainst+b.goalsAgainst)/2, goalDifference:(a.goalDifference+b.goalDifference)/2, points:(a.points+b.points)/2 };
    return { ...t,mutualResults:[],rows:t.rows.map((row,i) => i === firstRank-1 || i === firstRank ? { clubId:row.clubId,...averaged } : row) };
  }) };
}

test("irrelevant retained ties and tied direct-relegation ranks establish destinations without a lot", () => {
  const base=syntheticSeason();
  const retained=planCompetitionTransition(tiePair(base,L.allsvenskan,6));
  assert.ok(!dep(retained,"MISSING_MUTUAL_RESULTS"));
  assert.ok(retained.remaining.some((c) => c.clubId === at(base,L.allsvenskan,6)));
  assert.ok(retained.remaining.some((c) => c.clubId === at(base,L.allsvenskan,7)));
  const relegated=planCompetitionTransition(tiePair(base,L.allsvenskan,13));
  assert.ok(!dep(relegated,"CONFLICTING_MEMBERSHIP_CLAIMS"));
  assert.equal(relegated.directRelegations.filter((c) => c.fromCompetitionId === L.allsvenskan).length,2);
  const relevant=planCompetitionTransition(tiePair(base,L.allsvenskan,1));
  assert.ok(dep(relevant,"MISSING_MUTUAL_RESULTS"));
  assert.ok(!relevant.directPromotions.some((c) => c.fromCompetitionId === L.allsvenskan));
});

test("replacement home advantage follows actual source ranks; equal ranks do not pick a group arbitrarily", () => {
  const base=syntheticSeason();
  const deny=(count:number) => ({ ...base,eligibility:base.eligibility!.map((e) => e.targetFamilyId === F.allsvenskan && [1,2,3].slice(0,count).some((rank) => at(base,L.norra,rank) === e.clubId) ? { ...e,status:"INELIGIBLE" as const } : e) });
  const equal=planCompetitionTransition(deny(1)).qualification.find((q) => q.stageId === "ha-semi-n")!;
  assert.deepEqual(equal.participants,[at(base,L.norra,3),at(base,L.sodra,3)]);
  assert.ok(equal.unresolvedFixtures.every((f) => f.homeClubId === null));
  const reversed=planCompetitionTransition(deny(2)).qualification.find((q) => q.stageId === "ha-semi-n")!;
  assert.deepEqual(reversed.participants,[at(base,L.norra,4),at(base,L.sodra,3)]);
  assert.equal(reversed.unresolvedFixtures[0]!.homeClubId,at(base,L.norra,4));
});

/** Synthetic identity fixtures ONLY for exercising the external-provider contract. Never catalog/game data. */
function completeExternalFixture(): PlannerInput {
  const base=syntheticSeason();
  const slots=rules.entries.filter((e) => e.selector.kind === "EXTERNAL");
  const externalEntrants=slots.map((e) => ({ slotId:e.id,clubId:`fixture-only:${e.id}`,evidence:"Synthetic external-provider fixture, not a real club or result." }));
  const ext=(district:string,rank:number) => `fixture-only:division2-${district}-${rank}`;
  const n9=at(base,L.norra,9), n10=at(base,L.norra,10), s9=at(base,L.sodra,9), s10=at(base,L.sodra,10);
  return { ...base,externalEntrants,
    clubs:[...base.clubs,...externalEntrants.map((e) => ({ id:e.clubId,nation:"SWE",category:"MEN" }))],
    eligibility:[...base.eligibility!,...externalEntrants.map((e) => ({ clubId:e.clubId,targetFamilyId:F.division1,seasonId:rules.seasonId,status:"ELIGIBLE" as const,evidence:"Synthetic external eligibility" }))],
    qualificationResults:[...topResults(base),
      result("d1-n-pre",ext("n",2),ext("m",2)),
      result("d1-n-semi-9",n9,ext("n",2)), result("d1-n-semi-10",n10,ext("o",2)),
      result("d1-n-final",n9,n10),
      result("d1-s-semi-v",ext("v",2),ext("s",3)), result("d1-s-semi-s",ext("s",2),ext("v",3)),
      result("d1-s-final-9",s9,ext("v",2)), result("d1-s-final-10",s10,ext("s",2)),
    ],
  };
}

test("all qualification paths resolve only with evidenced external inputs; Norra still relegates one incumbent", () => {
  const input=completeExternalFixture(), before=JSON.stringify(input), plan=planCompetitionTransition(freeze(input));
  assert.ok(plan.qualification.every((q) => q.status === "CONFIRMED" && !q.unresolvedFixtures.length));
  assert.ok(!dep(plan,"MISSING_EXTERNAL_ENTRANT"));
  assert.ok(!dep(plan,"HOME_PRIORITY_UNVERIFIED"));
  assert.equal(plan.directPromotions.length,8);
  assert.ok(plan.qualificationMovements.some((m) => m.clubId === at(input,L.norra,10) && m.toFamilyId === F.division2));
  assert.deepEqual(plan.sizes.find((s) => s.scopeId === F.division1),{ scopeId:F.division1,expected:24,confirmed:24,status:"VALID" });
  assert.equal(plan.clubs.length,64);
  assert.ok(plan.clubs.every((c) => c.status === "CONFIRMED"));
  assert.equal(plan.status,"UNRESOLVED"); // Group allocation, boundary destinations and future regulations remain explicit.
  assert.equal(JSON.stringify(input),before);
});

test("explicit group allocations validate counts; an overloaded group is blocked without auto-balancing", () => {
  const input=completeExternalFixture(), plan=planCompetitionTransition(input);
  const division1=[...plan.remaining,...plan.directRelegations,...plan.directPromotions,...plan.qualificationMovements].filter((c) => c.toFamilyId === F.division1);
  const groupAllocations=division1.map((c,i) => ({ clubId:c.clubId,competitionId:i < 12 ? L.norra : L.sodra,evidence:"Synthetic organizer allocation, not official geographic data" }));
  const allocated=planCompetitionTransition({ ...input,groupAllocations });
  assert.ok(allocated.sizes.filter((s) => [L.norra,L.sodra].includes(s.scopeId as typeof L.norra)).every((s) => s.status === "VALID" && s.confirmed === 12));
  const overloaded=planCompetitionTransition({ ...input,groupAllocations:groupAllocations.map((a) => ({ ...a,competitionId:L.norra })) });
  assert.ok(dep(overloaded,"GROUP_SIZE_MISMATCH"));
  assert.equal(overloaded.status,"BLOCKED");
});

test("unsupported graph policies, ambiguous decisions, unknown identities and contradictory mutual totals are rejected", () => {
  const base=syntheticSeason(), table=base.standings[0]!;
  const invalid: [PlannerInput,string][] = [
    [{ ...base,rules:{ ...rules,stages:[...rules.stages].reverse() } },"INVALID_QUALIFICATION_GRAPH"],
    [{ ...base,rules:{ ...rules,stages:rules.stages.map((s,i) => i ? s : { ...s,loserFamilyId:F.division2 }) } },"INVALID_DIVISION_BOUNDARY"],
    [{ ...base,standings:base.standings.map((t,i) => i ? t : { ...t,rankingDecisions:[{ kind:"ORGANIZER_RULING",orderedClubIds:table.rows.slice(0,2).map((r) => r.clubId),evidence:"not a tied group" }] }) },"INVALID_RANKING_DECISION"],
    [{ ...base,standings:base.standings.map((t,i) => i ? t : { ...t,rows:t.rows.map((row,j) => j ? row : { ...row,clubId:"missing-canonical-id" }) }) },"INVALID_CLUB_IDENTITY"],
    [{ ...base,standings:base.standings.map((t,i) => i ? t : { ...t,mutualResults:t.mutualResults!.map((g,j) => j ? g : { ...g,homeGoals:999 }) }) },"MUTUAL_TOTALS_MISMATCH"],
  ];
  for (const [input,code] of invalid) assert.ok(dep(planCompetitionTransition(input),code),code);
});
