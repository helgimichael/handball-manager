// Controlled apply of approved Swedish real-world roster corrections
// (HM-DATA-1.3 Herrallsvenskan; HM-DATA-1.5 Division 1 + identity merge).
//
// Inputs (all read-only): a decision CSV, an approval spec for one milestone
// (explicit approved/held row ids, milestone, snapshot date, competitions to
// validate) and the parsed Profixio squad registrations (comma-separated
// list). Never runs an original ID-generating import: existing playerIds are
// preserved, and the only new ids are ones already proposed and
// collision-checked in the decision CSV.
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
//   node --import tsx scripts/apply-swedish-roster-corrections.ts \
//     --proposal <csv> --spec <json> --squads <json[,json]> --report-dir <dir> \
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

const ALLSVENSKAN = "swe-2";
const SEASON = "2026/27";
const ARCHETYPE_SET: Record<string, string> = { V9: "SIDE_BACK", H9: "SIDE_BACK", M9: "CENTRE_BACK", V6: "WING", H6: "WING", M6: "PIVOT", MV: "GK" };
const CANONICAL = new Set(["MV", "V6", "V9", "M9", "H9", "H6", "M6"]);
const COMPETITIONS: Record<string, { label: string; profixio: string; research: string }> = {
  "swe-2": { label: "Herrallsvenskan", profixio: "leagueid28141", research: "ALLSV_rating_import_candidates_v0.13.csv" },
  se_division1_norra: { label: "Division 1 Norra", profixio: "leagueid28142", research: "DIV1N_rating_import_candidates_v0.6.csv" },
  se_division1_sodra: { label: "Division 1 Södra", profixio: "leagueid28142", research: "DIV1S_rating_import_candidates_v0.5.csv" },
  se_handbollsligan_herr: { label: "Handbollsligan", profixio: "", research: "HBL_rating_import_candidates_v2.13.csv" },
};
const label = (competitionId: string) => COMPETITIONS[competitionId]?.label ?? competitionId;

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
  const swedish = catalogNow().clubs.filter((c) => c.competitionId in COMPETITIONS);
  const byName = swedish.filter((c) => c.clubName === name);
  const matches = byName.length ? byName : swedish.filter((c) => path.basename(c.clubDir) === name);
  if (matches.length !== 1) throw new Error(`club "${name}" matches ${matches.length} Swedish clubs`);
  return matches[0];
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
const spec = readJson<{ milestone: string; snapshotDate: string; validateCompetitions?: string[]; approvedIds: string[]; held: { id: string; player: string; club: string; reason: string }[] }>(path.resolve(arg("--spec") ?? ""));
const MILESTONE = spec.milestone;
const SNAPSHOT = spec.snapshotDate;
const VALIDATE_COMPETITIONS = spec.validateCompetitions ?? [ALLSVENSKAN];
// Source ids are milestone-scoped (HM-DATA-1.3 -> src_hm13_*), so each milestone's provenance stays distinguishable.
const tag = `hm${MILESTONE.replace(/\D/g, "")}`;
const SRC = {
  profixio: `src_${tag}_profixio_registration`,
  matchSheets: `src_${tag}_profixio_match_sheets`,
  research: `src_${tag}_rating_research`,
  clubPage: `src_${tag}_club_squad_page`,
  carriedOver: `src_${tag}_previous_league_record`,
  loan: `src_${tag}_owner_confirmed_loan`,
} as const;
type SquadEntry = { club: string; fullName: string; firstName: string; lastName: string; dateOfBirth: string | null; shirtNumber: number | null; nationalityFlag: string | null; profixioPlayerId: string; profixioClubId: string; sourceUrl: string; profilePosition?: string | null };
const squads = (arg("--squads") ?? "").split(",").filter(Boolean).flatMap((f) => readJson<SquadEntry[]>(path.resolve(f)));
const approved = new Set(spec.approvedIds);
const rows = proposal.filter((r) => approved.has(r.id));
if (rows.length !== spec.approvedIds.length) throw new Error(`spec lists ${spec.approvedIds.length} approved ids but ${rows.length} match the proposal`);
const squadEntry = (club: string, name: string) => squads.find((s) => s.club === club && s.fullName === name);
const profileUrl = (e: { profixioClubId: string; profixioPlayerId: string }) => `https://www.profixio.com/app/lx/clubs/${e.profixioClubId}/player/${e.profixioPlayerId}`;

