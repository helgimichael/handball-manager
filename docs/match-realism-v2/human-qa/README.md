# Human QA: exact recorded canonical matches

The exporter prepares three automatically chosen AFTER cases: representative, naturally closest, and highest scoring or unusual. These are fixed input/seed reproductions, including the undesirable case. Each kickoff save contains the actual canonical initial live session; each completed save contains the canonical career result and immutable recorded archive.

The completed export verified all four canonical hashes and lossless archived frames for these cases:

| Selection | Index / canonical seed | Recorded match | Kickoff save | Completed save |
|---|---|---|---|---|
| Representative | 5 / 1793243603 | Torslanda 12–22 Kroppskultur | [Kickoff](match-005-initial.json) | [Archive](match-005-completed.json) |
| Naturally closest | 16 / 3443931976 | Eskilstuna Guif 19–19 Varberg | [Kickoff](match-016-initial.json) | [Archive](match-016-completed.json) |
| Highest scoring or unusual | 0 / 1765851951 | Aranäs 22–28 IFK Ystad | [Kickoff](match-000-initial.json) | [Archive](match-000-completed.json) |

Chromium replay QA passed all three cases in one acceptance test: **66 screenshots**, **36 rendered player/ball observations**, **zero page errors**, no horizontal overflow at 1920×1080 or 2560×1080, and identical persisted archive hashes/results before and after replay. The receipt is [human-browser-receipt.json](browser/human-browser-receipt.json); screenshots are under `browser/match-{000,005,016}/{1920,2560}/`. These verify actual recorded movement and archive integrity, not that every desired handball episode appears in each selected match.

Run from `apps/game` after the final AFTER sample and comparison have completed:

```powershell
node --import tsx scripts/export-match-realism-qa.ts --after ../../docs/match-realism-v2/after --baseline ../../docs/match-realism-v2/baseline --out ../../docs/match-realism-v2/human-qa --url http://localhost:3008
```

If the comparison selection file is elsewhere, pass `--selections PATH`. The default first checks `after/human-qa-matches.json`, then the parent `human-qa-matches.json` produced by the comparison script. The exporter refuses mismatched input, seed recipe, initial state, final state, result, score/events/RNG/frame truth, or lossless archived frames. It never changes production source, pinned inputs or sample records.

`manifest.json` identifies exact seeds, score, fixture, proof hashes, kickoff/completed filenames and normal report/replay URLs. Envelope save IDs are deterministic. Inline archives are supported by the existing save loader; normal subsequent saves put them into the existing immutable archive database.

## Open a case

Start the release using the final report's production command and URL. Use a dedicated browser profile or a fresh isolated Playwright context for QA. Open `/load-game`, then run this developer-console snippet and choose one exported JSON envelope from disk:

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
if (save.schemaVersion !== 8 || !save.saveId.startsWith('hm-realism-v2-')) {
  throw new Error('Expected a generated realism QA envelope');
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

The snippet imports a developer QA save through the normal storage shape and opens the normal match route. It does not add a simulator, production switch or application import feature.

For kickoff saves, press **Spela** and watch at 1×, 4× and 16×; keep the existing lineups and instructions to reproduce the recorded result. Coaching changes intentionally produce another deterministic continuation. For completed saves, replay the archived match and inspect its beginning, middle and ending. Watch actual player and ball movement: gap attack, pressure/help, continuation, pivot and wing availability, shot geometry, contextual loss, saves, retreat and established handoff. The manifest's category describes selection, not a promise that every behavior occurs.

The optional browser replay evidence test uses a fresh isolated context for each completed case:

```powershell
$env:HM_QA_URL = 'http://localhost:3008'
npm exec -- playwright test e2e/human-match-realism-v2.spec.ts --workers=1
```

It records rendered player/ball coordinates, screenshot sequences, both desktop widths, report/replay score agreement and zero page errors. It reads completed archives without resimulation. Keep the exported envelopes locally as QA fixtures; their size reflects real world snapshots and recorded match truth.
