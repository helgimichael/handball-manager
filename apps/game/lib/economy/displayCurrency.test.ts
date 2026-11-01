// HM-ALPHA3-M01: display currency (EUR default, SEK at the fixed 1 EUR = 11 SEK
// convention), device preferences, and the guarantee that switching the
// display currency never touches a career save.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { currencySymbol, EUR_TO_SEK_REFERENCE_RATE, formatEur, formatMoney, localizeMoneyText, parseMoneyInput, toDisplayAmount } from "./currency";
import { getPreferences, hydratePreferences, parsePreferences, PREFERENCES_STORAGE_KEY, resetPreferencesForTests, updatePreferences } from "../settings/preferences";
import { createSave, getSave, __setSaveBackendForTests } from "../save/saveRepository";
import { createMemoryBackend } from "../save/saveStorage";
import { createNewCareerState } from "../career/newCareer";
import { TUMBA_CLUB_ID } from "../game-data";

const NBSP = " ";
const plain = (s: string) => s.replace(/[  ]/g, " ");

function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  };
  return data;
}

beforeEach(() => resetPreferencesForTests());
afterEach(() => {
  resetPreferencesForTests();
  delete (globalThis as { window?: unknown }).window;
});

test("the fixed convention is exactly 1 EUR = 11 SEK", () => {
  assert.equal(EUR_TO_SEK_REFERENCE_RATE, 11);
});

test("EUR is the default display currency and formats exactly like formatEur", () => {
  assert.equal(getPreferences().displayCurrency, "EUR");
  assert.equal(formatMoney(450_000), formatEur(450_000));
  assert.equal(plain(formatMoney(450_000)), "450 000 €");
  assert.equal(currencySymbol(), "€");
});

test("SEK converts once from EUR, rounds to whole kronor and uses Swedish grouping", () => {
  assert.equal(plain(formatMoney(4_400, { currency: "SEK" })), "48 400 kr");
  assert.equal(plain(formatMoney(0, { currency: "SEK" })), "0 kr");
  assert.equal(toDisplayAmount(1234.56, "SEK"), Math.round(1234.56 * 11));
  assert.equal(currencySymbol("SEK"), "kr");
  assert.ok(formatMoney(4_400, { currency: "SEK" }).includes(NBSP), "non-breaking group separator keeps a figure on one line");
});

test("negative amounts keep their sign in both currencies", () => {
  assert.match(plain(formatMoney(-2_500, { currency: "EUR" })), /^[-−]2 500 €$/);
  assert.match(plain(formatMoney(-2_500, { currency: "SEK" })), /^[-−]27 500 kr$/);
});

test("compact mode only shortens million-plus figures", () => {
  assert.equal(plain(formatMoney(1_250_000, { currency: "EUR", compact: true })), "1,25 mn €");
  assert.equal(plain(formatMoney(1_250_000, { currency: "SEK", compact: true })), "13,8 Mkr");
  assert.equal(plain(formatMoney(95_000, { currency: "SEK", compact: true })), "1,05 Mkr", "the threshold applies to the displayed amount");
  assert.equal(plain(formatMoney(90_000, { currency: "EUR", compact: true })), "90 000 €");
});

test("typed SEK figures come back as whole euros; EUR input is identity", () => {
  assert.equal(parseMoneyInput(48_400, "SEK"), 4_400);
  assert.equal(parseMoneyInput(48_405, "SEK"), 4_400);
  assert.equal(parseMoneyInput(4_400, "EUR"), 4_400);
  assert.equal(parseMoneyInput(Number.NaN, "SEK"), 0);
  for (const eur of [0, 1, 10, 499, 4_400, 123_456, 2_000_000]) {
    assert.equal(parseMoneyInput(toDisplayAmount(eur, "SEK"), "SEK"), eur, `round trip ${eur}`);
  }
});

