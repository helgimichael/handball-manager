// HM-TRANSFER-REALISM-1.0: PCDM core -- scenarios A-E and invariants, on the
// pure model with synthetic profiles (no career state), so every number here
// is a direct consequence of the model itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProfile,
  chooseBetweenOptions,
  decide,
  evaluateCareerOption,
  moneyComponent,
  profileMemberships,
  reservationUtility,
  sportComponent,
  wageDemandFor,
  type ClubOption,
  type MarketContext,
  type ProfileInputs,
} from "./model";

// Environment levels on the PCDM scale, as measured on the real career world
// (lib/transfers/careerDecision/sportingStrength.ts): Barça/Veszprém-class
// clubs ~175, Bundesliga top ~165, Handbollsligan top ~146, mid ~138,
// Allsvenskan ~128, Division 1 ~112.
const ENV = { EURO_ELITE: 168, HBL_TOP: 146, HBL_MID: 138, ALLSVENSKAN: 128, DIV1: 112 };

function profile(overrides: Partial<ProfileInputs> = {}) {
  return buildProfile({ playerId: "p", ca: 140, pa: 145, age: 27, worldPercentile: 0.88, ambition: 11, loyalty: 10, nationality: "SWE", referenceWageEurPerMonth: 5000, ...overrides });
}

function option(overrides: Partial<ClubOption> = {}): ClubOption {
  return { clubId: "x", environmentLevel: ENV.HBL_MID, role: "FIRST_CHOICE", wageEurPerMonth: 5000, contractYears: 3, pressure: "NONE", isHomeCountry: false, isFormerClub: false, isCurrentClub: false, ...overrides };
}

const worldClass = () => profile({ playerId: "wc", ca: 188, pa: 190, age: 27, worldPercentile: 0.997, ambition: 14, referenceWageEurPerMonth: 22000, nationality: "DEN" });

function freeAgentMarket(overrides: Partial<MarketContext> = {}): MarketContext {
  return { waitLevel: 160, monthsUnattached: 0, openMarket: true, ...overrides };
}

// ---------------------------------------------------------------------------
// Scenario A: world-class player
// ---------------------------------------------------------------------------

test("A: world-class player under contract at a European elite club rejects Handbollsligan, Allsvenskan and Division 1 even for far more money", () => {
  const p = worldClass();
  const market: MarketContext = { stay: option({ clubId: "home", environmentLevel: ENV.EURO_ELITE, role: "KEY_PLAYER", wageEurPerMonth: 22000, contractYears: 2, isCurrentClub: true }), waitLevel: 160, monthsUnattached: 0, openMarket: false };
  for (const env of [ENV.HBL_TOP, ENV.ALLSVENSKAN, ENV.DIV1]) {
    for (const multiple of [1.5, 3, 6]) {
      const d = decide(p, option({ environmentLevel: env, role: "KEY_PLAYER", wageEurPerMonth: 22000 * multiple }), market);
      assert.equal(d.accept, false, `env ${env} x${multiple} must be rejected`);
    }
  }
  // ...while an equal European elite club paying more is a real option.
  assert.equal(decide(p, option({ environmentLevel: ENV.EURO_ELITE + 4, role: "KEY_PLAYER", wageEurPerMonth: 30000 }), market).accept, true);
});

test("A: the European elite option ranks above HBL, Allsvenskan and Division 1 at equal money", () => {
  const p = worldClass();
  const u = (env: number) => evaluateCareerOption(p, option({ environmentLevel: env, role: "KEY_PLAYER", wageEurPerMonth: 22000 })).utility;
  assert.ok(u(ENV.EURO_ELITE) > u(ENV.HBL_TOP));
  assert.ok(u(ENV.HBL_TOP) > u(ENV.ALLSVENSKAN));
  assert.ok(u(ENV.ALLSVENSKAN) > u(ENV.DIV1));
});

test("A: the sporting floor binds for a world-class player in Division 1 -- money cannot buy it", () => {
  const p = worldClass();
  const ev = evaluateCareerOption(p, option({ environmentLevel: ENV.DIV1, role: "KEY_PLAYER", wageEurPerMonth: 22000 * 8 }));
  assert.equal(ev.floorApplied, true);
  assert.ok(ev.contributions.money <= Math.abs(ev.contributions.sport));
});

// ---------------------------------------------------------------------------
// Scenario B: young talent
// ---------------------------------------------------------------------------

test("B: a 19-year-old talent prefers a central role in a smaller first division over the bench at a top club", () => {
  const p = profile({ playerId: "talent", ca: 118, pa: 160, age: 19, worldPercentile: 0.6, ambition: 15, referenceWageEurPerMonth: 1500 });
  const top = option({ clubId: "top", environmentLevel: ENV.EURO_ELITE, role: "SQUAD_PLAYER", wageEurPerMonth: 1800 });
  const central = option({ clubId: "central", environmentLevel: 124, role: "FIRST_CHOICE", wageEurPerMonth: 1500 });
  const devSecond = option({ clubId: "second", environmentLevel: 114, role: "KEY_PLAYER", wageEurPerMonth: 1400 });
  const { ranked } = chooseBetweenOptions(p, [top, central, devSecond], freeAgentMarket({ waitLevel: 110 }));
  assert.notEqual(ranked[0]!.option.clubId, "top", "playing time outweighs prestige for a talent");
});

