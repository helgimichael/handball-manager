// Club Identity C4.1 -- owner decision: "A HUMAN PLAYER CAN NEVER MANAGE OR SELECT A B-TEAM."
// Every human entry point (New Game, apply, offers, takeover, continue/load) refuses a B-team;
// CPU B-teams keep operating; U-teams, farm clubs and partner associations are not B-teams.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../career/worldCompetitions";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { ensureBoard } from "../board/board";
import { competitionClubIds } from "../competition/tables";
import { getOrCreateCareerState } from "../career/careerInitialization";
import type { CareerSave } from "../save/saveRepository";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { CLUBS, getClub, isBTeam, isHumanManageable } from "../game-data";
import { acceptJobOffer, clubChangeBlocker } from "./changeClub";
import { applyForJob, B_TEAM_CPU_ONLY, eligibleClubs, ensureManagerCareer, managedClubId, openVacancies, releaseManagerFromBTeam } from "./managerCareer";

const SHOF = "se_club_hk_s_hof", HP_ALINGSAS = "se_club_hp_alingsas", HK_CLIFF = "se_club_hk_cliff", IF_KRI = "se_club_if_kristianstad", TUMBA = "swe2-tumba";
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

let world: { squads: Parameters<typeof createNewCareerState>[2]; ratings: Parameters<typeof createNewCareerState>[4]; staff: Parameters<typeof createNewCareerState>[5] } | undefined;
function career(clubId = TUMBA, seed = "b-team-human"): CareerState {
  world ??= {
    squads: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotWorldSquads(c))),
    ratings: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotGameplayRatings(c))),
    staff: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotAllClubsStaff(c))),
  };
  // createNewCareerState is the fixture builder (not a human entry point): it can still build a B-team career, i.e. the shape of an older save.
  const s = createNewCareerState(seed, clubId, world.squads, undefined, world.ratings, world.staff);
  return ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate));
}
const withVacancy = (s: CareerState, clubId: string): CareerState => ({ ...s, managerCareer: { ...s.managerCareer!, vacancies: [...s.managerCareer!.vacancies, { clubId, openedOn: s.gameDate, closesOn: "2027-06-30", reason: "test" }] } });
const withOffer = (s: CareerState, clubId: string): CareerState => ({ ...s, managerCareer: { ...s.managerCareer!, offers: { ...s.managerCareer!.offers, [`offer:${clubId}`]: { id: `offer:${clubId}`, clubId, offeredOn: s.gameDate, expiresOn: "2027-06-30", wageEurPerMonth: 3000, years: 2, source: "APPROACH", pitch: "test", status: "OPEN" } } } });

test("B-team classification: second teams only; U-teams, farm clubs and partner associations stay human-manageable", () => {
  assert.equal(isBTeam(SHOF), true);
  assert.equal(isBTeam(HP_ALINGSAS), true);
  assert.equal(isHumanManageable(SHOF), false);
  assert.equal(isHumanManageable(HP_ALINGSAS), false);
  for (const id of [HK_CLIFF, IF_KRI, TUMBA]) assert.equal(isHumanManageable(id), true, `${id} is not a B-team`);
  assert.equal(isHumanManageable("no-such-club"), false);
  const bTeams = CLUBS.filter((c) => isBTeam(c.id)).map((c) => c.id);
  assert.ok(bTeams.length >= 3, "Division 1 and Division 2 second teams are classified");
  for (const id of bTeams) assert.ok(getClub(id)!.relations!.some((r) => ["SECOND_TEAM", "SAME_CLUB_SECOND_TEAM", "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION"].includes(r.relation)));
});

