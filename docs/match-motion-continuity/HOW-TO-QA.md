# How to QA movement continuity

The motion build is at **http://127.0.0.1:3010**. The retained v2.1 build continues at port 3009. Browser save storage is separate for each port.

From the repository root, the motion build starts with:

```powershell
$env:HM_NEXT_DIST_DIR = '.next-game-motion-v1'
npm run start --workspace=@handball-manager/game -- --port 3010 --hostname 127.0.0.1
```

## Import the recorded motion matches

1. Use a dedicated QA browser profile and open **http://127.0.0.1:3010/load-game**.
2. Press **F12**, select **Console**, and run the following snippet.
3. In the file picker, open `C:\Users\helgi\Documents\STARKVIS-HELA\handball-manager\docs\match-motion-continuity\final\motion`.
4. Ctrl-click `match-007-completed.json`, `match-003-completed.json`, and `match-028-completed.json`, then click **Open**.

```js
(async () => {
  const files = await new Promise(resolve => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.json';
    picker.multiple = true;
    picker.onchange = () => resolve([...picker.files]);
    picker.oncancel = () => resolve([]);
    picker.click();
  });
  const saves = await Promise.all(files.map(async file =>
    JSON.parse(await file.text())
  ));
  const expected = new Set([
    'hm-motion-v1-7-completed',
    'hm-motion-v1-3-completed',
    'hm-motion-v1-28-completed'
  ]);
  if (saves.length !== 3 ||
      new Set(saves.map(save => save.saveId)).size !== 3 ||
      saves.some(save => save.schemaVersion !== 8 || !expected.has(save.saveId))) {
    throw new Error('Select exactly the three completed motion QA files.');
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
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('saves', 'readwrite');
      const store = transaction.objectStore('saves');
      saves.forEach(save => store.put(save));
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
  location.reload();
})().catch(console.error);
```

5. Load Game now shows **Motion QA · Case 7**, **Motion QA · Case 3**, and **Motion QA · Case 28**. Click **Ladda** on the desired row.
6. Once that career opens, visit its replay address:

| Row | Seed | Motion result | Replay |
|---|---:|---|---|
| Motion QA · Case 7 | 83731708 | Kungälv 18–26 Redbergslid | http://127.0.0.1:3010/career/match-day/swe-2-f7 |
| Motion QA · Case 3 | 2643779579 | Tyresö 23–26 H43 | http://127.0.0.1:3010/career/match-day/swe-2-f4 |
| Motion QA · Case 28 | 2543053647 | Aranäs 30–38 IFK Ystad | http://127.0.0.1:3010/career/match-day/swe-2-f1 |

7. Select **1×** in **Reprishastighet**, then click **Spela**. Watch several possessions, including support after a pass, the pivot working the line, defensive shifting/recovery, and transition/retreat. Players holding width, setting a screen, or waiting at a restart may stand still.
8. Pause and resume, then seek and resume. Repeat at **4×** and **16×**.
9. To switch cases, return to Load Game, click **Ladda** for that case, then use its replay address.

## Watch live play

Use the existing kickoff envelopes in `docs/match-realism-v21/human-qa/` and the single-file importer in that directory's README, running it on **port 3010**. Select `match-007-initial.json`, `match-003-initial.json`, or `match-028-initial.json`. Select **1×** in **Matchhastighet**, then click **Spela**. Keep the existing lineup/instructions for the measured continuation; coaching changes create a different deterministic continuation.

The old completed v2.1 envelopes preserve their original scores and trajectories. Their replay receives the improved presentation clock, while the new motion envelopes above contain the new canonical locomotion.

Human acceptance remains pending until the 1× view passes the reported "two steps, stop, two steps, stop" test. The report also discloses the measured changes in match opportunities and outcomes.
