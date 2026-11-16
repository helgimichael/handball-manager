// Arena Nights -- SQD-05 (B) "Contract timeline (Gantt)". Pure, read-only model over stored contracts.
// Every marker comes from an existing rule or record:
//  - season boundaries: seasonStartDate (1 July, lib/career/staticRelationPartnerships.ts),
//  - transfer windows: isTransferWindowOpen (lib/transfers/transferWindow.ts), probed day by day,
//  - the renewal zone: CONTRACT_EXPIRING_SOON_DAYS (the contract-status rule's "final year" bucket),
//  - payroll/budget: getClubPlayerWageCostsEurAnnual / getClubBudgets; projected renewals from the open
//    talks' latest offer (else the stored demand). No contract rule is changed or predicted.
import type { CareerState } from "../career/types";
import { getCareerSquad } from "../career/careerWorld";
import { addDays, daysBetween } from "../career/dateUtils";
import { seasonStartDate } from "../career/staticRelationPartnerships";
import { isTransferWindowOpen } from "../transfers/transferWindow";
import { CONTRACT_EXPIRING_SOON_DAYS, type ContractStatus } from "../economy/types";
import { getContractStatus } from "../economy/contractLifecycle";
import { getClubBudgets, getClubPlayerWageCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { STAFF_ROLE_LABEL } from "../staff/labels";
import { openTalkFor } from "./renewals";

export interface TimelineRow {
  id: string;
  kind: "PLAYER" | "STAFF";
  name: string;
  /** Position code (players) or role label (staff). */
  group: string;
  endDate: string | null;
  daysLeft: number | null;
  wageEurPerMonth: number | null;
  status: ContractStatus | null;
  /** Bar end on the shared track, 0-100 %. Bars start at today (0 %). */
  endPct: number;
  /** Start of the renewal zone (final year) on the track, 0-100 %. */
  zonePct: number | null;
  /** "2026/27" -- season in which the contract ends (1 July boundary). */
  expirySeason: string | null;
  talk: "OPEN" | "WAITING" | null;
  href: string;
}

export interface TimelineMarker { label: string; startPct: number; endPct: number }

export interface ContractTimeline {
  today: string;
  horizonEnd: string;
  rows: TimelineRow[];
  seasons: { label: string; pct: number }[];
  windows: TimelineMarker[];
  renewalZoneDays: number;
  payroll: { currentAnnualEur: number; budgetAnnualEur: number | null; projectedAnnualEur: number; renewals: { playerId: string; name: string; fromEurPerMonth: number; toEurPerMonth: number; source: "OFFER" | "DEMAND" }[] };
  staffIncluded: number;
}

const seasonLabel = (year: number) => `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
/** Season (1 July boundary) a date falls in, e.g. "2026/27". */
export function seasonOf(date: string): string {
  const y = Number(date.slice(0, 4));
  return seasonLabel(date >= seasonStartDate(String(y)) ? y : y - 1);
}

export function buildContractTimeline(state: CareerState): ContractTimeline {
  const today = state.gameDate;
  const clubId = state.playerClubId;
  const squad = getCareerSquad(state);
  const staff = (state.staffRoster?.[clubId] ?? [])
    .map((m) => ({ m, e: state.staffEmployment?.[m.id] }))
    .filter((x) => x.e?.clubId === clubId && x.e.employmentType === "SALARIED" && !!x.e.contractEndDate);
  const ends = [...squad.map((p) => state.playerContracts[p.id]?.contractEndDate), ...staff.map((x) => x.e!.contractEndDate)].filter((d): d is string => !!d && d > today);
  const latest = ends.sort().at(-1) ?? today;
  // At least two seasons wide so a near-empty timeline still shows windows and boundaries.
  const horizonEnd = [addDays(latest, 45), addDays(today, 730)].sort().at(-1)!;
  const span = Math.max(1, daysBetween(today, horizonEnd));
  const pct = (date: string) => Math.round(Math.max(0, Math.min(1, daysBetween(today, date) / span)) * 1000) / 10;

  const rows: TimelineRow[] = [];
  for (const p of squad) {
    const c = state.playerContracts[p.id];
    const end = c?.contractEndDate ?? null;
    const talk = openTalkFor(state, p.id);
    rows.push({
      id: p.id, kind: "PLAYER", name: `${p.firstName} ${p.lastName}`, group: p.position,
      endDate: end, daysLeft: end ? daysBetween(today, end) : null, wageEurPerMonth: c?.wageEurPerMonth ?? null,
      status: end ? getContractStatus(end, today) : null,
      endPct: end ? pct(end) : 0, zonePct: end ? pct(addDays(end, -CONTRACT_EXPIRING_SOON_DAYS)) : null,
      expirySeason: end ? seasonOf(end) : null,
      talk: talk ? (talk.answerOn ? "WAITING" : "OPEN") : null,
      href: `/career/squad/${encodeURIComponent(p.id)}`,
    });
  }
  for (const { m, e } of staff) {
    const end = e!.contractEndDate!;
    rows.push({
      id: m.id, kind: "STAFF", name: m.displayName, group: m.roles[0] ? STAFF_ROLE_LABEL[m.roles[0]] : "Stab",
      endDate: end, daysLeft: daysBetween(today, end), wageEurPerMonth: e!.wageEurPerMonth ?? null,
      status: getContractStatus(end, today), endPct: pct(end), zonePct: pct(addDays(end, -CONTRACT_EXPIRING_SOON_DAYS)),
      expirySeason: seasonOf(end), talk: null, href: `/career/staff/${encodeURIComponent(m.id)}`,
    });
  }

  const seasons: ContractTimeline["seasons"] = [];
  for (let y = Number(today.slice(0, 4)); ; y++) {
    const d = seasonStartDate(String(y));
    if (d > horizonEnd) break;
    if (d > today) seasons.push({ label: seasonLabel(y), pct: pct(d) });
  }

  const windows: TimelineMarker[] = [];
  let open: string | null = null;
  for (let d = today; d <= horizonEnd; d = addDays(d, 1)) {
    const on = isTransferWindowOpen(d);
    if (on && !open) open = d;
    if ((!on || d === horizonEnd) && open) {
      const last = on ? d : addDays(d, -1);
      const month = Number(open.slice(5, 7));
      windows.push({ label: `${month >= 5 && month <= 9 ? "Sommarfönster" : "Vinterfönster"} ${open} – ${last}`, startPct: pct(open), endPct: pct(last) });
      open = null;
    }
  }

  const currentAnnualEur = Math.round(getClubPlayerWageCostsEurAnnual(state, clubId));
  const renewals: ContractTimeline["payroll"]["renewals"] = [];
  for (const p of squad) {
    const talk = openTalkFor(state, p.id);
    const c = state.playerContracts[p.id];
    if (!talk || !c) continue;
    const offer = talk.rounds.at(-1)?.offer.wageEurPerMonth;
    const to = offer && offer > 0 ? offer : talk.demandEurPerMonth;
    renewals.push({ playerId: p.id, name: `${p.firstName} ${p.lastName}`, fromEurPerMonth: c.wageEurPerMonth, toEurPerMonth: to, source: offer && offer > 0 ? "OFFER" : "DEMAND" });
  }
  const projectedAnnualEur = currentAnnualEur + renewals.reduce((s, r) => s + (r.toEurPerMonth - r.fromEurPerMonth) * 12, 0);
  const budget = getClubBudgets(state, clubId);

  return { today, horizonEnd, rows, seasons, windows, renewalZoneDays: CONTRACT_EXPIRING_SOON_DAYS, payroll: { currentAnnualEur, budgetAnnualEur: budget ? budget.wageBudgetEur : null, projectedAnnualEur, renewals }, staffIncluded: staff.length };
}

export type TimelineSort = "END" | "WAGE" | "NAME";
const POSITION_ORDER = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"];

/** Sorts rows; missing end dates sort first for END (they need attention). */
export function sortTimelineRows(rows: readonly TimelineRow[], sort: TimelineSort): TimelineRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "WAGE") return (b.wageEurPerMonth ?? -1) - (a.wageEurPerMonth ?? -1) || a.name.localeCompare(b.name, "sv");
    if (sort === "NAME") return a.name.localeCompare(b.name, "sv");
    return (a.endDate ?? "").localeCompare(b.endDate ?? "") || a.name.localeCompare(b.name, "sv");
  });
}

/** Groups rows by position (players in court order, then staff roles) or by season of expiry. Row order inside a group is kept. */
export function groupTimelineRows(rows: readonly TimelineRow[], by: "POSITION" | "SEASON"): { key: string; rows: TimelineRow[] }[] {
  const map = new Map<string, TimelineRow[]>();
  for (const r of rows) {
    const key = by === "SEASON" ? r.expirySeason ?? "Avtal saknas" : r.kind === "STAFF" ? `Stab · ${r.group}` : r.group;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const rank = (k: string) => { const i = POSITION_ORDER.indexOf(k); return i >= 0 ? i : k.startsWith("Stab") ? 100 : 50; };
  return [...map.entries()]
    .sort(([a], [b]) => by === "SEASON" ? a.localeCompare(b) : rank(a) - rank(b) || a.localeCompare(b, "sv"))
    .map(([key, rows]) => ({ key, rows }));
}
