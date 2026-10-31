// HM-DATA-1.3: controlled apply of the approved Herrallsvenskan 2026/27
// roster corrections (snapshot 2026-10-31).
//
// Inputs (all read-only): the HM-DATA-1.2 decision CSV, the HM-DATA-1.3
// approval spec (explicit approved/held row ids) and the parsed Profixio
// squad registrations. Never runs the original ID-generating import:
// existing playerIds are preserved, and the only new ids are the ones
// already proposed (and collision-checked) in HM-DATA-1.1/1.2.
//
// Modes:
//   (default)            plan only -- prints the operations, writes nothing
//   --apply              executes the plan against --data-root
//   --validate-only      runs the consistency validation against --data-root
// Writing to the canonical data root requires --backup-dir: every file the
// plan touches (and its existing .bak) is copied there before any write.
// Every operation re-checks current state first, so a repeat run is a no-op.
//
// Usage (from apps/game):
//   node --import tsx scripts/apply-hm-data-1-3-allsvenskan.ts \
//     --proposal <csv> --spec <json> --squads <json> --report-dir <dir> \
//     [--data-root <dir>] [--apply --backup-dir <dir>] [--validate-only]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { atomicWriteJsonFile } from "../lib/editor/atomicWrite";
import { buildCatalog, type EditorClubEntry } from "../lib/editor/catalog";
import { DEFAULT_DATA_ROOT } from "../lib/editor/paths";
import { calibratePlayerRating, toRatingPosition } from "../lib/editor/ratingCalibration";
import type { CanonicalPosition } from "../lib/editor/schema";
import { loadRealWorldClubSquad, validateClubSquad } from "../lib/gameWorld/realWorldLoader";
import { assignOutcourtArchetype } from "../lib/rating/gamePrior/archetypeAssignment";
import { GAME_PRIOR_MODEL_VERSION } from "../lib/rating/gamePrior/types";
import type { OutcourtPositionId } from "../lib/rating/types";

const MILESTONE = "HM-DATA-1.3";
const SNAPSHOT = "2026-10-31";
const ALLSVENSKAN = "swe-2";
const SEASON = "2026/27";
const ARCHETYPE_SET: Record<string, string> = { V9: "SIDE_BACK", H9: "SIDE_BACK", M9: "CENTRE_BACK", V6: "WING", H6: "WING", M6: "PIVOT", MV: "GK" };
const CANONICAL = new Set(["MV", "V6", "V9", "M9", "H9", "H6", "M6"]);

const SRC = {
  profixio: "src_hm13_profixio_registration",
  matchSheets: "src_hm13_profixio_match_sheets",
  research: "src_hm13_rating_research_v0_13",
  clubPage: "src_hm13_club_squad_page",
  carriedOver: "src_hm13_previous_league_record",
} as const;

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (name: string): boolean => argv.includes(name);
const dataRoot = path.resolve(arg("--data-root") ?? DEFAULT_DATA_ROOT);
const applyMode = flag("--apply");
const validateOnly = flag("--validate-only");
const backupDir = arg("--backup-dir");
const reportDir = path.resolve(arg("--report-dir") ?? ".");
const isCanonicalRoot = path.resolve(dataRoot) === path.resolve(DEFAULT_DATA_ROOT);
if (applyMode && isCanonicalRoot && !backupDir) throw new Error("--apply on the canonical data root requires --backup-dir");

