// QA harness for the e2e specs (they target a running app via HM_QA_URL, default http://localhost:3001).
// The local alpha access gate is pre-authorised for journey specs through storage state (the same two
// localStorage keys the gate writes after a correct code); specs that unlock the gate themselves (alpha-access, worker-snapshots) run in a fresh,
// locked context so its assertions stay exactly as written.
import { defineConfig } from '@playwright/test';

const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const code = process.env.HM_QA_ALPHA_ACCESS_CODE?.trim() || 'HBL-ALPHA-2026';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 600_000,
  reporter: [['list']],
  use: { baseURL: base, actionTimeout: 30_000 },
  projects: [
    { name: 'alpha-gate', testMatch: /(alpha-access|worker-snapshots)\.spec\.ts/ },
    {
      name: 'career',
      testIgnore: /(alpha-access|worker-snapshots)\.spec\.ts/,
      use: { storageState: { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [{ name: 'hm_alpha_authorized', value: 'true' }, { name: 'hm_alpha_access_code', value: code }] }] } },
    },
  ],
});