test("B: a talent's development and role weights exceed his sporting and money weights", () => {
  const p = profile({ ca: 110, pa: 160, age: 19, worldPercentile: 0.5 });
  assert.ok(p.weights.role + p.weights.development > p.weights.sport + p.weights.money * 0.5);
  assert.ok(p.memberships.YOUNG_TALENT > 0.9);
});

// ---------------------------------------------------------------------------
// Scenario C: established elite player
// ---------------------------------------------------------------------------

test("C: a 27-year-old elite player balances level and salary -- a big raise wins a small step down, not a big one", () => {
  const p = profile({ ca: 146, age: 27, worldPercentile: 0.94, referenceWageEurPerMonth: 6000 });
  const market: MarketContext = { stay: option({ clubId: "home", environmentLevel: 146, role: "KEY_PLAYER", wageEurPerMonth: 6000, contractYears: 2, isCurrentClub: true }), waitLevel: 138, monthsUnattached: 0, openMarket: false };
  assert.equal(decide(p, option({ environmentLevel: 141, role: "KEY_PLAYER", wageEurPerMonth: 9500 }), market).accept, true, "small step down for +58% is acceptable");
  assert.equal(decide(p, option({ environmentLevel: ENV.DIV1, role: "KEY_PLAYER", wageEurPerMonth: 15000 }), market).accept, false, "Division 1 is not, even at 2.5x");
  assert.equal(decide(p, option({ environmentLevel: 160, role: "KEY_PLAYER", wageEurPerMonth: 6000 }), market).accept, true, "a clear step up in the same role at equal money is attractive");
  assert.equal(decide(p, option({ environmentLevel: 160, role: "FIRST_CHOICE", wageEurPerMonth: 7000 }), market).accept, true, "a clear step up with a smaller role needs a little more money");
});

// ---------------------------------------------------------------------------
// Scenario D: veteran
// ---------------------------------------------------------------------------

test("D: a 35-year-old accepts a lower league at home with better money and security", () => {
  const p = profile({ ca: 132, pa: 132, age: 35, worldPercentile: 0.82, loyalty: 13, referenceWageEurPerMonth: 7000, nationality: "SWE" });
  const market: MarketContext = { stay: option({ clubId: "abroad", environmentLevel: 150, role: "ROTATION", wageEurPerMonth: 7000, contractYears: 0.5, isCurrentClub: true }), waitLevel: 125, monthsUnattached: 0, openMarket: true };
  const home = option({ clubId: "home", environmentLevel: ENV.ALLSVENSKAN, role: "KEY_PLAYER", wageEurPerMonth: 8000, contractYears: 2, isHomeCountry: true, isFormerClub: true });
  assert.equal(decide(p, home, market, 0, true).accept, true);
  assert.ok(p.memberships.CAREER_END > 0.5);
  assert.ok(p.floorStrength < 0.1, "the sporting floor has all but dissolved");
});

// ---------------------------------------------------------------------------
// Scenario E: world-class free agent
// ---------------------------------------------------------------------------

test("E: a world-class free agent with zero recorded salary rejects every lower-level offer and waits", () => {
  const p = worldClass();
  const market = freeAgentMarket({ internationalAlternative: option({ clubId: "intl", environmentLevel: 164, role: "KEY_PLAYER", wageEurPerMonth: 22000, contractYears: 2 }) });
  const offers = [ENV.HBL_TOP, ENV.ALLSVENSKAN, ENV.DIV1].map((env, i) => option({ clubId: `o${i}`, environmentLevel: env, role: "KEY_PLAYER", wageEurPerMonth: 22000 * 3 }));
  const { choice } = chooseBetweenOptions(p, offers, market);
  assert.equal(choice, null, "nothing beats waiting / the international alternative");
  assert.equal(reservationUtility(p, market).source, "INTERNATIONAL");
});

test("E: with several offers the world-class free agent picks the strongest sporting environment", () => {
  const p = worldClass();
  const offers = [option({ clubId: "div1", environmentLevel: ENV.DIV1, wageEurPerMonth: 60000, role: "KEY_PLAYER" }), option({ clubId: "elite", environmentLevel: 170, wageEurPerMonth: 22000, role: "KEY_PLAYER" }), option({ clubId: "hbl", environmentLevel: ENV.HBL_TOP, wageEurPerMonth: 40000, role: "KEY_PLAYER" })];
  assert.equal(chooseBetweenOptions(p, offers, freeAgentMarket()).choice?.clubId, "elite");
});

