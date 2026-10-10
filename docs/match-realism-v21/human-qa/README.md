# Match Realism v2.1: exact played QA matches

These three cases were automatically selected from the paired first fifty matches. Export independently reproduced the initial session, full final core, result and score/events/RNG/production-frame hashes before creating the kickoff and completed save envelopes. Archived frames round-trip exactly and career finalization is once-only. The [manifest](manifest.json) contains all proof hashes, player identities, fixture IDs and normal report/replay URLs.

| Selection | Index / canonical seed | Actual result | Kickoff | Completed archive |
|---|---|---|---|---|
| Representative | 7 / 83731708 | Kungälv 19–30 Redbergslid | [Save](match-007-initial.json) | [Save](match-007-completed.json) |
| Naturally closest | 3 / 2643779579 | Tyresö 25–25 H43 Lund | [Save](match-003-initial.json) | [Save](match-003-completed.json) |
| Highest paired total | 28 / 2543053647 | Aranäs 25–37 IFK Ystad | [Save](match-028-initial.json) | [Save](match-028-completed.json) |

Chromium acceptance passed all three exports: actual replay movement at 1×/4×/16×, 45 available event sequences, rendered player/ball equality with recorded frames, both 1920×1080 and 2560×1080, and unchanged archive hashes/results. [Receipt](../browser/selected-calibration/receipt.json), screenshots under `../browser/selected-calibration/match-{007,003,028}/{1920,2560}/`.

Actual scenes include pressured backcourt throws, high-quality close chances, pivot and wing finishes, a pass to a wing whose defender helped, screen-created space, keeper distribution, retreat, transition completion/settling, real whistles and continuing advantage. The separate `M6-help-created-space` cue was absent in all three cases and is explicitly recorded. A historical screen cause does not identify its screener, so that identity is not invented.

The retained v2 [19–19 archive](../../match-realism-v2/human-qa/match-016-completed.json) remains unchanged. A fresh match from its exact pinned input/seed produced 31–26; initial-session and result hashes match the final benchmark. [Old/new browser receipt](../browser/retained-seed16/receipt.json).

Start the retained production build from the repository root:

```powershell
$env:HM_NEXT_DIST_DIR = '.next-game-realism-v21'
npm run start --workspace=@handball-manager/game -- --port 3009 --hostname 127.0.0.1
```

URL: `http://127.0.0.1:3009`. The owned QA server was stopped after acceptance.

## Open an exact save

Use a dedicated QA browser profile or isolated context. Open `/load-game`, then run this developer-console snippet and select one envelope listed above:

```js
const file = await new Promise(resolve => {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json';
  picker.onchange = () => resolve(picker.files[0]);
  picker.click();
});
if (!file) throw new Error('No QA save selected');
const save = JSON.parse(await file.text());
if (save.schemaVersion !== 8 || !save.saveId.startsWith('hm-realism-v21-')) {
  throw new Error('Expected a generated v2.1 QA envelope');
}
const database = await new Promise((resolve, reject) => {
  const request = indexedDB.open('hm-game', 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('saves')) {
      request.result.createObjectStore('saves', { keyPath: 'saveId' });
    }
    if (!request.result.objectStoreNames.contains('meta')) {
      request.result.createObjectStore('meta');
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
await new Promise((resolve, reject) => {
  const transaction = database.transaction('saves', 'readwrite');
  transaction.objectStore('saves').put(save);
  transaction.oncomplete = resolve;
  transaction.onerror = transaction.onabort = () => reject(transaction.error);
});
database.close();
localStorage.setItem('hm-game:active-save:v1', save.saveId);
const fixtureId = save.careerState.productionMatch?.fixture.id
  ?? Object.keys(save.careerState.matchArchives)[0];
location.assign(`/career/match-day/${fixtureId}`);
```

For kickoff saves, keep the existing instructions/lineups to reproduce the measured result. Live coaching creates a different seeded continuation. For completed saves, playback reads the stored match. Inspect the release, keeper movement, advancing runners, retreat and actual stop/advantage facts together.

To repeat just the selected archive browser acceptance from `apps/game`:

```powershell
$env:HM_QA_URL = 'http://127.0.0.1:3009'
$env:HM_QA_SCREENSHOT_DIR = '../../docs/match-realism-v21/browser'
$env:HM_CALIBRATION_HUMAN_QA_DIR = '../../docs/match-realism-v21/human-qa'
npx --no-install playwright test e2e/match-calibration-v21.spec.ts -g 'selected calibration archives' --workers=1
```

The original v2 evidence and completed v2.1 stage measurements remain in their own directories. The [methods](../METHODS.md), [stages](../STAGES.md) and [final metrics](../METRICS.md) distinguish direct paired comparison, the larger hundred-match distribution, and engineering assumptions.
