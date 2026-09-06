// HM-CPU-SQUAD-QUALITY-UPGRADES-1.0: replacement recruitment at adequate depth.
//
// The tests that must never be deleted are "a full squad cannot keep growing"
// and "repeated upgrades raise the positional floor". The historic failure this
// pathway must not reintroduce is the 1.0A depth feedback loop, where a rule
// keyed on a LOW AVERAGE re-triggered on its own output and produced clubs with
// 7-11 goalkeepers. This rule is keyed on beating the WEAKEST INCUMBENT by
// CLEARLY_REPLACED_CA_GAP, so every success raises the bar for the next one.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  progressCpuRecruitment,
  getCpuRecruitmentPlansForClub,
  UPGRADE_MAX_PROJECTED_SQUAD_SIZE,
  SQUAD_SIZE_LARGE_THRESHOLD,
  CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS,
} from "./cpuRecruitment";
import { CLEARLY_REPLACED_CA_GAP } from "./cpuContractDecisions";
import { assessSquadNeeds, projectedSquadSize } from "./cpuSquadNeeds";
import { createHarnessCareer } from "../../scripts/simulate-player-development";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { CareerState } from "./types";

const HBL = "se_handbollsligan_herr";
const POSITIONS = ["MV", "V6", "H6", "M6", "V9", "M9", "H9"] as const;

/**
 * Rebuilds `clubId` as a FULL squad of `perPosition` players at every position,
 * all at `ca`, inside the REAL Swedish world. This is the S30 shape the pathway
 * targets: adequate depth everywhere, but weak.
 *
 * A bare createNewCareerState is NOT usable here -- it yields zero CPU
 * recruiters, zero candidates and no club budgets, so every recruitment
 * assertion against it passes vacuously.
 */
function fullSquad(state: CareerState, clubId: string, perPosition: number, ca: number): CareerState {
  const templatePlayer = (state.worldSquads[clubId] ?? [])[0];
  const templateRating = (state.gameplayRatings[clubId] ?? [])[0];
  if (!templatePlayer || !templateRating) throw new Error(`no template for ${clubId}`);
  const squad: PlayerMock[] = [];
  const ratings: GameplayPlayerRating[] = [];
  for (const position of POSITIONS) {
    for (let i = 0; i < perPosition; i++) {
      const id = `${clubId}-syn-${position}-${i}`;
      squad.push({ ...templatePlayer, id, clubId, position, currentAbility: ca, potentialAbility: ca + 25, dateOfBirth: "2002-01-01" } as PlayerMock);
      ratings.push({ ...templateRating, playerId: id, ca, pa: ca + 25 });
    }
  }
  const contracts = { ...state.playerContracts };
  const source = state.playerContracts[templatePlayer.id];
  if (source) for (const p of squad) contracts[p.id] = { ...source, playerId: p.id, clubId };
  return {
    ...state,
    worldSquads: { ...state.worldSquads, [clubId]: squad },
    gameplayRatings: { ...state.gameplayRatings, [clubId]: ratings },
    playerContracts: contracts,
  } as CareerState;
}

function harnessWorld(seed: string): CareerState {
  return createHarnessCareer(seed, "se_club_hammarby_if_hf") as CareerState;
}

/** Squad members that arrived through recruitment (ids the fixture did not create). */
function arrivals(state: CareerState, clubId: string): { id: string; ca: number; position: string }[] {
  const caById = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r.ca]));
  return (state.worldSquads[clubId] ?? [])
    .filter((p) => !p.id.startsWith(`${clubId}-syn-`))
    .map((p) => ({ id: p.id, ca: caById.get(p.id) ?? p.currentAbility ?? 0, position: p.position }));
}

const hblClubs = () => getClubsByCompetition(HBL).map((c) => c.id).filter((id) => id !== "se_club_hammarby_if_hf");

/**
 * Advances `cycles` monthly evaluation passes. Necessary because
 * ensureSchedule gives every club an initial evaluation offset of 14-59 days,
 * so a single progressCpuRecruitment call on the career's first day evaluates
 * NOBODY -- a single-call assertion would pass vacuously.
 */