test("E: waiting gets more expensive -- a long-unattached player eventually accepts a reasonable step down", () => {
  const p = profile({ ca: 150, age: 30, worldPercentile: 0.96, referenceWageEurPerMonth: 7000 });
  const offer = option({ environmentLevel: 131, role: "KEY_PLAYER", wageEurPerMonth: 7000, contractYears: 2 });
  assert.equal(decide(p, offer, freeAgentMarket({ waitLevel: 150, monthsUnattached: 0 })).accept, false);
  assert.equal(decide(p, offer, freeAgentMarket({ waitLevel: 150, monthsUnattached: 14 })).accept, true);
});

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

test("invariant: a free agent with zero recorded salary never auto-accepts -- the reference wage is never 0", () => {
  const p = buildProfile({ playerId: "fa", ca: 150, pa: 150, age: 27, worldPercentile: 0.96, ambition: 10, loyalty: 10, nationality: "SWE", referenceWageEurPerMonth: 0 });
  assert.ok(p.referenceWageEurPerMonth >= 200);
  const lowball = option({ environmentLevel: ENV.DIV1, role: "KEY_PLAYER", wageEurPerMonth: 150 });
  assert.equal(decide(p, lowball, freeAgentMarket({ waitLevel: 140 })).accept, false);
});

test("invariant: higher sporting quality never reduces sporting utility (and never reduces total utility at fixed role)", () => {
  for (const ca of [80, 120, 150, 190]) {
    let prevSport = -Infinity;
    let prevU = -Infinity;
    const p = profile({ ca, pa: ca + 10, worldPercentile: Math.min(0.999, ca / 200), age: 26 });
    for (let env = 60; env <= 200; env += 2) {
      const s = sportComponent(env, ca);
      const u = evaluateCareerOption(p, option({ environmentLevel: env, role: "FIRST_CHOICE", wageEurPerMonth: 20000 })).utility;
      assert.ok(s >= prevSport - 1e-12, `sport monotone at ca ${ca} env ${env}`);
      assert.ok(u >= prevU - 1e-9, `utility monotone at ca ${ca} env ${env}`);
      prevSport = s;
      prevU = u;
    }
  }
});

test("invariant: a higher salary never reduces financial utility (nor total utility)", () => {
  const p = worldClass();
  let prevM = -Infinity;
  let prevU = -Infinity;
  for (let w = 500; w <= 300000; w *= 1.15) {
    const m = moneyComponent(w, p.referenceWageEurPerMonth);
    const u = evaluateCareerOption(p, option({ environmentLevel: ENV.DIV1, wageEurPerMonth: w })).utility;
    assert.ok(m >= prevM);
    assert.ok(u >= prevU - 1e-12);
    prevM = m;
    prevU = u;
  }
});

test("invariant: money saturates -- doubling an already huge wage adds little", () => {
  assert.ok(moneyComponent(80000, 10000) - moneyComponent(40000, 10000) < 0.06);
  assert.ok(Math.abs(moneyComponent(10000, 10000)) < 1e-12);
});

test("invariant: identical inputs -> identical decisions", () => {
  const p = worldClass();
  const o = option({ environmentLevel: 150 });
  assert.deepEqual(decide(p, o, freeAgentMarket()), decide(p, o, freeAgentMarket()));
});

test("invariant: profiles blend continuously -- no weight jumps between ages 18 and 40", () => {
  let prev = profile({ age: 18 }).weights;
  for (let age = 18.25; age <= 40; age += 0.25) {
    const w = profile({ age }).weights;
    for (const k of Object.keys(w) as (keyof typeof w)[]) assert.ok(Math.abs(w[k] - prev[k]) < 0.03, `weight ${k} jumps at ${age}`);
    prev = w;
  }
});

test("invariant: the floor dissolves at the end of a career", () => {
  const m = profileMemberships({ age: 37, worldPercentile: 0.99, ca: 160, pa: 160, ambition: 18 });
  assert.ok(m.CAREER_END > 0.99);
  assert.equal(profile({ age: 37, ca: 160, worldPercentile: 0.99, ambition: 18 }).floorStrength, 0);
});

test("wage demand: monotone in level, null when the floor makes it impossible", () => {
  const p = worldClass();
  const market = freeAgentMarket({ internationalAlternative: option({ environmentLevel: 164, role: "KEY_PLAYER", wageEurPerMonth: 22000 }) });
  const base = { clubId: "x", role: "KEY_PLAYER" as const, contractYears: 3, pressure: "NONE" as const, isHomeCountry: false, isFormerClub: false, isCurrentClub: false };
  assert.equal(wageDemandFor(p, { ...base, environmentLevel: ENV.DIV1 }, market), null);
  const elite = wageDemandFor(p, { ...base, environmentLevel: 172 }, market);
  const hbl = wageDemandFor(p, { ...base, environmentLevel: ENV.HBL_TOP }, market);
  assert.ok(elite !== null);
  assert.ok(hbl === null || hbl > elite!, "a lower level needs more money, or is impossible");
});
