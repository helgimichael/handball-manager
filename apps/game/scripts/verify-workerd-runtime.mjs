async function verifyWorkerd() {
  const base = process.argv[2] || "http://127.0.0.1:8787";
  const routes = [
    { url: `${base}/`, expectedStatus: 200, expectedText: 'Handball Manager' },
    { url: `${base}/career`, expectedStatus: 200, expectedText: 'Handball Manager' },
    { url: `${base}/career/tactics`, expectedStatus: 200, expectedText: 'Handball Manager' },
    { url: `${base}/career/media`, expectedStatus: 200, expectedText: 'Handball Manager' },
    { url: `${base}/career/match-center`, expectedStatus: 200, expectedText: 'Handball Manager' },
    { url: `${base}/career/klubbhuset`, expectedStatus: 200, expectedText: 'Handball Manager' },
    { url: `${base}/api/editor/status`, expectedStatus: 200, expectedText: '"enabled":false' },
    { url: `${base}/api/game-world/squad-snapshot?competitionId=se_handbollsligan_herr`, expectedStatus: 200, expectedText: '"worldSquads"' },
    { url: `${base}/_next/static/css/db68f2d7b276728a.css`, expectedStatus: 200, expectedText: '' }
  ];

  console.log('| Route | Status | Expected | OpenNext Header | Match Result |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');

  let allPassed = true;
  for (const r of routes) {
    try {
      const res = await fetch(r.url);
      const text = await res.text();
      const openNext = res.headers.get('x-opennext') || 'none';
      const textMatches = !r.expectedText || text.includes(r.expectedText);
      const statusMatches = res.status === r.expectedStatus;
      const pass = statusMatches && textMatches;
      if (!pass) allPassed = false;
      const path = new URL(r.url).pathname;
      console.log(`| ${path} | ${res.status} | ${r.expectedStatus} | ${openNext} | ${pass ? 'PASS' : 'FAIL'} |`);
    } catch (err) {
      allPassed = false;
      console.log(`| ${r.url} | ERROR | ${r.expectedStatus} | - | FAIL: ${err.message} |`);
    }
  }

  if (!allPassed) process.exit(1);
  console.log('\nAll worker runtime checks PASSED!');
}

verifyWorkerd();
