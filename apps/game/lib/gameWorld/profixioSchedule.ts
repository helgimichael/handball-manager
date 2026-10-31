// HM-ALPHA2-01: pure parser/validator for the Profixio 2026/27 regular-
// season schedule snapshot (data/real-world/sweden/2026-27/fixtures/
// profixio-schedules-2026-10-31.psv). No fs, no scores -- the snapshot
// deliberately records only match id, round, kickoff and the two teams.
// Used by scripts/generate-real-league-schedules.ts (writes
// lib/game-data/realLeagueSchedules.ts) and by its integrity test, which
// re-derives the generated module from the snapshot.

export const SCHEDULE_TIME_ZONE = "Europe/Stockholm";

export type RealScheduleLeague = {
  competitionId: string;
  profixioLeagueId: string;
  scheduleUrl: string;
  /** Profixio team id -> canonical club id (names recorded for review). */
  teams: Readonly<Record<string, { clubId: string; profixioName: string }>>;
};

export const PROFIXIO_SCHEDULE_LEAGUES: readonly RealScheduleLeague[] = [
  {
    competitionId: "se_handbollsligan_herr",
    profixioLeagueId: "28137",
    scheduleUrl: "https://www.profixio.com/app/lx/competition/leagueid28137/category/1182222?matchgroup=3406033&t=schedule",
    teams: {
      "1570628": { clubId: "se_club_skanela_if", profixioName: "Skånela IF" },
      "1570647": { clubId: "se_club_amo_hk", profixioName: "Amo HK" },
      "1570669": { clubId: "se_club_hf_karlskrona", profixioName: "HF Karlskrona" },
      "1571869": { clubId: "se_club_ifk_skovde_hk", profixioName: "IFK Skövde HK" },
      "1572548": { clubId: "se_club_alingsas_hk", profixioName: "Alingsås HK" },
      "1572945": { clubId: "se_club_if_hallby_hk", profixioName: "IF Hallby HK" },
      "1575279": { clubId: "se_club_ifk_kristianstad", profixioName: "IFK Kristianstad" },
      "1579066": { clubId: "se_club_ik_savehof", profixioName: "IK Sävehof" },
      "1583535": { clubId: "se_club_onnereds_hk", profixioName: "Önnereds HK" },
      "1584193": { clubId: "se_club_ov_helsingborg", profixioName: "OV Helsingborg HK" },
      "1587242": { clubId: "se_club_hammarby_if_hf", profixioName: "Hammarby IF HF" },
      "1590992": { clubId: "se_club_hk_malmo", profixioName: "HK Malmö" },
      "1590993": { clubId: "se_club_lugi_hf", profixioName: "Lugi HF" },
      "1590994": { clubId: "se_club_ystads_if_hf", profixioName: "Ystads IF HF" },
    },
  },
  {
    competitionId: "swe-2",
    profixioLeagueId: "28141",
    scheduleUrl: "https://www.profixio.com/app/lx/competition/leagueid28141/category/1182233?matchgroup=3406062&t=schedule",
    teams: {
      "1570626": { clubId: "swe2-aranas", profixioName: "HK Aranäs" },
      "1570649": { clubId: "swe2-tyreso", profixioName: "Tyresö Handboll" },
      "1570715": { clubId: "swe2-torslanda", profixioName: "HK Torslanda Elit" },
      "1570930": { clubId: "swe2-h43lund", profixioName: "H43 Lund HF" },
      "1574158": { clubId: "swe2-guif", profixioName: "Eskilstuna Guif IF" },
      "1575370": { clubId: "swe2-kungalv", profixioName: "Kungälvs HK" },
      "1575712": { clubId: "swe2-varberg", profixioName: "HK Varberg" },
      "1575963": { clubId: "swe2-drott", profixioName: "HK Drott Halmstad" },
      "1580226": { clubId: "swe2-tumba", profixioName: "IFK Tumba HK" },
      "1582821": { clubId: "swe2-huddinge", profixioName: "Huddinge HK" },
      "1584389": { clubId: "swe2-ystad2", profixioName: "IFK Ystad HK" },
      "1592095": { clubId: "swe2-kroppskultur", profixioName: "GF Kroppskultur" },
      "1592096": { clubId: "swe2-redbergslid", profixioName: "Redbergslids IK" },
      "1592097": { clubId: "swe2-vasterasirsta", profixioName: "VästeråsIrsta HF" },
    },
  },
];

export type RealLeagueFixture = {
  /** Stable game fixture id, derived only from the original Profixio match id. */
  id: string;
  profixioMatchId: string;
  round: number;
  /** Local (Europe/Stockholm) date and kickoff time. */
  date: string;
  kickoffTime: string;
  homeClubId: string;
  awayClubId: string;
};

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", maj: "05", jun: "06", jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", dec: "12" };

/** "29 okt 19:00" -> 2026-10-29 19:00; Jan-Jun belong to the second half of the 2026/27 season. */
function parseLocalText(text: string): { date: string; kickoffTime: string } {
  const m = text.match(/^(\d{1,2}) ([a-z]{3}) (\d{2}:\d{2})$/);
  if (!m || !MONTHS[m[2]]) throw new Error(`Unparseable local kickoff "${text}"`);
  const month = MONTHS[m[2]];
  const year = Number(month) >= 7 ? 2026 : 2027;
  return { date: `${year}-${month}-${m[1].padStart(2, "0")}`, kickoffTime: m[3] };
}