// Where each applied position comes from. A decision row may state it explicitly (`source_keys`
// ";"-separated keys of SRC, plus `basis`); otherwise the HM-DATA-1.2 evidence rules apply.
function positionSources(r: Record<string, string>): { refs: string[]; basis: string } {
  if (r.source_keys) return { refs: r.source_keys.split(";").map((k) => SRC[k as keyof typeof SRC]), basis: r.basis };
  const name = r.player_name;
  if (r.category === "ROSTER_LOCK_DRIFT") return { refs: [SRC.research], basis: "rating research v0.13 role label" };
  if (name === "Oskar Waltin") return { refs: [SRC.clubPage], basis: "club squad page 'Linjespelare'" };
  if (name === "Ludvig Hedin" || name === "Gustav Simonsson") return { refs: [SRC.matchSheets], basis: "Profixio match-sheet goalkeeper (RMV) flag" };
  if (name === "Simon Larsson") return { refs: [SRC.research, SRC.matchSheets], basis: "rating research 'Allsvenskan H9'; never goalkeeper on match sheets" };
  if (r.category === "GK_OUTFIELD_CONFLICT") return { refs: [SRC.profixio, SRC.matchSheets], basis: "Profixio profile position, corroborated by match-sheet goalkeeper flags" };
  return { refs: [SRC.profixio], basis: "Profixio player profile position" };
}

// ---------------------------------------------------------------- operations
type OpKind = "ADD_PLAYER" | "SET_POSITION" | "REGENERATE_BRANCH" | "REMOVE_MEMBERSHIP" | "MOVE_MEMBERSHIP" | "RENAME" | "ADD_ALIAS" | "MERGE_IDENTITY";
interface Op { id: string; kind: OpKind; player: string; playerId: string; club: string; detail: string; needed: boolean }
interface Merge { retiredId: string; canonicalId: string; caPaBefore: string; caPaAfter: string }
interface Context { files: FileSet; ops: Op[]; touchedClubs: Set<string>; otherLeagueClubs: Set<string>; regenerations: { op: Op; clubId: string; position: string }[]; attributeReport: unknown[]; merges: Merge[] }

function addSourceIfMissing(ctx: Context, club: EditorClubEntry, key: keyof typeof SRC, url: string | null): void {
  if (!club.sourcesFile) return;
  const sources = ctx.files.get<JsonObject[]>(club.sourcesFile);
  const id = SRC[key];
  if (sources.some((s) => s.sourceId === id)) return;
  const comp = COMPETITIONS[club.competitionId];
  const meta: Record<keyof typeof SRC, [string, string, string]> = {
    profixio: ["FEDERATION_OFFICIAL", "Svenska Handbollförbundet (Profixio)", `${comp.label} ${SEASON} squad registration and player profiles (${comp.profixio})`],
    matchSheets: ["FEDERATION_OFFICIAL", "Svenska Handbollförbundet (Profixio)", `${comp.label} ${SEASON} match sheets (laguppställningar, RMV goalkeeper flags)`],
    research: ["RESEARCH_COMPILED", "Handball Manager rating research", `${comp.research} (exports/player-rating-research) role labels`],
    clubPage: ["CLUB_OFFICIAL", club.clubName, "Official club squad page"],
    carriedOver: ["GAME_DATA", "Handball Manager real-world data", "Position carried over from the player's previous (other-league) verified roster record"],
    loan: ["OWNER_CONFIRMED", "Handball Manager owner", `Loan ${SEASON}: contract club and playable (loan) club confirmed by the owner (${MILESTONE})`],
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
    rosterEntryId: `${prefix}__${playerId.slice(-8)}`, playerId, clubId: club.clubId, competitionId: club.competitionId, season: SEASON, snapshotDate: SNAPSHOT,
    shirtNumber: shirt, sourcePosition: pos, primaryPosition: pos, secondaryPositions: secondary, rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null }, rosterConfidence: "VERIFIED",
    sourceRefs: { roster: [SRC.profixio], position: refs }, dataNotes: notes, defaultSquadStatus: null, specialTags: [],
  };
}

