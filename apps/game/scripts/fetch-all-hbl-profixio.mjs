import fs from "node:fs";

// 14 Handbollsligan teams
const TEAMS = [
  { id: "1571869", clubName: "IFK Skövde HK" },
  { id: "1572548", clubName: "Alingsås HK" },
  { id: "1572945", clubName: "IF Hallby HK" },
  { id: "1590992", clubName: "HK Malmö" },
  { id: "1575279", clubName: "IFK Kristianstad" },
  { id: "1570647", clubName: "Amo HK" },
  { id: "1590993", clubName: "Lugi HF" },
  { id: "1590994", clubName: "Ystads IF HF" },
  { id: "1583535", clubName: "Önnereds HK" },
  { id: "1579066", clubName: "IK Sävehof" },
  { id: "1587242", clubName: "Hammarby IF HF" },
  { id: "1570669", clubName: "HF Karlskrona" },
  { id: "1584193", clubName: "OV Helsingborg" },
  { id: "1570628", clubName: "Skånela IF" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllHBL() {
  console.log(`Starting fetch of all ${TEAMS.length} Handbollsligan teams from Profixio...`);
  const allRegistrations = [];

  for (const team of TEAMS) {
    const url = `https://www.profixio.com/app/lx/competition/leagueid28137/teams/${team.id}?t=players`;
    console.log(`Fetching ${team.clubName} (${team.id})...`);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!res.ok) {
        console.error(`Failed to fetch ${team.clubName}: ${res.status}`);
        continue;
      }
      const html = await res.text();
      
      // Match each playercard
      const cardRegex = /<div wire:key="playercard[^"]*"[\s\S]*?role="article"[\s\S]*?href="([^"]*\/clubs\/(\d+)\/player\/(\d+))"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
      const cardMatches = [...html.matchAll(cardRegex)];
      console.log(`  Found ${cardMatches.length} raw cards`);

      let parsedCount = 0;
      for (const cm of cardMatches) {
        const fullCard = cm[0];
        const profileUrl = cm[1];
        const profixioClubId = cm[2];
        const profixioPlayerId = cm[3];

        // Clean text inside card
        const cardText = fullCard.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        // Structure is usually: "INITIALS SHIRT_NUM? FIRST_NAME LAST_NAME POSITION DOB"
        // e.g. "AD 31 Ajdin Dzanic M9 2007-10-03" or "AB Arvid Boquist V9 2005-03-14"
        const tokens = cardText.split(" ");
        const dobMatch = cardText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        const dob = dobMatch ? dobMatch[1] : null;

        // Position match
        const posMatch = cardText.match(/\b(MV|V6|V9|M9|H9|H6|M6)\b/);
        const pos = posMatch ? posMatch[1] : null;

        // Shirt number match (1 or 2 digits after initials)
        let shirtNumber = null;
        if (tokens.length >= 2 && /^\d{1,2}$/.test(tokens[1])) {
          shirtNumber = parseInt(tokens[1], 10);
        }

        // Name extract: text between initials/shirt and position/DOB
        let nameParts = [];
        let startIndex = shirtNumber !== null ? 2 : 1;
        for (let i = startIndex; i < tokens.length; i++) {
          if (tokens[i] === pos || tokens[i] === dob || /^\d{4}-\d{2}-\d{2}$/.test(tokens[i])) break;
          nameParts.push(tokens[i]);
        }
        const fullName = nameParts.join(" ").trim();

        if (fullName) {
          allRegistrations.push({
            competition: "Handbollsligan",
            competitionId: "se_handbollsligan_herr",
            profixioTeamId: team.id,
            club: team.clubName,
            profixioClubId,
            profixioPlayerId,
            fullName,
            dateOfBirth: dob,
            shirtNumber,
            pos,
            profileUrl,
            sourceUrl: url,
            cardText,
          });
          parsedCount++;
        }
      }
      console.log(`  Successfully parsed ${parsedCount} player registrations.`);
    } catch (err) {
      console.error(`Error fetching ${team.clubName}:`, err);
    }
    await sleep(600);
  }

  console.log(`\n=== TOTAL PROFIXIO HANDBOLLSLIGAN PLAYERS: ${allRegistrations.length} ===`);
  const outPath = "profixio-hbl-squads-2026-11-05.json";
  fs.writeFileSync(outPath, JSON.stringify(allRegistrations, null, 2), "utf8");
  console.log(`Saved to ${outPath}`);
}

fetchAllHBL().catch(console.error);