/** Unix kickoff -> Stockholm local date/time (DST-aware via ICU). */
function localFromUnix(seconds: number): { date: string; kickoffTime: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: SCHEDULE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(seconds * 1000))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, kickoffTime: `${parts.hour}:${parts.minute}` };
}

/**
 * Parses the snapshot into per-competition fixtures sorted by date, time,
 * then match id. Every row's local text is used; where Profixio also
 * published a unix kickoff (upcoming matches) the two must agree, so a
 * year/DST inference error can never pass silently.
 */
export function parseProfixioScheduleSnapshot(text: string): Record<string, RealLeagueFixture[]> {
  const out: Record<string, RealLeagueFixture[]> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [list, matchId, round, kickoff, local, homeTeamId, awayTeamId] = line.split("|");
    const leagueId = list.split("-")[0];
    const league = PROFIXIO_SCHEDULE_LEAGUES.find((l) => l.profixioLeagueId === leagueId);
    if (!league) throw new Error(`Unknown Profixio league ${leagueId}`);
    const home = league.teams[homeTeamId];
    const away = league.teams[awayTeamId];
    if (!home || !away) throw new Error(`Match ${matchId}: unmapped Profixio team ${home ? awayTeamId : homeTeamId}`);
    const parsed = parseLocalText(local);
    if (kickoff) {
      const fromUnix = localFromUnix(Number(kickoff));
      if (fromUnix.date !== parsed.date || fromUnix.kickoffTime !== parsed.kickoffTime) {
        throw new Error(`Match ${matchId}: local text ${parsed.date} ${parsed.kickoffTime} disagrees with kickoff ${fromUnix.date} ${fromUnix.kickoffTime}`);
      }
    }
    (out[league.competitionId] ??= []).push({
      id: `profixio-${matchId}`,
      profixioMatchId: matchId,
      round: Number(round),
      date: parsed.date,
      kickoffTime: parsed.kickoffTime,
      homeClubId: home.clubId,
      awayClubId: away.clubId,
    });
  }
  for (const fixtures of Object.values(out)) {
    fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.kickoffTime.localeCompare(b.kickoffTime) || a.profixioMatchId.localeCompare(b.profixioMatchId));
  }
  return out;
}

/** Structural double round-robin checks; returns human-readable problems (empty = valid). */
export function validateRealLeagueSchedule(fixtures: readonly RealLeagueFixture[], clubIds: readonly string[]): string[] {
  const problems: string[] = [];
  const n = clubIds.length;
  const rounds = 2 * (n - 1);
  const expected = n * (n - 1);
  if (fixtures.length !== expected) problems.push(`expected ${expected} fixtures, got ${fixtures.length}`);
  const ids = new Set(fixtures.map((f) => f.profixioMatchId));
  if (ids.size !== fixtures.length) problems.push("duplicate Profixio match ids");
  const clubs = new Set(clubIds);
  const pairs = new Set<string>();
  const perRound = new Map<number, number>();
  const clubDates = new Set<string>();
  const home = new Map<string, number>();
  const away = new Map<string, number>();
  for (const f of fixtures) {
    if (!clubs.has(f.homeClubId) || !clubs.has(f.awayClubId)) problems.push(`${f.id}: club outside competition`);
    if (f.homeClubId === f.awayClubId) problems.push(`${f.id}: club plays itself`);
    const pair = `${f.homeClubId}>${f.awayClubId}`;
    if (pairs.has(pair)) problems.push(`${f.id}: duplicate pairing ${pair}`);
    pairs.add(pair);
    if (!Number.isInteger(f.round) || f.round < 1 || f.round > rounds) problems.push(`${f.id}: round ${f.round} outside 1..${rounds}`);
    perRound.set(f.round, (perRound.get(f.round) ?? 0) + 1);
    for (const club of [f.homeClubId, f.awayClubId]) {
      const key = `${club}@${f.date}`;
      if (clubDates.has(key)) problems.push(`${f.id}: ${club} plays twice on ${f.date}`);
      clubDates.add(key);
    }
    home.set(f.homeClubId, (home.get(f.homeClubId) ?? 0) + 1);
    away.set(f.awayClubId, (away.get(f.awayClubId) ?? 0) + 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !/^\d{2}:\d{2}$/.test(f.kickoffTime)) problems.push(`${f.id}: malformed date/time`);
  }
  for (const club of clubIds) {
    if (home.get(club) !== n - 1 || away.get(club) !== n - 1) problems.push(`${club}: ${home.get(club) ?? 0} home / ${away.get(club) ?? 0} away (expected ${n - 1}/${n - 1})`);
  }
  for (let r = 1; r <= rounds; r++) {
    if (perRound.get(r) !== n / 2) problems.push(`round ${r}: ${perRound.get(r) ?? 0} fixtures (expected ${n / 2})`);
  }
  return problems;
}
