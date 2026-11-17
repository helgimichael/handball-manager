// HM-TRANSFER-REALISM M8A: international youth intake, and the world rules
// (development, ageing, retirement) now reaching world-pool players.
import test from "node:test";
import assert from "node:assert/strict";
import { createFullWorldCareer } from "../../scripts/lib/fullWorldCareer";
import { INTERNATIONAL_YOUTH_SQUAD_CAPACITY, internationalIntakeSize, internationalProspectCA, internationalProspectPA, progressInternationalYouthIntake } from "./internationalYouthIntake";
import { INTERNATIONAL_SQUAD_CAPACITY } from "../transfers/careerDecision/stateAdapter";
import { clubLeagueId, leagueLevelOf } from "../transfers/careerDecision/sportingStrength";
import { worldPoolCareerClubIds } from "./careerWorld";
import { progressWorldDevelopment } from "./worldDevelopment";
import { progressPlayerLifecycle } from "./playerLifecycle";
import { getPlayerContract } from "../economy/contractIntegration";
import { getCareerPlayer } from "./careerWorld";
import type { CareerState } from "./types";

const base = createFullWorldCareer("m8a-intake");
const levelFn = (s: CareerState) => (clubId: string) => leagueLevelOf(s, clubLeagueId(s, clubId));
const INTAKE_DATE = "2027-07-01";

test("M8A: capacity constant matches the international market's squad capacity", () => {
  assert.equal(INTERNATIONAL_YOUTH_SQUAD_CAPACITY, INTERNATIONAL_SQUAD_CAPACITY);
});

test("M8A: world-pool clubs with free slots promote prospects -- owned, contracted, unique, 18-20, CA below PA", () => {
  const { state, generated } = progressInternationalYouthIntake(base, INTAKE_DATE, levelFn(base));
  const ids = Object.values(generated).flat();
  assert.ok(ids.length > 0, "some prospects are promoted");
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  // Small, bounded volume: never more than 2 per club, never past capacity.
  for (const [clubId, list] of Object.entries(generated)) {
    assert.ok(list.length <= 2);
    assert.ok((state.worldSquads[clubId] ?? []).length <= INTERNATIONAL_YOUTH_SQUAD_CAPACITY);
  }
  for (const id of ids) {
    const player = getCareerPlayer(state, id);
    const contract = getPlayerContract(state, id);
    assert.ok(player && contract, id);
    assert.equal(contract!.clubId, player!.clubId, "one owner, one contract");
    const owners = Object.entries(state.worldSquads).filter(([, squad]) => squad.some((p) => p.id === id));
    assert.equal(owners.length, 1, "exactly one squad holds the player");
    const rating = state.gameplayRatings[player!.clubId].find((r) => r.playerId === id)!;
    assert.ok(rating.ca < rating.pa, `${id} CA ${rating.ca} < PA ${rating.pa}`);
    const age = 2027 - Number(player!.dateOfBirth!.slice(0, 4));
    assert.ok(age >= 18 && age <= 20, `age ${age}`);
  }
});

test("M8A: deterministic and idempotent (a second pass the same day adds nobody)", () => {
  const a = progressInternationalYouthIntake(base, INTAKE_DATE, levelFn(base));
  const b = progressInternationalYouthIntake(base, INTAKE_DATE, levelFn(base));
  assert.deepEqual(a.generated, b.generated);
  const again = progressInternationalYouthIntake(a.state, INTAKE_DATE, levelFn(a.state));
  assert.deepEqual(again.generated, {});
  assert.equal(progressInternationalYouthIntake(base, "2027-07-02", levelFn(base)).state, base, "only on the intake date");
});

test("M8A: a club at capacity receives nobody", () => {
  assert.equal(internationalIntakeSize("seed", "club", 2027, 0), 0);
  for (let y = 2027; y < 2060; y++) assert.ok(internationalIntakeSize("seed", "club", y, 1) <= 1);
});

test("M8A: prospect quality follows the league level and elite potential stays rare", () => {
  const sample = (level: number) => Array.from({ length: 2000 }, (_, i) => internationalProspectPA(`k${i}`, level));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const elite = sample(152);
  const minor = sample(100);
  assert.ok(mean(elite) > mean(minor) + 40, "stronger league, better prospects");
  const share = (xs: number[], t: number) => xs.filter((x) => x >= t).length / xs.length;
  assert.ok(share(elite, 160) < 0.2, `PA>=160 at an elite league: ${share(elite, 160)}`);
  assert.ok(share(elite, 160) > 0.02, "but exceptional prospects exist");
  assert.equal(share(minor, 150), 0, "a minor league does not produce world-class potential");
  for (let i = 0; i < 200; i++) {
    const pa = internationalProspectPA(`c${i}`, 140);
    const ca = internationalProspectCA(`c${i}`, pa, 18);
    assert.ok(ca <= pa && pa - ca >= 30, "a prospect is years from his potential");
  }
});

test("M8A: world-pool players now develop (monthly world pass) and are aged/evaluated (annual lifecycle)", () => {
  const poolPlayer = worldPoolCareerClubIds(base).flatMap((id) => base.worldSquads[id] ?? [])[0];
  assert.ok(poolPlayer);
  const developed = progressWorldDevelopment(base, "2026-10-01");
  assert.equal(developed.worldDevelopmentPeriods?.[poolPlayer.id], "2026-M10");
  const aged = progressPlayerLifecycle(base, "2027-06-15").state;
  assert.equal(aged.playerLifecycleYears[poolPlayer.id], "2027");
});