function plan(ctx: Context): void {
  const { files } = ctx;
  for (const r of rows) {
    const op = (kind: OpKind, detail: string, needed: boolean): Op => { const o = { id: r.id, kind, player: r.player_name, playerId: r.player_id, club: r.club, detail, needed }; ctx.ops.push(o); return o; };

    // ---- duplicate identity of one real person (owner-confirmed loan): one identity, one playable registration ----
    if (r.roster_action === "MERGE_IDENTITY") {
      const target = clubByName(r.club); // playable (loan) club
      const contract = clubByName(r.contract_club);
      const retiredId = r.roster_from; const canonicalId = r.player_id;
      const needed = !!clubHoldingIdentity(files, retiredId) || !!clubHolding(files, retiredId) || clubHolding(files, canonicalId)?.clubId !== target.clubId;
      const o = op("MERGE_IDENTITY", `${retiredId} retired into ${canonicalId}; playable at ${target.clubName}, contract club ${contract.clubName}`, needed);
      if (!needed || !applyMode) continue;
      const tRoster = files.get<RosterRow[]>(target.rosterFile); const tPlayers = files.get<PlayerRecord[]>(target.playersFile);
      const cRoster = files.get<RosterRow[]>(contract.rosterFile); const cPlayers = files.get<PlayerRecord[]>(contract.playersFile);
      const retiredRow = tRoster.find((x) => x.playerId === retiredId); const retiredRec = tPlayers.find((x) => x.playerId === retiredId);
      const canonicalRow = cRoster.find((x) => x.playerId === canonicalId); const canonicalRec = cPlayers.find((x) => x.playerId === canonicalId);
      if (!retiredRow || !retiredRec || !canonicalRow || !canonicalRec) throw new Error(`${r.player_name}: merge inputs not found as expected`);
      const sameName = (a: string, b: string) => a.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === b.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (!retiredRec.dateOfBirth || retiredRec.dateOfBirth !== canonicalRec.dateOfBirth || !sameName(retiredRec.fullName, canonicalRec.fullName)) throw new Error(`${r.player_name}: identities differ in name/DOB; refusing to merge`);
      const loanNote = `${MILESTONE} (${SNAPSHOT}): on loan for ${SEASON} from contract club ${contract.clubName} (${contract.clubId}) to ${target.clubName} (${target.clubId}), owner-confirmed. The contract club is not the youth/origin club (moderklubb). Playable registration at ${target.clubName} only; no roster row at the contract club.`;
      // Roster: the playable club's registration (shirt, position, squad role) continues under the canonical id.
      const prefix = retiredRow.rosterEntryId.split("__")[0];
      tRoster.splice(tRoster.indexOf(retiredRow), 1, { ...retiredRow, rosterEntryId: `${prefix}__${canonicalId.slice(-8)}`, playerId: canonicalId, snapshotDate: SNAPSHOT,
        sourceRefs: { ...(retiredRow.sourceRefs ?? {}), contractClub: [SRC.loan] }, dataNotes: [...(retiredRow.dataNotes ?? []), loanNote] });
      cRoster.splice(cRoster.indexOf(canonicalRow), 1);
      // Ratings: the playable registration's researched lock and its provenance carry over to the canonical id;
      // the contract-club lock is superseded and recorded on the identity.
      const superseded: Record<string, JsonObject | undefined> = {};
      for (const [kind, tf, cf] of [["lock", ratingsFile(target), ratingsFile(contract)], ["override", overridesFile(target), overridesFile(contract)], ["review", reviewFile(target), reviewFile(contract)]] as const) {
        const t = files.get<Record<string, JsonObject>>(tf); const c = files.get<Record<string, JsonObject>>(cf);
        if (retiredId in t) { t[canonicalId] = kind === "lock" ? { ...t[retiredId], playerId: canonicalId } : t[retiredId]; delete t[retiredId]; }
        superseded[kind] = c[canonicalId]; delete c[canonicalId];
        files.touch(tf); files.touch(cf);
      }
      const kept = files.get<Record<string, LockRecord>>(ratingsFile(target))[canonicalId];
      const old = superseded.lock as unknown as LockRecord | undefined;
      const fmt = (l?: LockRecord) => (l ? `CA ${l.ca.value}/PA ${l.pa?.value ?? "-"} (${String(l.lockedNote ?? "")})` : "none");
      // Identity: the canonical record moves to the playable club; the duplicate record is retired (its id kept in the notes).
      tPlayers.splice(tPlayers.indexOf(retiredRec), 1);
      cPlayers.splice(cPlayers.indexOf(canonicalRec), 1);
      canonicalRec.dataNotes = [...(canonicalRec.dataNotes ?? []),
        `${MILESTONE} (${SNAPSHOT}): merged duplicate identity ${retiredId} (${label(target.competitionId)} import; same person -- name and DOB ${canonicalRec.dateOfBirth} match, owner-confirmed). Rating kept: ${fmt(kept)}; superseded: ${fmt(old)}.`, loanNote];
      tPlayers.push(canonicalRec);
      files.touch(target.rosterFile); files.touch(target.playersFile); files.touch(contract.rosterFile); files.touch(contract.playersFile);
      addSourceIfMissing(ctx, target, "loan", null);
      adjustOtherLeagueCounts(ctx, contract, -1);
      ctx.merges.push({ retiredId, canonicalId, caPaBefore: old ? `${old.ca.value}/${old.pa?.value}` : "none", caPaAfter: kept ? `${kept.ca.value}/${kept.pa?.value}` : "none" });
      o.detail += `; kept ${fmt(kept)}; superseded ${fmt(old)}`;
      ctx.touchedClubs.add(target.clubId); ctx.touchedClubs.add(contract.clubId);
      continue;
    }

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
      // A decision row that states its own evidence (`basis`) uses it; the two fixed texts are the HM-DATA-1.3 cases.
      const notes = r.basis
        ? [`${MILESTONE} (${SNAPSHOT}): ${SEASON} membership moved from ${source.clubName} (${source.competitionId}) to ${target.clubName} -- ${r.basis} (${profileUrl(e)}). Same playerId; previous roster row removed.${pfxPos ? "" : ` Position ${finalPos} carried over from the previous roster record (no Profixio position).`}`]
        : dual
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
        dataNotes: [`${MILESTONE} (${SNAPSHOT}): added from the Profixio ${label(club.competitionId)} squad registration; Profixio person ${e.profixioPlayerId} (${profileUrl(e)}).`],
      });
      roster.push(newRosterRow(club, files, r.player_id, e.shirtNumber, r.roster_to, refs, [`${MILESTONE} (${SNAPSHOT}): position ${r.roster_to} from ${basis}.`]));
      files.touch(club.playersFile); files.touch(club.rosterFile);
      addSourceIfMissing(ctx, club, "profixio", e.sourceUrl);
      if (refs.includes(SRC.matchSheets)) addSourceIfMissing(ctx, club, "matchSheets", `https://www.profixio.com/app/lx/competition/${COMPETITIONS[club.competitionId].profixio}`);
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
      rec.dataNotes = [...(rec.dataNotes ?? []), r.basis ? `${MILESTONE} (${SNAPSHOT}): ${SEASON} ${label(club.competitionId)} roster membership at ${club.clubName} removed -- ${r.basis}. Identity and locked rating retained.` : `${MILESTONE} (${SNAPSHOT}): 2026/27 Herrallsvenskan roster membership at ${club.clubName} removed -- not in any of the 288 Profixio registrations nor on any of the 21 published match sheets. Identity and locked rating retained.`];
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
        row.dataNotes = [...(row.dataNotes ?? []).filter((n) => !/^HM-DATA-(ALLSVENSKAN-1.1|DIV1-1.0): .*(position|broad role)/i.test(n)),
          `${MILESTONE} (${SNAPSHOT}): primaryPosition ${from === r.roster_to ? `${from} confirmed` : `${from} -> ${r.roster_to}`} (${basis})${r.secondary_to && !r.basis ? `; secondary ${r.secondary_to} from the club roster page` : ""}.`];
        files.touch(club.rosterFile);
        for (const ref of refs) if (ref === SRC.research) addSourceIfMissing(ctx, club, "research", null); else if (ref === SRC.matchSheets) addSourceIfMissing(ctx, club, "matchSheets", `https://www.profixio.com/app/lx/competition/${COMPETITIONS[club.competitionId].profixio}`); else addSourceIfMissing(ctx, club, "profixio", squads.find((s) => s.club === club.clubName)?.sourceUrl ?? null);
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
  squads.filter((s) => s.profilePosition).map((s) => [`${s.profixioClubId}/${s.profixioPlayerId}`, s.profilePosition as string]),
);