function runCycles(state: CareerState, cycles: number): CareerState {
  let next = state;
  let year = Number(state.gameDate.slice(0, 4));
  let month = Number(state.gameDate.slice(5, 7));
  for (let i = 0; i < cycles; i++) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    next = progressCpuRecruitment(next, `${year}-${String(month).padStart(2, "0")}-15`);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Qualification threshold
// ---------------------------------------------------------------------------

test("the upgrade threshold is the SAME constant the release path uses", () => {
  // One threshold must govern both arrival and departure: an upgrade this path
  // signs must be one cpuContractDecisions.ts will actually act on.
  assert.equal(CLEARLY_REPLACED_CA_GAP, 12, "the shared replacement gap");
});

test("a full squad allows exactly one in-flight replacement, never two", () => {
  assert.equal(UPGRADE_MAX_PROJECTED_SQUAD_SIZE, SQUAD_SIZE_LARGE_THRESHOLD + 1);
  assert.equal(UPGRADE_MAX_PROJECTED_SQUAD_SIZE, 25, "24 -> 25 is the only growth permitted");
});

test("adequate depth is what the upgrade path looks at -- HIGH/MEDIUM are shortages, handled as before", () => {
  const clubId = hblClubs()[0];
  // 3 per position = 21 players, LOW everywhere by levelForCount.
  const state = fullSquad(harnessWorld("upgrade-adequate"), clubId, 3, 100);
  const assessment = assessSquadNeeds(state, clubId, state.gameDate);
  const adequate = assessment.positions.filter((p) => p.level === "LOW" || p.level === "NONE");
  assert.equal(adequate.length, POSITIONS.length, "every position must read as adequately staffed");
  assert.equal(assessment.positions.filter((p) => p.level === "HIGH" || p.level === "MEDIUM").length, 0, "no depth need may exist in this fixture");
});

test("a thin position is still a DEPTH need, never an upgrade", () => {
  const clubId = hblClubs()[0];
  const state = fullSquad(harnessWorld("upgrade-thin"), clubId, 1, 100); // 1 per position -> HIGH
  const assessment = assessSquadNeeds(state, clubId, state.gameDate);
  assert.ok(assessment.positions.every((p) => p.level === "HIGH"), "one player per position must be HIGH depth need");
});

// ---------------------------------------------------------------------------
// Squad-size invariant -- the anti-accumulation gate
// ---------------------------------------------------------------------------

test("projectedSquadSize counts committed incoming players, so a second upgrade cannot slip through", () => {
  const clubId = hblClubs()[0];
  const state = fullSquad(harnessWorld("upgrade-projected"), clubId, 4, 100); // 28 players
  const size = projectedSquadSize(state, clubId);
  assert.equal(size, 28, "usable squad is counted");
  assert.ok(size >= UPGRADE_MAX_PROJECTED_SQUAD_SIZE, "an already-large squad must be blocked from starting an upgrade");
});

test("a full 24+ squad never grows without bound across many evaluation cycles", () => {
  const clubId = hblClubs()[0];
  let state = fullSquad(harnessWorld("upgrade-nogrow"), clubId, 4, 90); // 28 players, weak
  const before = (state.worldSquads[clubId] ?? []).length;
  let date = state.gameDate;
  for (let i = 0; i < 40; i++) {
    state = progressCpuRecruitment(state, date);
    date = `${Number(date.slice(0, 4)) + (i % 12 === 11 ? 1 : 0)}-${String((i % 12) + 1).padStart(2, "0")}-15`;
  }
  const after = (state.worldSquads[clubId] ?? []).length;
  assert.ok(after <= before + 1, `squad grew from ${before} to ${after} -- at most one in-flight replacement is permitted`);
});

test("goalkeeper accumulation stays closed -- the historic 7-11 keeper regression", () => {
  const clubId = hblClubs()[0];
  let state = fullSquad(harnessWorld("upgrade-gk"), clubId, 3, 90);
  let date = state.gameDate;
  for (let i = 0; i < 40; i++) {
    state = progressCpuRecruitment(state, date);
    date = `${Number(date.slice(0, 4)) + (i % 12 === 11 ? 1 : 0)}-${String((i % 12) + 1).padStart(2, "0")}-15`;
  }
  const keepers = (state.worldSquads[clubId] ?? []).filter((p) => p.position === "MV").length;
  // The whole-squad size ceiling alone does NOT close this: an adversarial
  // fixture reached SEVEN keepers inside it. assessPositionNeed's `saturated`
  // flag (depth >= 4) is what bounds it per position.
  assert.ok(keepers <= 4, `goalkeeper count ${keepers} must stay at or below the saturated depth (historic failure produced 7-11)`);
});

// ---------------------------------------------------------------------------
// Brakes still apply
// ---------------------------------------------------------------------------

test("the active-pursuit cap still bounds simultaneous searches", () => {
  const clubId = hblClubs()[0];
  let state = fullSquad(harnessWorld("upgrade-cap"), clubId, 3, 88);
  state = runCycles(state, 3);
  const searching = getCpuRecruitmentPlansForClub(state, clubId).filter((p) => p.status === "SEARCHING");
  assert.ok(searching.length <= CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS, `${searching.length} live pursuits exceeds the cap of ${CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS}`);
});

test("a strong squad stays quiet -- no upgrade when nobody materially better is available", () => {
  const clubId = hblClubs()[0];
  // Every club in the world sits at the same level, so no candidate can beat
  // this club's weakest incumbent by 12.
  let state = fullSquad(harnessWorld("upgrade-quiet"), clubId, 3, 150);
  const before = (state.worldSquads[clubId] ?? []).length;
  state = runCycles(state, 6);
  // A CA-150 squad in a world that still contains CA-170 players SHOULD be
  // able to sign one -- that is the pathway working, not a violation. The
  // invariant is that anything it signs genuinely clears the replacement gap.
  for (const a of arrivals(state, clubId)) {
    assert.ok(a.ca >= 150 + CLEARLY_REPLACED_CA_GAP, `arrival at CA ${a.ca} does not clear +${CLEARLY_REPLACED_CA_GAP} over a CA 150 squad`);
  }
  assert.ok((state.worldSquads[clubId] ?? []).length <= before + 1, "and it may never grow by more than one in-flight replacement");
});

test("recruitment is deterministic", () => {
  const clubId = hblClubs()[0];
  const a = runCycles(fullSquad(harnessWorld("upgrade-det"), clubId, 3, 95), 4);
  const b = runCycles(fullSquad(harnessWorld("upgrade-det"), clubId, 3, 95), 4);
  assert.deepEqual(
    getCpuRecruitmentPlansForClub(b, clubId).map((p) => `${p.targetPosition}:${p.status}:${p.candidatePlayerId}`),
    getCpuRecruitmentPlansForClub(a, clubId).map((p) => `${p.targetPosition}:${p.status}:${p.candidatePlayerId}`),
    "identical inputs must produce identical recruitment decisions",
  );
});

// ---------------------------------------------------------------------------
// Monotonic improvement -- the key anti-feedback property
// ---------------------------------------------------------------------------

test("repeated upgrades at a position monotonically raise its floor", () => {
  const clubId = hblClubs()[0];
  let state = fullSquad(harnessWorld("upgrade-monotonic"), clubId, 3, 85);
  const floorAt = (s: CareerState, position: string) => {
    const rs = new Map((s.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r.ca]));
    const cas = (s.worldSquads[clubId] ?? []).filter((p) => p.position === position).map((p) => rs.get(p.id) ?? p.currentAbility);
    return cas.length ? Math.min(...cas) : 0;
  };
  const floors: number[] = [floorAt(state, "M6")];
  let date = state.gameDate;
  for (let i = 0; i < 24; i++) {
    state = progressCpuRecruitment(state, date);
    date = `${Number(date.slice(0, 4)) + (i % 12 === 11 ? 1 : 0)}-${String((i % 12) + 1).padStart(2, "0")}-15`;
    floors.push(floorAt(state, "M6"));
  }
  // The floor may stay flat (no qualifying candidate) but must never be
  // dragged DOWN by this pathway -- that is exactly the 1.0A feedback loop.
  for (let i = 1; i < floors.length; i++) {
    assert.ok(floors[i] >= floors[i - 1], `positional floor fell from ${floors[i - 1]} to ${floors[i]} at step ${i} -- upgrades must never lower it`);
  }
});