// ---------------------------------------------------------------- json helpers
type JsonObject = Record<string, unknown>;
type PlayerRecord = JsonObject & { playerId: string; fullName: string; firstName: string; lastName: string; dateOfBirth: string | null; aliases?: string[]; dataNotes?: string[] };
type RosterRow = JsonObject & { playerId: string; clubId: string; primaryPosition: string; sourcePosition: string; secondaryPositions: string[]; rosterEntryId: string; rosterConfidence?: string; sourceRefs?: Record<string, string[]>; dataNotes?: string[]; shirtNumber: number | null };
interface LockRecord { playerId: string; clubId: string; position: string; ca: { value: number }; pa: { value: number } | null; branch: { branch: string; attributes: Record<string, { value: number; origin: string }> }; attackRoleProficiencies: { role: string }[]; [k: string]: unknown }

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")) as T;
const sha256 = (file: string): string => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function readCsv(file: string): Record<string, string>[] {
  const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) { if (c === '"' && raw[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && raw[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.length > 1);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// Lazily loaded, mutated in memory, written once per file.
class FileSet {
  private cache = new Map<string, unknown>();
  readonly dirty = new Set<string>();
  get<T>(file: string, fallback?: T): T {
    if (!this.cache.has(file)) this.cache.set(file, fs.existsSync(file) || fallback === undefined ? readJson<T>(file) : fallback);
    return this.cache.get(file) as T;
  }
  touch(file: string): void { this.dirty.add(file); }
  writeAll(): string[] { const written = [...this.dirty].sort(); for (const f of written) atomicWriteJsonFile(f, this.cache.get(f)); this.dirty.clear(); return written; }
  forget(): void { this.cache.clear(); }
}

// ---------------------------------------------------------------- catalog helpers
const ratingsFile = (club: EditorClubEntry): string => path.join(path.dirname(club.clubDir), "ratings", `${club.clubId}.json`);
const overridesFile = (club: EditorClubEntry): string => path.join(club.clubDir, "rating-overrides.json");
const reviewFile = (club: EditorClubEntry): string => path.join(club.clubDir, "rating-review.json");
const manifestFile = (club: EditorClubEntry): string => path.join(club.clubDir, "manifest.json");
const qcFile = (club: EditorClubEntry): string | null => { const f = fs.readdirSync(club.clubDir).find((x) => /^qc-.*\.json$/.test(x)); return f ? path.join(club.clubDir, f) : null; };
const fromLock = (p: string): string => (p === "GK" ? "MV" : p);

function catalogNow() { return buildCatalog(dataRoot); }
function clubByName(name: string): EditorClubEntry {
  const club = catalogNow().clubs.find((c) => c.competitionId === ALLSVENSKAN && c.clubName === name) ?? catalogNow().clubs.find((c) => c.competitionId === ALLSVENSKAN && path.basename(c.clubDir) === name);
  if (!club) throw new Error(`unknown Herrallsvenskan club "${name}"`);
  return club;
}
function clubHolding(files: FileSet, playerId: string): EditorClubEntry | null {
  for (const c of catalogNow().clubs) if (files.get<RosterRow[]>(c.rosterFile).some((r) => r.playerId === playerId)) return c;
  return null;
}
function clubHoldingIdentity(files: FileSet, playerId: string): EditorClubEntry | null {
  for (const c of catalogNow().clubs) if (files.get<PlayerRecord[]>(c.playersFile).some((p) => p.playerId === playerId)) return c;
  return null;
}

// ---------------------------------------------------------------- inputs
const proposal = readCsv(path.resolve(arg("--proposal") ?? ""));
const spec = readJson<{ approvedIds: string[]; held: { id: string; player: string; club: string; reason: string }[] }>(path.resolve(arg("--spec") ?? ""));
const squads = readJson<{ club: string; fullName: string; firstName: string; lastName: string; dateOfBirth: string | null; shirtNumber: number | null; nationalityFlag: string | null; profixioPlayerId: string; profixioClubId: string; sourceUrl: string }[]>(path.resolve(arg("--squads") ?? ""));
const approved = new Set(spec.approvedIds);
const rows = proposal.filter((r) => approved.has(r.id));
if (rows.length !== spec.approvedIds.length) throw new Error(`spec lists ${spec.approvedIds.length} approved ids but ${rows.length} match the proposal`);
const heldIds = new Set(spec.held.map((h) => h.id));
const heldPlayerIds = new Set(proposal.filter((r) => heldIds.has(r.id)).map((r) => r.player_id));
const squadEntry = (club: string, name: string) => squads.find((s) => s.club === club && s.fullName === name);
const profileUrl = (e: { profixioClubId: string; profixioPlayerId: string }) => `https://www.profixio.com/app/lx/clubs/${e.profixioClubId}/player/${e.profixioPlayerId}`;

// Where each applied position comes from (all of it already quoted in the HM-DATA-1.2 evidence column).
function positionSources(r: Record<string, string>): { refs: string[]; basis: string } {
  const name = r.player_name;
  if (r.category === "ROSTER_LOCK_DRIFT") return { refs: [SRC.research], basis: "rating research v0.13 role label" };
  if (name === "Oskar Waltin") return { refs: [SRC.clubPage], basis: "club squad page 'Linjespelare'" };
  if (name === "Ludvig Hedin" || name === "Gustav Simonsson") return { refs: [SRC.matchSheets], basis: "Profixio match-sheet goalkeeper (RMV) flag" };
  if (name === "Simon Larsson") return { refs: [SRC.research, SRC.matchSheets], basis: "rating research 'Allsvenskan H9'; never goalkeeper on match sheets" };
  if (r.category === "GK_OUTFIELD_CONFLICT") return { refs: [SRC.profixio, SRC.matchSheets], basis: "Profixio profile position, corroborated by match-sheet goalkeeper flags" };
  return { refs: [SRC.profixio], basis: "Profixio player profile position" };
}

// ---------------------------------------------------------------- operations
type OpKind = "ADD_PLAYER" | "SET_POSITION" | "REGENERATE_BRANCH" | "REMOVE_MEMBERSHIP" | "MOVE_MEMBERSHIP" | "RENAME" | "ADD_ALIAS";
interface Op { id: string; kind: OpKind; player: string; playerId: string; club: string; detail: string; needed: boolean }
interface Context { files: FileSet; ops: Op[]; touchedClubs: Set<string>; otherLeagueClubs: Set<string>; regenerations: { op: Op; clubId: string; position: string }[]; attributeReport: unknown[] }

function addSourceIfMissing(ctx: Context, club: EditorClubEntry, key: keyof typeof SRC, url: string | null): void {
  if (!club.sourcesFile) return;
  const sources = ctx.files.get<JsonObject[]>(club.sourcesFile);
  const id = SRC[key];
  if (sources.some((s) => s.sourceId === id)) return;
  const meta: Record<keyof typeof SRC, [string, string, string]> = {
    profixio: ["FEDERATION_OFFICIAL", "Svenska Handbollförbundet (Profixio)", "Herrallsvenskan 2026/27 squad registration and player profiles (leagueid28141)"],
    matchSheets: ["FEDERATION_OFFICIAL", "Svenska Handbollförbundet (Profixio)", "Herrallsvenskan 2026/27 match sheets (laguppställningar, RMV goalkeeper flags), rounds 4-6"],
    research: ["RESEARCH_COMPILED", "Handball Manager rating research", "ALLSV_rating_import_candidates_v0.13.csv (exports/player-rating-research) role labels"],
    clubPage: ["CLUB_OFFICIAL", club.clubName, "Official club squad page"],
    carriedOver: ["GAME_DATA", "Handball Manager real-world data", "Position carried over from the player's previous (other-league) verified roster record"],
  };
  const [sourceType, publisher, title] = meta[key];
  sources.push({ sourceId: id, sourceType, publisher, title, url, publishedAt: null, accessedAt: SNAPSHOT, seasonContext: `${SEASON} (${MILESTONE})` });
  ctx.files.touch(club.sourcesFile);
}

function syncLockPosition(ctx: Context, lock: LockRecord, finalPos: string, ratingsPath: string): string {
  if (fromLock(lock.position) === finalPos) return "lock already correct";
  if ((fromLock(lock.position) === "MV") !== (finalPos === "MV")) throw new Error(`${lock.playerId}: GK/OUTCOURT branch change must go through REGENERATE_BRANCH`);
  const before = lock.position;
  lock.position = toRatingPosition(finalPos as CanonicalPosition);
  let roleNote = "role label unchanged";
  if (ARCHETYPE_SET[fromLock(before)] !== ARCHETYPE_SET[finalPos]) {
    if (lock.attackRoleProficiencies.length !== 1) throw new Error(`${lock.playerId}: expected exactly one attack role label`);
    const role = assignOutcourtArchetype(lock.playerId, finalPos as OutcourtPositionId, GAME_PRIOR_MODEL_VERSION);
    roleNote = `role label ${lock.attackRoleProficiencies[0].role} -> ${role}`;
    lock.attackRoleProficiencies = [{ role }];
  }
  ctx.files.touch(ratingsPath);
  return `lock position ${before} -> ${lock.position}; ${roleNote}; CA/PA and attributes unchanged`;
}

function newRosterRow(club: EditorClubEntry, files: FileSet, playerId: string, shirt: number | null, pos: string, refs: string[], notes: string[], secondary: string[] = []): RosterRow {
  const existing = files.get<RosterRow[]>(club.rosterFile);
  const prefix = existing[0].rosterEntryId.split("__")[0];
  return {
    rosterEntryId: `${prefix}__${playerId.slice(-8)}`, playerId, clubId: club.clubId, competitionId: ALLSVENSKAN, season: SEASON, snapshotDate: SNAPSHOT,
    shirtNumber: shirt, sourcePosition: pos, primaryPosition: pos, secondaryPositions: secondary, rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null }, rosterConfidence: "VERIFIED",
    sourceRefs: { roster: [SRC.profixio], position: refs }, dataNotes: notes, defaultSquadStatus: null, specialTags: [],
  };
}

function plan(ctx: Context): void {
  const { files } = ctx;
  for (const r of rows) {
    const op = (kind: OpKind, detail: string, needed: boolean): Op => { const o = { id: r.id, kind, player: r.player_name, playerId: r.player_id, club: r.club, detail, needed }; ctx.ops.push(o); return o; };

    // ---- moves (cross-league + dual registration) ----
    if (r.roster_action === "MOVE_MEMBERSHIP_CROSS_LEAGUE" || r.roster_action === "MOVE_MEMBERSHIP_IN_LEAGUE") {
      const target = clubByName(r.club);
      const source = clubHolding(files, r.player_id);
      const needed = source?.clubId !== target.clubId;
      const o = op("MOVE_MEMBERSHIP", `${source?.clubName ?? "?"} (${source?.competitionId ?? "?"}) -> ${target.clubName}`, needed);
      if (!needed || !applyMode) continue;
      if (!source) throw new Error(`${r.player_name}: no current roster membership found`);
      const srcRoster = files.get<RosterRow[]>(source.rosterFile);
      const oldRow = srcRoster.find((x) => x.playerId === r.player_id)!;
      const identityClub = clubHoldingIdentity(files, r.player_id)!;
      const srcPlayers = files.get<PlayerRecord[]>(identityClub.playersFile);
      const record = srcPlayers.find((p) => p.playerId === r.player_id)!;
      const e = squadEntry(r.club, r.player_name);
      if (!e) throw new Error(`${r.player_name}: no Profixio registration at ${r.club}`);
      const pfxPos = evidencePosition(r);
      const finalPos = pfxPos ?? oldRow.primaryPosition;
      const refs = pfxPos ? [SRC.profixio] : [SRC.carriedOver];
      const dual = r.roster_action === "MOVE_MEMBERSHIP_IN_LEAGUE";
      const notes = dual
        ? [`${MILESTONE} (${SNAPSHOT}): playable starting club HK Drott Halmstad (Profixio #${e.shirtNumber}; goalkeeper on Drott match sheets rounds 5-6, the latest published). Also registered for IFK Tumba HK in Herrallsvenskan 2026/27 (#22; 1 league + 2 cup appearances per Profixio profile ${profileUrl(e)}); that registration is kept as evidence only, not as a second roster row.`]
        : [`${MILESTONE} (${SNAPSHOT}): 2026/27 membership moved from ${source.clubName} (${source.competitionId}) to ${target.clubName}; Profixio shows 2026/27 appearances only for ${target.clubName} (${profileUrl(e)}). Same playerId; previous roster row removed.${pfxPos ? "" : ` Position ${finalPos} carried over from the previous verified roster record (no Profixio position).`}`];
      srcRoster.splice(srcRoster.indexOf(oldRow), 1); files.touch(source.rosterFile);
      if (identityClub.clubId !== target.clubId) {
        srcPlayers.splice(srcPlayers.indexOf(record), 1); files.touch(identityClub.playersFile);
        files.get<PlayerRecord[]>(target.playersFile).push(record);
      }
      record.dataNotes = [...(record.dataNotes ?? []), ...notes]; files.touch(target.playersFile);
      files.get<RosterRow[]>(target.rosterFile).push(newRosterRow(target, files, r.player_id, e.shirtNumber, finalPos, refs, [], []));
      files.touch(target.rosterFile);
      addSourceIfMissing(ctx, target, "profixio", e.sourceUrl);
      if (!pfxPos) addSourceIfMissing(ctx, target, "carriedOver", null);
      // locked rating + provenance travel with the player, values unchanged
      for (const [fromFile, toFile] of [[ratingsFile(source), ratingsFile(target)], [overridesFile(source), overridesFile(target)], [reviewFile(source), reviewFile(target)]] as const) {
        const from = files.get<Record<string, JsonObject>>(fromFile);
        if (!(r.player_id in from)) continue;
        const to = files.get<Record<string, JsonObject>>(toFile, {});
        to[r.player_id] = from[r.player_id]; delete from[r.player_id];
        files.touch(fromFile); files.touch(toFile);
      }
      const lock = files.get<Record<string, LockRecord>>(ratingsFile(target))[r.player_id];
      if (lock) { lock.clubId = target.clubId; o.detail += `; ${syncLockPosition(ctx, lock, finalPos, ratingsFile(target))}`; }
      if (source.competitionId !== ALLSVENSKAN) { ctx.otherLeagueClubs.add(source.clubId); adjustOtherLeagueCounts(ctx, source, -1); }
      ctx.touchedClubs.add(target.clubId); ctx.touchedClubs.add(source.clubId);
      continue;
    }

    const club = clubByName(r.club);
    const roster = files.get<RosterRow[]>(club.rosterFile);
    const players = files.get<PlayerRecord[]>(club.playersFile);

    // ---- new identities ----
    if (r.roster_action === "ADD_PLAYER") {
      const e = squadEntry(r.club, r.player_name);
      if (!e || !e.dateOfBirth) throw new Error(`${r.player_name}: no Profixio registration/DOB at ${r.club}`);
      if (!CANONICAL.has(r.roster_to)) throw new Error(`${r.player_name}: no canonical position`);
      const existsHere = roster.some((x) => x.playerId === r.player_id);
      op("ADD_PLAYER", `${r.roster_to}, #${e.shirtNumber ?? "-"}, DOB ${e.dateOfBirth}`, !existsHere);
      if (existsHere || !applyMode) continue;
      if (clubHoldingIdentity(files, r.player_id)) throw new Error(`${r.player_id} already exists as an identity elsewhere`);
      const { refs, basis } = positionSources(r);
      const nat = e.nationalityFlag ? [e.nationalityFlag.toUpperCase()] : null;
      players.push({
        playerId: r.player_id, firstName: e.firstName, lastName: e.lastName, fullName: e.fullName, aliases: [],
        dateOfBirth: e.dateOfBirth, birthYear: Number(e.dateOfBirth.slice(0, 4)), nationalities: nat, heightCm: null, handedness: null,
        recordConfidence: "VERIFIED", fieldConfidence: { dateOfBirth: "VERIFIED", ...(nat ? { nationalities: "VERIFIED" } : {}) },
        sourceRefs: { identity: [SRC.profixio], dateOfBirth: [SRC.profixio], ...(nat ? { nationalities: [SRC.profixio] } : {}) },
        dataNotes: [`${MILESTONE} (${SNAPSHOT}): added from the Profixio Herrallsvenskan squad registration; Profixio person ${e.profixioPlayerId} (${profileUrl(e)}).`],
      });
      roster.push(newRosterRow(club, files, r.player_id, e.shirtNumber, r.roster_to, refs, [`${MILESTONE} (${SNAPSHOT}): position ${r.roster_to} from ${basis}.`]));
      files.touch(club.playersFile); files.touch(club.rosterFile);
      addSourceIfMissing(ctx, club, "profixio", e.sourceUrl);
      if (refs.includes(SRC.matchSheets)) addSourceIfMissing(ctx, club, "matchSheets", "https://www.profixio.com/app/lx/competition/leagueid28141");
      if (refs.includes(SRC.clubPage)) addSourceIfMissing(ctx, club, "clubPage", "https://www.svenskalag.se/tumbahandboll-herr/truppen");
      ctx.touchedClubs.add(club.clubId);
      continue;
    }

    // ---- membership removal (identity and locked rating retained) ----
    if (r.roster_action === "REMOVE_2026_27_MEMBERSHIP") {
      const idx = roster.findIndex((x) => x.playerId === r.player_id);
      op("REMOVE_MEMBERSHIP", `${r.roster_from}; identity + locked rating kept`, idx >= 0);
      if (idx < 0 || !applyMode) continue;
      roster.splice(idx, 1); files.touch(club.rosterFile);
      const rec = players.find((p) => p.playerId === r.player_id);
      if (!rec) throw new Error(`${r.player_id}: identity record missing`);
      rec.dataNotes = [...(rec.dataNotes ?? []), `${MILESTONE} (${SNAPSHOT}): 2026/27 Herrallsvenskan roster membership at ${club.clubName} removed -- not in any of the 288 Profixio registrations nor on any of the 21 published match sheets. Identity and locked rating retained.`];
      files.touch(club.playersFile);
      ctx.touchedClubs.add(club.clubId);
      continue;
    }

    // ---- names (playerId never changes) ----
    if (r.roster_action === "RENAME_KEEP_ID" || r.roster_action === "ADD_ALIAS") {
      const rec = players.find((p) => p.playerId === r.player_id);
      if (!rec) throw new Error(`${r.player_id}: identity record missing`);
      if (r.roster_action === "ADD_ALIAS") {
        const alias = (r.notes.match(/short form "([^"]+)"/) ?? [])[1];
        if (!alias) throw new Error(`${r.id}: alias not found in decision notes`);
        const needed = !(rec.aliases ?? []).includes(alias);
        op("ADD_ALIAS", `alias "${alias}"`, needed);
        if (!needed || !applyMode) continue;
        rec.aliases = [...(rec.aliases ?? []), alias];
      } else {
        const e = squadEntry(r.club, r.roster_to);
        if (!e) throw new Error(`${r.roster_to}: no Profixio registration`);
        const needed = rec.fullName !== e.fullName;
        op("RENAME", `"${r.roster_from}" -> "${e.fullName}" (alias kept)`, needed);
        if (!needed || !applyMode) continue;
        const old = rec.fullName;
        Object.assign(rec, { firstName: e.firstName, lastName: e.lastName, fullName: e.fullName });
        rec.aliases = [...new Set([...(rec.aliases ?? []), old])];
        rec.dataNotes = [...(rec.dataNotes ?? []), `${MILESTONE} (${SNAPSHOT}): name corrected from "${old}" to the Profixio-registered "${e.fullName}" (same DOB, club and Profixio history; ${profileUrl(e)}). playerId unchanged.`];
      }
      files.touch(club.playersFile); ctx.touchedClubs.add(club.clubId);
      continue;
    }

    // ---- positions (roster) + locked-rating synchronization ----
    if (CANONICAL.has(r.roster_to)) {
      const row = roster.find((x) => x.playerId === r.player_id);
      if (!row) throw new Error(`${r.player_name}: not on ${r.club} roster`);
      const secondary = r.secondary_to ? [r.secondary_to] : row.secondaryPositions;
      // An approved position is a sourced position: the row must also carry VERIFIED confidence and its source.
      const rosterNeeded = row.primaryPosition !== r.roster_to || JSON.stringify(row.secondaryPositions) !== JSON.stringify(secondary) || row.rosterConfidence !== "VERIFIED";
      const locks = files.get<Record<string, LockRecord>>(ratingsFile(club));
      const lock = locks[r.player_id];
      const branchWrong = lock && (lock.branch.branch === "GOALKEEPER") !== (r.roster_to === "MV");
      const lockNeeded = !!lock && fromLock(lock.position) !== r.roster_to;
      if (branchWrong && r.rating_action !== "REGENERATE_BRANCH") throw new Error(`${r.player_name}: branch mismatch not approved for regeneration`);
      const o = op(branchWrong ? "REGENERATE_BRANCH" : "SET_POSITION", `${row.primaryPosition} -> ${r.roster_to}${secondary.length ? ` (secondary ${secondary.join("/")})` : ""}; lock ${lock?.position ?? "none"}`, rosterNeeded || lockNeeded);
      if (!(rosterNeeded || lockNeeded) || !applyMode) continue;
      if (rosterNeeded) {
        const { refs, basis } = positionSources(r);
        const from = row.primaryPosition;
        row.primaryPosition = r.roster_to; row.sourcePosition = r.roster_to; row.secondaryPositions = secondary;
        row.rosterConfidence = "VERIFIED"; row.snapshotDate = SNAPSHOT;
        row.sourceRefs = { ...(row.sourceRefs ?? {}), position: secondary.length && r.secondary_to ? [...refs, ...(row.sourceRefs?.position ?? [])] : refs };
        row.dataNotes = [...(row.dataNotes ?? []).filter((n) => !/^HM-DATA-ALLSVENSKAN-1\.1: .*(position|broad role)/i.test(n)),
          `${MILESTONE} (${SNAPSHOT}): primaryPosition ${from === r.roster_to ? `${from} confirmed` : `${from} -> ${r.roster_to}`} (${basis})${r.secondary_to ? `; secondary ${r.secondary_to} from the club roster page` : ""}.`];
        files.touch(club.rosterFile);
        for (const ref of refs) if (ref === SRC.research) addSourceIfMissing(ctx, club, "research", null); else if (ref === SRC.matchSheets) addSourceIfMissing(ctx, club, "matchSheets", "https://www.profixio.com/app/lx/competition/leagueid28141"); else addSourceIfMissing(ctx, club, "profixio", squads.find((s) => s.club === club.clubName)?.sourceUrl ?? null);
      }
      if (branchWrong) ctx.regenerations.push({ op: o, clubId: club.clubId, position: r.roster_to });
      else if (lockNeeded) o.detail += `; ${syncLockPosition(ctx, lock, r.roster_to, ratingsFile(club))}`;
      ctx.touchedClubs.add(club.clubId);
      continue;
    }
    if (r.roster_action === "NONE" && r.rating_action === "NONE") continue;
    throw new Error(`${r.id}: unhandled approved row (${r.roster_action}/${r.rating_action})`);
  }
}

function evidencePosition(r: Record<string, string>): string | null {
  // Cross-league rows carry the Profixio position (if any) in the HM-DATA-1.0 audit; HM-DATA-1.2 kept it in roster_to only for in-league rows.
  const e = squads.find((s) => s.club === r.club && s.fullName === r.player_name);
  const p = e ? profilePositions[`${e.profixioClubId}/${e.profixioPlayerId}`] : undefined;
  return p && CANONICAL.has(p) ? p : null;
}
const profilePositions: Record<string, string> = Object.fromEntries(
  readJson<{ profixioClubId: string; profixioPlayerId: string; profilePosition: string | null }[]>(path.resolve(arg("--squads") ?? ""))
    .filter((s) => s.profilePosition).map((s) => [`${s.profixioClubId}/${s.profixioPlayerId}`, s.profilePosition as string]),
);

function adjustOtherLeagueCounts(ctx: Context, club: EditorClubEntry, delta: number): void {
  const m = manifestFile(club);
  if (fs.existsSync(m)) { const man = ctx.files.get<JsonObject>(m); if (typeof man.playerCount === "number") { man.playerCount += delta; ctx.files.touch(m); } }
}

function refreshAllsvenskanQc(ctx: Context, held: { player: string; club: string; reason: string }[]): void {
  for (const clubId of ctx.touchedClubs) {
    const club = catalogNow().clubs.find((c) => c.clubId === clubId)!;
    if (club.competitionId !== ALLSVENSKAN) continue;
    const roster = readJson<RosterRow[]>(club.rosterFile);
    const players = new Map(readJson<PlayerRecord[]>(club.playersFile).map((p) => [p.playerId, p]));
    const onRoster = roster.map((r) => players.get(r.playerId)).filter((p): p is PlayerRecord => !!p);
    const qcPath = qcFile(club);
    if (qcPath) {
      const qc = readJson<JsonObject & { checks: JsonObject; openFieldsSummary: JsonObject; staleSourceWarnings: string[] }>(qcPath);
      const heldHere = held.filter((h) => h.club === club.clubName).map((h) => `${h.player} (${h.reason})`);
      Object.assign(qc, { snapshotDate: SNAPSHOT, expectedRosterCount: roster.length, exportedRosterCount: roster.length });
      qc.checks.duplicatePlayers = roster.length - new Set(roster.map((r) => r.playerId)).size;
      Object.assign(qc.openFieldsSummary, {
        exactDateOfBirthMissing: onRoster.filter((p) => !p.dateOfBirth).length,
        nationalityMissing: onRoster.filter((p) => !Array.isArray(p.nationalities) || (p.nationalities as unknown[]).length === 0).length,
        shirtNumberMissing: roster.filter((r) => r.shirtNumber === null).length,
        positionGenerated: roster.filter((r) => r.rosterConfidence === "UNKNOWN").length,
        positionPartial: roster.filter((r) => r.rosterConfidence === "PARTIAL").length,
        positionVerified: roster.filter((r) => r.rosterConfidence === "VERIFIED").length,
      });
      const warning = `${MILESTONE}: roster corrected against Profixio leagueid28141 (${SNAPSHOT}).${heldHere.length ? ` Held pending verification: ${heldHere.join("; ")}.` : ""}`;
      qc.staleSourceWarnings = [...(qc.staleSourceWarnings ?? []).filter((w) => !w.startsWith(`${MILESTONE}:`)), warning];
      atomicWriteJsonFile(qcPath, qc);
    }
    const man = readJson<JsonObject>(manifestFile(club));
    if (man.milestone !== MILESTONE || man.snapshotDate !== SNAPSHOT) atomicWriteJsonFile(manifestFile(club), { ...man, milestone: MILESTONE, snapshotDate: SNAPSHOT });
  }
}

// ---------------------------------------------------------------- snapshot of the whole data root (for validation)
interface Snapshot {
  locks: Map<string, { file: string; lock: LockRecord }>;
  identities: Map<string, { file: string; record: PlayerRecord }>;
  duplicateIdentities: string[];
  rosterRows: { file: string; clubId: string; competitionId: string; row: RosterRow }[];
}
function snapshotRoot(): Snapshot {
  const snap: Snapshot = { locks: new Map(), identities: new Map(), duplicateIdentities: [], rosterRows: [] };
  const ratingFiles = new Set<string>();
  for (const c of catalogNow().clubs) {
    for (const p of readJson<PlayerRecord[]>(c.playersFile)) { if (snap.identities.has(p.playerId)) snap.duplicateIdentities.push(p.playerId); snap.identities.set(p.playerId, { file: c.playersFile, record: p }); }
    for (const r of readJson<RosterRow[]>(c.rosterFile)) snap.rosterRows.push({ file: c.rosterFile, clubId: c.clubId, competitionId: c.competitionId, row: r });
    const rf = ratingsFile(c);
    if (fs.existsSync(rf) && !ratingFiles.has(rf)) { ratingFiles.add(rf); for (const [pid, l] of Object.entries(readJson<Record<string, LockRecord>>(rf))) snap.locks.set(pid, { file: rf, lock: l }); }
  }
  return snap;
}

interface Check { name: string; ok: boolean; detail: string }
function validate(before: Snapshot | null, expected: { regenerated: Set<string>; moved: Set<string>; positionSynced: Set<string>; removedMemberships: Set<string>; added: Set<string> } | null): Check[] {
  const checks: Check[] = [];
  const after = snapshotRoot();
  const push = (name: string, problems: string[], okDetail: string) => checks.push({ name, ok: problems.length === 0, detail: problems.length ? problems.slice(0, 25).join("; ") + (problems.length > 25 ? ` (+${problems.length - 25} more)` : "") : okDetail });

  // 1. every club in every competition loads, validates and is non-empty
  const clubProblems: string[] = []; let clubs = 0;
  for (const c of catalogNow().clubs) {
    clubs++;
    const squad = loadRealWorldClubSquad(c.clubId, dataRoot);
    if (!squad) { clubProblems.push(`${c.clubId}: not loadable`); continue; }
    const v = validateClubSquad(squad);
    if (!v.ok) clubProblems.push(...v.errors);
    if (squad.players.length === 0) clubProblems.push(`${c.clubId}: empty squad`);
  }
  push("all clubs (all competitions) load, validate and are non-empty", clubProblems, `${clubs} clubs OK`);

  // 2. one roster membership per playerId across all leagues
  const memberships = new Map<string, string[]>();
  for (const r of after.rosterRows) memberships.set(r.row.playerId, [...(memberships.get(r.row.playerId) ?? []), r.clubId]);
  push("playerId has at most one roster membership across all leagues", [...memberships].filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.join(", ")}`), `${memberships.size} memberships, all unique`);

  // 3. one identity record per playerId across all leagues
  push("playerId has exactly one identity record across all leagues", after.duplicateIdentities, `${after.identities.size} identities, all unique`);

  // 4. no new name+DOB collisions across leagues
  const key = (p: PlayerRecord) => `${p.fullName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}|${p.dateOfBirth}`;
  const collisions = (s: Snapshot) => { const m = new Map<string, string[]>(); for (const { record } of s.identities.values()) if (record.dateOfBirth) m.set(key(record), [...(m.get(key(record)) ?? []), record.playerId]); return new Map([...m].filter(([, v]) => v.length > 1)); };
  const afterCollisions = collisions(after); const beforeCollisions = before ? collisions(before) : new Map();
  push("no new name+DOB identity collisions across leagues", [...afterCollisions].filter(([k]) => !beforeCollisions.has(k)).map(([k, v]) => `${k}: ${v.join(", ")}`), `${afterCollisions.size} pre-existing, 0 new`);

  // 5. Herrallsvenskan roster <-> locked rating consistency (position, GK/OUTCOURT branch, clubId)
  const consistency: string[] = []; const heldDrift: string[] = []; let locked = 0; let unlocked = 0;
  for (const r of after.rosterRows.filter((x) => x.competitionId === ALLSVENSKAN)) {
    const l = after.locks.get(r.row.playerId);
    if (!l) { unlocked++; if (expected && !expected.added.has(r.row.playerId)) consistency.push(`${r.row.playerId}: no locked rating`); continue; }
    locked++;
    if (fromLock(l.lock.position) !== r.row.primaryPosition) {
      // A held player's drift is pre-existing and deliberately untouched (HM-DATA-1.3 HOLD); anything else is a failure.
      const pre = before?.locks.get(r.row.playerId);
      const preRow = before?.rosterRows.find((x) => x.row.playerId === r.row.playerId);
      const message = `${r.row.playerId}: roster ${r.row.primaryPosition} vs lock ${l.lock.position}`;
      if (heldPlayerIds.has(r.row.playerId) && pre && preRow && pre.lock.position === l.lock.position && preRow.row.primaryPosition === r.row.primaryPosition) heldDrift.push(message);
      else consistency.push(message);
    }
    if ((l.lock.branch.branch === "GOALKEEPER") !== (r.row.primaryPosition === "MV")) consistency.push(`${r.row.playerId}: branch ${l.lock.branch.branch} vs ${r.row.primaryPosition}`);
    if (l.lock.clubId !== r.clubId) consistency.push(`${r.row.playerId}: lock clubId ${l.lock.clubId} vs roster ${r.clubId}`);
  }
  push("Herrallsvenskan roster position == locked position, MV <=> GOALKEEPER branch, lock clubId == roster club", consistency,
    `${locked} locked players consistent; ${unlocked} new players use the game-prior rating${heldDrift.length ? `; held with pre-existing position drift (untouched by design): ${heldDrift.join("; ")}` : ""}`);

  if (before && expected) {
    // 6. CA/PA unchanged for every pre-existing lock (all leagues)
    const caPa: string[] = []; let compared = 0;
    for (const [pid, b] of before.locks) {
      const a = after.locks.get(pid);
      if (!a) { caPa.push(`${pid}: lock disappeared`); continue; }
      compared++;
      if (a.lock.ca.value !== b.lock.ca.value || (a.lock.pa?.value ?? null) !== (b.lock.pa?.value ?? null)) caPa.push(`${pid}: CA/PA ${b.lock.ca.value}/${b.lock.pa?.value} -> ${a.lock.ca.value}/${a.lock.pa?.value}`);
    }
    push("CA/PA unchanged for every pre-existing locked rating (all leagues)", caPa, `${compared} locks compared, 0 CA/PA changes`);

    // 7. attributes changed only for the approved branch regenerations; other lock fields only where approved
    const attr: string[] = []; const other: string[] = [];
    for (const [pid, b] of before.locks) {
      const a = after.locks.get(pid); if (!a) continue;
      const sameAttrs = JSON.stringify(a.lock.branch) === JSON.stringify(b.lock.branch);
      if (!sameAttrs && !expected.regenerated.has(pid)) attr.push(pid);
      if (expected.regenerated.has(pid)) continue;
      const strip = (l: LockRecord) => JSON.stringify({ ...l, position: undefined, attackRoleProficiencies: undefined, clubId: undefined });
      if (strip(a.lock) !== strip(b.lock)) other.push(`${pid}: unexpected lock field change`);
      const posChanged = a.lock.position !== b.lock.position || JSON.stringify(a.lock.attackRoleProficiencies) !== JSON.stringify(b.lock.attackRoleProficiencies);
      if (posChanged && !expected.positionSynced.has(pid)) other.push(`${pid}: unapproved position/role change`);
      if (a.lock.clubId !== b.lock.clubId && !expected.moved.has(pid)) other.push(`${pid}: unapproved clubId change`);
    }
    push("generated attributes changed only for the approved GK/OUTCOURT regenerations", attr, `${expected.regenerated.size} regenerated, all other attribute sets identical`);
    push("other locked-rating changes limited to approved position/role syncs and moves", other, "no unapproved lock changes");

    // 8. no identity lost
    push("every pre-existing identity still exists", [...before.identities.keys()].filter((k) => !after.identities.has(k)), `${before.identities.size} identities preserved`);

    // 9. membership changes limited to approved adds/removals/moves; other leagues only for the moved players
    const mem = (s: Snapshot) => new Map(s.rosterRows.map((r) => [r.row.playerId, r.clubId]));
    const mb = mem(before); const ma = mem(after); const changes: string[] = [];
    for (const [pid, c] of mb) if (ma.get(pid) !== c && !expected.moved.has(pid) && !expected.removedMemberships.has(pid)) changes.push(`${pid}: ${c} -> ${ma.get(pid) ?? "none"}`);
    for (const [pid, c] of ma) if (!mb.has(pid) && !expected.added.has(pid)) changes.push(`${pid}: unexpected new membership at ${c}`);
    const otherLeague = before.rosterRows.filter((r) => r.competitionId !== ALLSVENSKAN && !ma.has(r.row.playerId) && !expected.moved.has(r.row.playerId));
    push("membership changes limited to approved adds, removals and moves", [...changes, ...otherLeague.map((r) => `${r.row.playerId}: other-league membership lost`)], "only approved membership changes");
  }
  return checks;
}

// ---------------------------------------------------------------- main
function main(): void {
  fs.mkdirSync(reportDir, { recursive: true });
  if (validateOnly) {
    const checks = validate(null, null);
    fs.writeFileSync(path.join(reportDir, "validation-only.json"), JSON.stringify(checks, null, 2));
    for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} -- ${c.detail}`);
    process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
    return;
  }

  const before = snapshotRoot();
  const ctx: Context = { files: new FileSet(), ops: [], touchedClubs: new Set(), otherLeagueClubs: new Set(), regenerations: [], attributeReport: [] };

  // One pass: each operation records whether it is still needed; in --apply mode it also stages its edits in memory.
  const savedApply = applyMode;
  plan(ctx);
  const needed = ctx.ops.filter((o) => o.needed);
  const summary = ctx.ops.reduce<Record<string, { total: number; needed: number }>>((m, o) => { (m[o.kind] ??= { total: 0, needed: 0 }).total++; if (o.needed) m[o.kind].needed++; return m; }, {});
  console.log(`${MILESTONE} ${savedApply ? "APPLY" : "PLAN"} against ${dataRoot}`);
  console.table(summary);
  fs.writeFileSync(path.join(reportDir, savedApply ? "apply-operations.json" : "plan-operations.json"), JSON.stringify({ dataRoot, summary, ops: ctx.ops }, null, 2));
  if (!savedApply) { console.log(`${needed.length} operation(s) would change data; nothing written.`); return; }
  if (needed.length === 0) { console.log("Nothing to do: every approved correction is already in place (idempotent re-run)."); writeValidation(before, null); return; }

  // Back up every file the apply will touch (plus its existing .bak) before writing.
  const toWrite = new Set(ctx.files.dirty);
  for (const clubId of ctx.touchedClubs) {
    const c = catalogNow().clubs.find((x) => x.clubId === clubId)!;
    for (const f of [c.playersFile, c.rosterFile, ratingsFile(c), overridesFile(c), reviewFile(c), manifestFile(c), qcFile(c), c.sourcesFile]) if (f && fs.existsSync(f)) toWrite.add(f);
  }
  if (backupDir) {
    const manifest: { file: string; sha256: string; bak?: string }[] = [];
    for (const f of [...toWrite].sort()) {
      const rel = path.relative(dataRoot, f);
      const dest = path.join(backupDir, "data-real-world", rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(f, dest);
      const entry: { file: string; sha256: string; bak?: string } = { file: rel.split(path.sep).join("/"), sha256: sha256(f) };
      if (fs.existsSync(`${f}.bak`)) { fs.copyFileSync(`${f}.bak`, `${dest}.bak`); entry.bak = `${entry.file}.bak`; }
      manifest.push(entry);
    }
    fs.writeFileSync(path.join(backupDir, "backup-manifest.json"), JSON.stringify({ milestone: MILESTONE, dataRoot, createdAt: new Date().toISOString(), files: manifest }, null, 2));
    console.log(`Backed up ${manifest.length} file(s) to ${backupDir}`);
  }

  // Phase 1: roster/identity/lock edits, written once per file.
  const written = ctx.files.writeAll();
  ctx.files.forget();

  // Phase 2: GK/OUTCOURT regenerations through the existing calibration path (reads the corrected roster).
  for (const g of ctx.regenerations) {
    const locksPath = ratingsFile(catalogNow().clubs.find((c) => c.clubId === g.clubId)!);
    const old = readJson<Record<string, LockRecord>>(locksPath)[g.op.playerId];
    const res = calibratePlayerRating(g.clubId, g.op.playerId, toRatingPosition(g.position as CanonicalPosition), old.ca.value, old.pa?.value, `${MILESTONE} (${SNAPSHOT}) GK/OUTCOURT branch correction to ${g.position}; researched CA/PA preserved, generated attributes regenerated (HM-RATINGS-0.4-v1)`, dataRoot);
    if (!res.ok || !res.record) throw new Error(`${g.op.player}: calibration failed: ${res.errors.join("; ")}`);
    const neu = res.record as unknown as LockRecord;
    if (neu.ca.value !== old.ca.value || (neu.pa?.value ?? null) !== (old.pa?.value ?? null)) throw new Error(`${g.op.player}: CA/PA changed during regeneration`);
    const oldAttrs = old.branch.attributes; const newAttrs = neu.branch.attributes;
    const shared = Object.keys(oldAttrs).filter((k) => k in newAttrs);
    ctx.attributeReport.push({
      id: g.op.id, player: g.op.player, playerId: g.op.playerId, clubId: g.clubId, from: `${old.position}/${old.branch.branch}`, to: `${neu.position}/${neu.branch.branch}`,
      ca: old.ca.value, pa: old.pa?.value ?? null, caPaUnchanged: true,
      roleLabelsBefore: old.attackRoleProficiencies.map((x) => x.role), roleLabelsAfter: neu.attackRoleProficiencies.map((x) => x.role),
      removedAttributes: Object.fromEntries(Object.entries(oldAttrs).filter(([k]) => !(k in newAttrs)).map(([k, v]) => [k, v.value])),
      addedAttributes: Object.fromEntries(Object.entries(newAttrs).filter(([k]) => !(k in oldAttrs)).map(([k, v]) => [k, v.value])),
      sharedAttributeChanges: Object.fromEntries(shared.filter((k) => oldAttrs[k].value !== newAttrs[k].value).map((k) => [k, `${oldAttrs[k].value} -> ${newAttrs[k].value}`])),
      newAttributeOrigins: [...new Set(Object.values(newAttrs).map((v) => v.origin))],
    });
    g.op.detail += `; regenerated ${old.branch.branch} -> ${neu.branch.branch}, CA/PA ${old.ca.value}/${old.pa?.value} unchanged`;
    written.push(locksPath);
  }

  // Phase 3: QC + manifest recount for every touched Herrallsvenskan club.
  refreshAllsvenskanQc(ctx, spec.held);

  const expected = {
    regenerated: new Set(ctx.regenerations.map((g) => g.op.playerId)),
    moved: new Set(ctx.ops.filter((o) => o.kind === "MOVE_MEMBERSHIP").map((o) => o.playerId)),
    positionSynced: new Set(ctx.ops.filter((o) => (o.kind === "SET_POSITION" || o.kind === "MOVE_MEMBERSHIP") && /lock position/.test(o.detail)).map((o) => o.playerId)),
    removedMemberships: new Set(ctx.ops.filter((o) => o.kind === "REMOVE_MEMBERSHIP").map((o) => o.playerId)),
    added: new Set(ctx.ops.filter((o) => o.kind === "ADD_PLAYER").map((o) => o.playerId)),
  };
  fs.writeFileSync(path.join(reportDir, "apply-operations.json"), JSON.stringify({ dataRoot, summary, ops: ctx.ops }, null, 2));
  fs.writeFileSync(path.join(reportDir, "gk-outcourt-attribute-report.json"), JSON.stringify(ctx.attributeReport, null, 2));
  writeValidation(before, expected);
}

function writeValidation(before: Snapshot, expected: Parameters<typeof validate>[1]): void {
  const checks = validate(before, expected);
  fs.writeFileSync(path.join(reportDir, "validation.json"), JSON.stringify(checks, null, 2));
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} -- ${c.detail}`);
  if (!checks.every((c) => c.ok)) { process.exitCode = 1; console.error("VALIDATION FAILED -- restore from the backup directory before retrying."); }
}

main();