function adjustOtherLeagueCounts(ctx: Context, club: EditorClubEntry, delta: number): void {
  const m = manifestFile(club);
  if (fs.existsSync(m)) { const man = ctx.files.get<JsonObject>(m); if (typeof man.playerCount === "number") { man.playerCount += delta; ctx.files.touch(m); } }
}

// QC + manifest recount for every touched club in a validated competition (same QC schema in Herrallsvenskan and Division 1).
function refreshQc(ctx: Context, held: { player: string; club: string; reason: string }[]): void {
  for (const clubId of ctx.touchedClubs) {
    const club = catalogNow().clubs.find((c) => c.clubId === clubId)!;
    if (!VALIDATE_COMPETITIONS.includes(club.competitionId)) continue;
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
      const warning = `${MILESTONE}: roster corrected against Profixio ${COMPETITIONS[club.competitionId].profixio} (${SNAPSHOT}).${heldHere.length ? ` Held pending verification: ${heldHere.join("; ")}.` : ""}`;
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

interface Check { name: string; ok: boolean; detail: string; preExisting?: string[]; intended?: string[] }
interface Expected { regenerated: Set<string>; moved: Set<string>; positionSynced: Set<string>; removedMemberships: Set<string>; added: Set<string>; touched: Set<string>; merges: Merge[] }
function validate(before: Snapshot | null, expected: Expected | null): Check[] {
  const checks: Check[] = [];
  const after = snapshotRoot();
  const push = (name: string, problems: string[], okDetail: string, extra: Partial<Check> = {}) => checks.push({ name, ok: problems.length === 0, detail: problems.length ? problems.slice(0, 25).join("; ") + (problems.length > 25 ? ` (+${problems.length - 25} more)` : "") : okDetail, ...extra });
  const retiredTo = new Map((expected?.merges ?? []).map((m) => [m.retiredId, m.canonicalId]));
  const mergedCanonical = new Set((expected?.merges ?? []).map((m) => m.canonicalId));

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

  // 5. roster <-> locked rating consistency (position, GK/OUTCOURT branch, clubId) in every validated competition.
  //    A mismatch fails unless it existed identically before this run on a player the run did not touch:
  //    such pre-existing drift is reported (never hidden) and left for its own decision.
  for (const comp of VALIDATE_COMPETITIONS) {
    const failures: string[] = []; const preExisting: string[] = []; let locked = 0; let unlocked = 0;
    for (const r of after.rosterRows.filter((x) => x.competitionId === comp)) {
      const pid = r.row.playerId;
      const l = after.locks.get(pid);
      if (!l) { unlocked++; if (before?.locks.has(pid)) failures.push(`${pid}: locked rating lost`); continue; }
      locked++;
      const problems: string[] = [];
      if (fromLock(l.lock.position) !== r.row.primaryPosition) problems.push(`roster ${r.row.primaryPosition} vs lock ${l.lock.position}`);
      if ((l.lock.branch.branch === "GOALKEEPER") !== (r.row.primaryPosition === "MV")) problems.push(`branch ${l.lock.branch.branch} vs ${r.row.primaryPosition}`);
      if (l.lock.clubId !== r.clubId) problems.push(`lock clubId ${l.lock.clubId} vs roster ${r.clubId}`);
      if (!problems.length) continue;
      const pre = before?.locks.get(pid); const preRow = before?.rosterRows.find((x) => x.row.playerId === pid);
      const unchanged = !before || (!!pre && !!preRow && pre.lock.position === l.lock.position && pre.lock.branch.branch === l.lock.branch.branch && pre.lock.clubId === l.lock.clubId
        && preRow.row.primaryPosition === r.row.primaryPosition && preRow.clubId === r.clubId);
      (unchanged && !expected?.touched.has(pid) ? preExisting : failures).push(`${pid}: ${problems.join(", ")}`);
    }
    push(`${label(comp)}: roster position == locked position, MV <=> GOALKEEPER branch, lock clubId == roster club (players touched by this run, or changed since the baseline)`, failures,
      `${locked} locked + ${unlocked} unlocked players; 0 new or touched inconsistencies; ${preExisting.length} pre-existing untouched inconsistencies reported separately`, { preExisting });
  }

  if (before && expected) {
    // 6. CA/PA unchanged for every pre-existing lock (all leagues)
    // A retired duplicate's lock lives on under its canonical id; the canonical id's own previous lock is superseded (intended, reported).
    const caPa: string[] = []; const intended: string[] = []; let compared = 0;
    for (const [pid, b] of before.locks) {
      if (mergedCanonical.has(pid)) { const a = after.locks.get(pid); intended.push(`${pid}: superseded ${b.lock.ca.value}/${b.lock.pa?.value} -> kept ${a?.lock.ca.value}/${a?.lock.pa?.value} (identity merge)`); continue; }
      const a = after.locks.get(retiredTo.get(pid) ?? pid);
      if (!a) { caPa.push(`${pid}: lock disappeared`); continue; }
      compared++;
      if (a.lock.ca.value !== b.lock.ca.value || (a.lock.pa?.value ?? null) !== (b.lock.pa?.value ?? null)) caPa.push(`${pid}: CA/PA ${b.lock.ca.value}/${b.lock.pa?.value} -> ${a.lock.ca.value}/${a.lock.pa?.value}`);
    }
    push("CA/PA unchanged for every pre-existing locked rating (all leagues)", caPa, `${compared} locks compared, 0 unintended CA/PA changes${intended.length ? `; intended: ${intended.join("; ")}` : ""}`, { intended });

    // 7. attributes changed only for the approved branch regenerations; other lock fields only where approved
    const attr: string[] = []; const other: string[] = [];
    for (const [pid, b] of before.locks) {
      if (mergedCanonical.has(pid)) continue;
      const a = after.locks.get(retiredTo.get(pid) ?? pid); if (!a) continue;
      const sameAttrs = JSON.stringify(a.lock.branch) === JSON.stringify(b.lock.branch);
      if (!sameAttrs && !expected.regenerated.has(pid)) attr.push(pid);
      if (expected.regenerated.has(pid)) continue;
      const strip = (l: LockRecord) => JSON.stringify({ ...l, playerId: undefined, position: undefined, attackRoleProficiencies: undefined, clubId: undefined });
      if (strip(a.lock) !== strip(b.lock)) other.push(`${pid}: unexpected lock field change`);
      const posChanged = a.lock.position !== b.lock.position || JSON.stringify(a.lock.attackRoleProficiencies) !== JSON.stringify(b.lock.attackRoleProficiencies);
      if (posChanged && !expected.positionSynced.has(pid)) other.push(`${pid}: unapproved position/role change`);
      if (a.lock.clubId !== b.lock.clubId && !expected.moved.has(pid)) other.push(`${pid}: unapproved clubId change`);
    }
    push("generated attributes changed only for the approved GK/OUTCOURT regenerations", attr, `${expected.regenerated.size} regenerated, all other attribute sets identical`);
    push("other locked-rating changes limited to approved position/role syncs and moves", other, "no unapproved lock changes");

    // 8. no identity lost
    push("every pre-existing identity still exists (a merged duplicate survives as its canonical identity)",
      [...before.identities.keys()].filter((k) => !after.identities.has(retiredTo.get(k) ?? k)), `${before.identities.size} identities preserved${retiredTo.size ? ` (${retiredTo.size} merged into canonical)` : ""}`);

    // 9. membership changes limited to approved adds/removals/moves; other leagues only for the moved players
    const mem = (s: Snapshot) => new Map(s.rosterRows.map((r) => [r.row.playerId, r.clubId]));
    const mb = mem(before); const ma = mem(after); const changes: string[] = [];
    for (const [pid, c] of mb) if (ma.get(pid) !== c && !expected.moved.has(pid) && !expected.removedMemberships.has(pid)) changes.push(`${pid}: ${c} -> ${ma.get(pid) ?? "none"}`);
    for (const [pid, c] of ma) if (!mb.has(pid) && !expected.added.has(pid)) changes.push(`${pid}: unexpected new membership at ${c}`);
    const otherLeague = before.rosterRows.filter((r) => !VALIDATE_COMPETITIONS.includes(r.competitionId) && !ma.has(r.row.playerId) && !expected.moved.has(r.row.playerId));
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
  const ctx: Context = { files: new FileSet(), ops: [], touchedClubs: new Set(), otherLeagueClubs: new Set(), regenerations: [], attributeReport: [], merges: [] };

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

  // Phase 3: QC + manifest recount for every touched club.
  refreshQc(ctx, spec.held);

  const expected: Expected = {
    regenerated: new Set(ctx.regenerations.map((g) => g.op.playerId)),
    moved: new Set([...ctx.ops.filter((o) => o.kind === "MOVE_MEMBERSHIP").map((o) => o.playerId), ...ctx.merges.map((m) => m.canonicalId)]),
    positionSynced: new Set(ctx.ops.filter((o) => (o.kind === "SET_POSITION" || o.kind === "MOVE_MEMBERSHIP") && /lock position/.test(o.detail)).map((o) => o.playerId)),
    removedMemberships: new Set([...ctx.ops.filter((o) => o.kind === "REMOVE_MEMBERSHIP").map((o) => o.playerId), ...ctx.merges.map((m) => m.retiredId)]),
    added: new Set(ctx.ops.filter((o) => o.kind === "ADD_PLAYER").map((o) => o.playerId)),
    touched: new Set(ctx.ops.filter((o) => o.needed).flatMap((o) => [o.playerId])),
    merges: ctx.merges,
  };
  fs.writeFileSync(path.join(reportDir, "identity-merges.json"), JSON.stringify(ctx.merges, null, 2));
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