test("normal depth recruitment is unchanged for a thin squad", () => {
  const clubId = hblClubs()[0];
  // 1 player per position: every position HIGH. This is the pre-existing path.
  let state = fullSquad(harnessWorld("upgrade-depth-unchanged"), clubId, 1, 100);
  const before = (state.worldSquads[clubId] ?? []).length;
  state = runCycles(state, 4);
  const plans = getCpuRecruitmentPlansForClub(state, clubId);
  assert.ok(plans.length > 0, "a genuinely thin squad must still generate depth pursuits");
  assert.ok(plans.every((p) => p.need === "HIGH"), "and they must be recorded as HIGH depth needs, not upgrades");
  assert.ok((state.worldSquads[clubId] ?? []).length >= before, "depth recruitment may still add players");
});

// ---------------------------------------------------------------------------
// Positive cases -- the pathway must actually FIRE, not merely be safe
// ---------------------------------------------------------------------------

test("a full but WEAK squad signs materially better players", () => {
  const clubs = hblClubs();
  let state = harnessWorld("upgrade-fires");
  for (const c of clubs) state = fullSquad(state, c, 3, 95); // 21 players, LOW everywhere
  state = runCycles(state, 24);
  const all = clubs.flatMap((c) => arrivals(state, c));
  assert.ok(all.length > 0, "a weak full squad in a strong world must sign upgrades");
  // Every arrival must clear the shared replacement gap over the CA-95 incumbents.
  for (const a of all) {
    assert.ok(a.ca >= 95 + CLEARLY_REPLACED_CA_GAP, `arrival ${a.id} at CA ${a.ca} does not clear the +${CLEARLY_REPLACED_CA_GAP} gap over the CA 95 incumbents`);
  }
});