test("17. a human manager cannot select a B-team: New Game refuses it before anything is fetched or written; every selection list filters it", async () => {
  await assert.rejects(getOrCreateCareerState({ saveId: "t", clubId: SHOF, seed: "x" } as unknown as CareerSave, false), new RegExp(B_TEAM_CPU_ONLY));
  await assert.rejects(getOrCreateCareerState({ saveId: "t", clubId: HP_ALINGSAS, seed: "x" } as unknown as CareerSave, false), new RegExp(B_TEAM_CPU_ONLY));
  const newGame = readFileSync(at("../../app/new-game/page.tsx"), "utf8");
  assert.ok((newGame.match(/isHumanManageable/g) ?? []).length >= 4, "playable list, world list, selected club and per-league count are filtered");
  assert.match(readFileSync(at("../../app/page.tsx"), "utf8"), /FEATURED_CLUBS[\s\S]{0,200}isHumanManageable/);
});

test("18-19. B-teams never appear as jobs, cannot be applied for, and a B-team offer cannot be accepted (CPU B-teams keep operating)", () => {
  const s = career();
  const all = [...new Set(["se_division1_norra", "se_division1_sodra"].flatMap((c) => competitionClubIds(s, c)))];
  assert.ok(all.includes(SHOF) && all.includes(HP_ALINGSAS), "B-teams still play in the CPU world");
  assert.ok((s.worldSquads[SHOF] ?? []).length > 0, "the CPU B-team keeps its squad");
  const eligible = eligibleClubs(s);
  assert.ok(eligible.length > 20);
  for (const id of eligible) assert.equal(isBTeam(id, s.seasonId), false, `${id} offered to a human`);
  const v = withVacancy(withVacancy(s, SHOF), HK_CLIFF);
  assert.equal(openVacancies(v).some((x) => x.clubId === SHOF), false, "a B-team vacancy is never shown");
  assert.throws(() => applyForJob(v, SHOF), new RegExp(B_TEAM_CPU_ONLY));
  assert.equal(clubChangeBlocker(s, SHOF), B_TEAM_CPU_ONLY);
  const offered = withOffer(s, SHOF);
  assert.throws(() => acceptJobOffer(offered, `offer:${SHOF}`), new RegExp(B_TEAM_CPU_ONLY));
  assert.equal(managedClubId(s), TUMBA, "nothing changed for the manager");
});

test("20. an existing save whose manager leads a B-team is recovered safely: neutral release, history and club intact, idempotent", () => {
  const legacy = career(HP_ALINGSAS, "b-team-legacy");
  assert.equal(managedClubId(legacy), HP_ALINGSAS);
  const events: CareerEvent[] = [];
  const released = releaseManagerFromBTeam(legacy, legacy.gameDate, (e) => events.push(e));
  assert.equal(managedClubId(released), undefined, "no longer the B-team's manager");
  assert.equal(released.managerCareer!.seekingJob!.reason, "CONTRACT_ENDED", "neutral, not a dismissal");
  assert.equal(released.managerCareer!.seekingJob!.clubId, HP_ALINGSAS);
  const stint = released.managerCareer!.stints.find((st) => st.clubId === HP_ALINGSAS)!;
  assert.equal(stint.leftReason, "CONTRACT_ENDED");
  assert.equal(released.playerClubId, HP_ALINGSAS, "the save keeps its club reference (interim runs it)");
  assert.deepEqual(released.worldSquads[HP_ALINGSAS], legacy.worldSquads[HP_ALINGSAS], "nothing is deleted");
  assert.deepEqual(released.fixtures, legacy.fixtures, "results and fixtures untouched");
  assert.ok(events.some((e) => e.id.startsWith(`MANAGER_CAREER:b-team-release:${HP_ALINGSAS}`)), "the manager is told why");
  for (const id of eligibleClubs(released)) assert.equal(isBTeam(id), false);
  assert.equal(releaseManagerFromBTeam(released, released.gameDate, () => assert.fail("no second release")), released, "idempotent");
  const ordinary = career();
  assert.equal(releaseManagerFromBTeam(ordinary, ordinary.gameDate, () => assert.fail("no release")), ordinary, "ordinary careers untouched");
  // The load path (Continue / load game) runs the recovery; career creation from a fixture does not.
  const init = readFileSync(at("../career/careerInitialization.ts"), "utf8");
  assert.match(init, /releaseManagerFromBTeam\(migrated, migrated\.gameDate/);
});