test("rule-generated EUR text is re-expressed at render time, never twice", () => {
  const reason = "Klubben vill ha 4400 € för att släppa spelaren.";
  assert.equal(plain(localizeMoneyText(reason, "SEK")), "Klubben vill ha 48 400 kr för att släppa spelaren.");
  assert.equal(plain(localizeMoneyText(reason, "EUR")), "Klubben vill ha 4 400 € för att släppa spelaren.");
  const budget = `Ny total lönekostnad (1${NBSP}234${NBSP}567 €/år) skulle överstiga lönebudgeten (900000 €/år).`;
  assert.equal(plain(localizeMoneyText(budget, "SEK")), "Ny total lönekostnad (13 580 237 kr/år) skulle överstiga lönebudgeten (9 900 000 kr/år).");
  const once = localizeMoneyText(reason, "SEK");
  assert.equal(localizeMoneyText(once, "SEK"), once, "SEK output carries no euro sign, so it is never converted again");
  assert.equal(localizeMoneyText("Efter 3 bud under 40 dagar.", "SEK"), "Efter 3 bud under 40 dagar.", "numbers without a euro sign are untouched");
});

test("preferences: defaults until hydrated, persisted on change, corrupt values ignored", () => {
  const data = installStorage({ [PREFERENCES_STORAGE_KEY]: JSON.stringify({ displayCurrency: "SEK" }) });
  assert.equal(getPreferences().displayCurrency, "EUR", "first render always uses defaults (hydration-safe)");
  hydratePreferences();
  assert.equal(getPreferences().displayCurrency, "SEK");
  assert.equal(updatePreferences({ displayCurrency: "EUR" }), true);
  assert.deepEqual(JSON.parse(data.get(PREFERENCES_STORAGE_KEY)!), { displayCurrency: "EUR" });
  assert.equal(parsePreferences("{not json").displayCurrency, "EUR");
  assert.equal(parsePreferences(JSON.stringify({ displayCurrency: "NOK" })).displayCurrency, "EUR");
});

test("preferences: blocked storage still switches the UI for the session", () => {
  (globalThis as { window?: unknown }).window = { get localStorage(): Storage { throw new Error("SecurityError"); } };
  hydratePreferences();
  assert.equal(updatePreferences({ displayCurrency: "SEK" }), false, "reports that nothing was persisted");
  assert.equal(getPreferences().displayCurrency, "SEK");
});

test("switching the display currency leaves a stored career save byte-for-byte identical", async () => {
  const storage = installStorage();
  __setSaveBackendForTests(createMemoryBackend("display-currency"));
  try {
    const career = createNewCareerState("display-currency-seed", TUMBA_CLUB_ID);
    const created = await createSave(
      { selectedNations: ["SWE"], selectedLeagueIds: [], clubId: TUMBA_CLUB_ID, gameDate: career.gameDate, manager: { name: "Test", nationality: "SWE", dateOfBirth: "1980-01-01" } } as never,
      async () => career,
    );
    const before = JSON.stringify(await getSave(created.saveId));
    const storageBefore = new Map(storage);
    // Exercise every display path in both directions.
    updatePreferences({ displayCurrency: "SEK" });
    formatMoney(career.playerContracts[Object.keys(career.playerContracts)[0]!]?.wageEurPerMonth ?? 1);
    localizeMoneyText("Budet (4400 €) är för lågt.");
    updatePreferences({ displayCurrency: "EUR" });
    updatePreferences({ displayCurrency: "SEK" });
    const after = JSON.stringify(await getSave(created.saveId));
    assert.equal(after, before);
    const changedKeys = [...storage.keys()].filter((k) => storage.get(k) !== storageBefore.get(k));
    assert.deepEqual(changedKeys, [PREFERENCES_STORAGE_KEY], "the preference key is the only thing written");
  } finally {
    __setSaveBackendForTests(null);
  }
});

test("guard: UI money goes through lib/economy/currency.ts (no ad-hoc euro formatting)", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".tsx")) {
        readFileSync(path, "utf8").split(/\r?\n/).forEach((line, i) => {
          const code = line.replace(/\/\/.*$/, "");
          // Ad-hoc Intl currency formatters, toLocaleString + "€", and hard-coded euro labels/suffixes.
          if (/style:\s*["']currency["']|toLocaleString\([^)]*\)\s*\+?\s*[`"'][^`"']*€|\(€\)|€\/m|" €"|' €'|\} €/.test(code)) offenders.push(`${relative(root, path)}:${i + 1}`);
        });
      }
    }
  };
  for (const dir of ["app", "components"]) walk(join(root, dir));
  assert.deepEqual(offenders, []);
});