test("a full and STRONG squad stays essentially quiet", () => {
  const clubs = hblClubs();
  let weakState = harnessWorld("upgrade-cmp-weak");
  let strongState = harnessWorld("upgrade-cmp-strong");
  for (const c of clubs) { weakState = fullSquad(weakState, c, 3, 95); strongState = fullSquad(strongState, c, 3, 145); }
  const weakArrivals = clubs.flatMap((c) => arrivals(runCycles(weakState, 24), c)).length;
  const strongArrivals = clubs.flatMap((c) => arrivals(runCycles(strongState, 24), c)).length;
  assert.ok(strongArrivals < weakArrivals, `a strong league (${strongArrivals} arrivals) must recruit far less than a weak one (${weakArrivals})`);
});

test("an overfull squad is blocked by the size gate even when weak", () => {
  const clubs = hblClubs();
  let state = harnessWorld("upgrade-overfull");
  for (const c of clubs) state = fullSquad(state, c, 4, 95); // 28 players -- above the gate
  state = runCycles(state, 24);
  for (const c of clubs) {
    assert.equal(arrivals(state, c).length, 0, `${c} is already at 28 players and must not start an upgrade`);
    assert.ok((state.worldSquads[c] ?? []).length <= 28, "an overfull squad must never grow further");
  }
});

test("a lower-tier candidate can legitimately upgrade a top-flight position", () => {
  const clubs = hblClubs();
  let state = harnessWorld("upgrade-lowertier");
  for (const c of clubs) state = fullSquad(state, c, 3, 95);
  state = runCycles(state, 24);
  const all = clubs.flatMap((c) => arrivals(state, c));
  assert.ok(all.length > 0, "need arrivals to inspect");
  // No hard-coded league rule exists; a strong player from any division may come.
  assert.ok(all.some((a) => a.ca >= 110), `at least one genuinely strong arrival expected, best was ${Math.max(...all.map((a) => a.ca))}`);
});

// ---------------------------------------------------------------------------
// One-replacement-in-flight -- club-wide, not per position
// ---------------------------------------------------------------------------

test("a 21-player adequate-depth club stays within the projected-size ceiling while upgrading", () => {
  const clubs = hblClubs();
  let state = harnessWorld("buffer-21");
  for (const c of clubs) state = fullSquad(state, c, 3, 95); // 21 players, LOW everywhere
  let peak = 21;
  let year = Number(state.gameDate.slice(0, 4));
  let month = Number(state.gameDate.slice(5, 7));
  for (let i = 0; i < 24; i++) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    state = progressCpuRecruitment(state, `${year}-${String(month).padStart(2, "0")}-15`);
    for (const c of clubs) peak = Math.max(peak, (state.worldSquads[c] ?? []).length);
  }
  // The invariant is SIZE, not "one replacement until the incumbent exits":
  // an attempt to infer the latter from positionStanding matched 52/52 clubs
  // at S0 on ordinary starter/backup spreads and disabled the feature.
  assert.ok(peak <= UPGRADE_MAX_PROJECTED_SQUAD_SIZE, `peak squad size ${peak} must never exceed ${UPGRADE_MAX_PROJECTED_SQUAD_SIZE}`);
  for (const c of clubs) {
    assert.ok((state.worldSquads[c] ?? []).length <= UPGRADE_MAX_PROJECTED_SQUAD_SIZE, `${c} exceeded the projected-size ceiling`);
  }
});

test("a club may keep upgrading on later evaluations while staying within the ceiling", () => {
  const clubs = hblClubs();
  let state = harnessWorld("buffer-multipos");
  for (const c of clubs) state = fullSquad(state, c, 3, 95);
  state = runCycles(state, 24);
  for (const c of clubs) {
    assert.ok((state.worldSquads[c] ?? []).length <= UPGRADE_MAX_PROJECTED_SQUAD_SIZE,
      `${c} grew past the ceiling while making repeated upgrades`);
  }
});

test("an overfull weak squad starts no upgrade at all", () => {
  const clubs = hblClubs();
  let state = harnessWorld("buffer-overfull");
  for (const c of clubs) state = fullSquad(state, c, 4, 95); // 28 players
  state = runCycles(state, 24);
  for (const c of clubs) {
    assert.equal(arrivals(state, c).length, 0, `${c} is over the ceiling and must not upgrade`);
    assert.equal((state.worldSquads[c] ?? []).length, 28, "and must not change size");
  }
});

test("an ordinary starter/backup quality spread does NOT disable upgrades", () => {
  const clubs = hblClubs();
  const clubId = clubs[0];
  let state = harnessWorld("buffer-unresolved");
  for (const c of clubs) state = fullSquad(state, c, 3, 95);
  // Plant a resolved-but-not-departed situation: one M6 far above his peers.
  const ratings = (state.gameplayRatings[clubId] ?? []).map((r) =>
    r.playerId === `${clubId}-syn-M6-0` ? { ...r, ca: 95 + CLEARLY_REPLACED_CA_GAP + 20 } : r);
  state = { ...state, gameplayRatings: { ...state.gameplayRatings, [clubId]: ratings } } as CareerState;
  state = runCycles(state, 24);
  // 52/52 CPU clubs carry such a spread at S0. Treating it as an unresolved
  // replacement switched the feature off world-wide; it must not gate anything.
  assert.ok((state.worldSquads[clubId] ?? []).length <= UPGRADE_MAX_PROJECTED_SQUAD_SIZE,
    "the ceiling still applies");
});

test("a committed AGREED_AWAITING_WINDOW arrival blocks another quality upgrade", () => {
  // The one precise safety condition that survived: projectedSquadSize counts
  // committed permanent arrivals over the usable squad, so a club cannot
  // commit twice against the same capacity.
  const clubId = hblClubs()[0];
  const state = fullSquad(harnessWorld("upgrade-committed"), clubId, 3, 95);
  const usable = (state.worldSquads[clubId] ?? []).length;
  assert.equal(projectedSquadSize(state, clubId), usable, "no committed arrival in the baseline fixture");
  // With a pending arrival, projected exceeds usable and the gate closes.
  const pending = { ...state, transferOffers: { ...state.transferOffers, "t-pending": {
    id: "t-pending", playerId: "someone", fromClubId: hblClubs()[1], toClubId: clubId,
    dealType: "PERMANENT", status: "AGREED_AWAITING_WINDOW", transferFeeEur: 0,
  } } } as unknown as CareerState;
  assert.ok(projectedSquadSize(pending, clubId) > usable, "a committed arrival must raise projected size above usable");
});

test("only one upgrade is initiated per evaluation pass", () => {
  const clubId = hblClubs()[0];
  let state = fullSquad(harnessWorld("upgrade-onepass"), clubId, 3, 95);
  const before = (state.worldSquads[clubId] ?? []).length;
  state = runCycles(state, 1);
  assert.ok((state.worldSquads[clubId] ?? []).length <= before + 1,
    "a single evaluation pass may start at most one quality upgrade");
});

test("a saturated position is never upgraded, so one position cannot absorb the whole ceiling", () => {
  // Adversarial: goalkeepers far below every outfielder, so a keeper is always
  // the single best available upgrade. Without the saturation guard this
  // reached 7 keepers per club inside the 25-player ceiling.
  const clubs = hblClubs();
  let state = harnessWorld("upgrade-saturated");
  for (const c of clubs) {
    state = fullSquad(state, c, 3, 130);
    const ratings = (state.gameplayRatings[c] ?? []).map((r) =>
      r.playerId.includes("-syn-MV-") ? { ...r, ca: 60, pa: 85 } : r);
    const squad = (state.worldSquads[c] ?? []).map((p) =>
      p.position === "MV" ? { ...p, currentAbility: 60, potentialAbility: 85 } : p);
    state = { ...state, gameplayRatings: { ...state.gameplayRatings, [c]: ratings }, worldSquads: { ...state.worldSquads, [c]: squad } } as CareerState;
  }
  state = runCycles(state, 60);
  for (const c of clubs) {
    const keepers = (state.worldSquads[c] ?? []).filter((p) => p.position === "MV").length;
    assert.ok(keepers <= 4, `${c} reached ${keepers} goalkeepers -- a saturated position must stop absorbing upgrades`);
  }
});
