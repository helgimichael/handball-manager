"use client";
// Arena Nights 231 -- STF-01a A "Hub secondary tabs": Organisation · Rekrytering · Ansvar as real route tabs with
// badges (no mixed ?view= states in the navigation). Vacancies and negotiations are filter chips inside
// Rekrytering (StaffRecruitmentView). Scrollable segmented control on phones.
// Also STF-03a A (vacancy cards with impact) and STF-03b A (negotiation board by whose move it is).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_EFFECT } from "@/components/staff/StaffInsight";
import { useCareer } from "@/lib/career/CareerContext";
import { pendingProposals } from "@/lib/delegation/delegation";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { vacancies } from "@/lib/staff/organisation";
import { NEGOTIATION_COLUMN_LABEL, negotiationBoard, vacancyCards, type NegotiationColumn } from "@/lib/staff/staffDesk";
import type { StaffRole } from "@/lib/staff/types";

export function StaffNav() {
  const { career } = useCareer();
  const path = usePathname();
  const yourMove = negotiationBoard(career).YOUR_MOVE.length;
  const vacant = vacancies(career, career.playerClubId).length;
  const proposals = pendingProposals(career).length;
  const items: { href: string; label: string; badge?: number; badgeLabel?: string; current: boolean }[] = [
    { href: "/career/staff", label: "Organisation", current: path === "/career/staff" },
    { href: "/career/staff/recruitment", label: "Rekrytering", badge: vacant + yourMove, badgeLabel: `${vacant} vakanta, ${yourMove} förhandlingar väntar på dig`, current: path?.startsWith("/career/staff/recruitment") ?? false },
    { href: "/career/staff/responsibilities", label: "Ansvar", badge: proposals, badgeLabel: `${proposals} förslag väntar`, current: path === "/career/staff/responsibilities" },
  ];
  return (
    <nav className="sf-tabs" aria-label="Personal">
      {items.map((i) => <Link key={i.label} href={i.href} aria-current={i.current ? "page" : undefined}>{i.label}{i.badge ? <b aria-label={i.badgeLabel}>{i.badge}</b> : null}</Link>)}
    </nav>
  );
}

/** STF-03a: one card per vacant role -- what is missing, budget room and the market -- plus "Alla roller". */
export function VacancyCards({ role, onRole }: { role: StaffRole | "ALL"; onRole: (role: StaffRole | "ALL") => void }) {
  const money = useMoney();
  const { career } = useCareer();
  const cards = vacancyCards(career);
  return (
    <section className="sf-vac" aria-labelledby="sf-vac-title">
      <h2 id="sf-vac-title" className="sf-sr">Vakanta tjänster</h2>
      <ul>
        {cards.map((c) => (
          <li key={c.role}>
            <button type="button" className="sf-vac-card" aria-pressed={role === c.role} onClick={() => onRole(c.role)}>
              <small>Vakant{c.open > 1 ? ` · ${c.open} tjänster` : ""}</small>
              <b>{STAFF_ROLE_LABEL[c.role]}</b>
              <span className="sf-vac-impact">{ROLE_EFFECT[c.role]}</span>
              <span className="sf-num sf-vac-room" data-neg={c.roomEurAnnual < 0 || undefined}>{c.roomEurAnnual >= 0 ? `${money.format(c.roomEurAnnual, { compact: true })} kvar i ramen/år` : `${money.format(-c.roomEurAnnual, { compact: true })} över ramen`}{c.fundingEurAnnual ? ` · finansiering ${money.format(c.fundingEurAnnual, { compact: true })}` : ""}</span>
              <span className="sf-num sf-vac-pool">{c.candidates} kandidater · {c.freeAgents} fria</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="sf-vac-card" data-all aria-pressed={role === "ALL" || !cards.some((c) => c.role === role)} onClick={() => onRole("ALL")}>
            <small>{cards.length === 0 ? "Alla tjänster är tillsatta" : "Utan vakans"}</small>
            <b>Alla roller</b>
            <span className="sf-vac-impact">Bläddra på hela personalmarknaden, till exempel för att ersätta en svag passform.</span>
          </button>
        </li>
      </ul>
    </section>
  );
}

/** STF-03b: staff negotiations as a board -- your move first, then waiting for an answer, then closed. */
export function NegotiationBoard() {
  const { career } = useCareer();
  const board = negotiationBoard(career);
  const name = (id: string) => Object.values(career.staffRoster).flat().find((m) => m.id === id)?.displayName ?? career.staffMarket?.freeAgents[id]?.displayName ?? career.scoutMarket?.[id]?.displayName ?? id;
  const STAGE: Record<string, string> = { CLUB: "Klubben", TERMS: "Villkoren", COMPLETED: "Klart", REJECTED: "Avbrutet av motparten", WITHDRAWN: "Du drog dig ur", EXPIRED: "Gick ut" };
  const total = board.YOUR_MOVE.length + board.WAITING.length + board.DONE.length;
  if (total === 0) return <div className="sf-empty"><p>Inga förhandlingar ännu. Välj en vakans eller en kandidat på marknaden och lägg ett bud från profilen.</p><Link className="hm-btn hm-btn-sm" href="/career/staff/recruitment">Till marknaden</Link></div>;
  return (
    <section className="sf-board" aria-label="Förhandlingar">
      {(Object.keys(board) as NegotiationColumn[]).map((col) => (
        <section key={col} className="sf-board-col" data-col={col} aria-labelledby={`sf-col-${col}`}>
          <h3 id={`sf-col-${col}`}>{NEGOTIATION_COLUMN_LABEL[col]} <b className="sf-num">{board[col].length}</b></h3>
          {board[col].length === 0 ? <p className="sf-hint">{col === "YOUR_MOVE" ? "Inget väntar på dig." : col === "WAITING" ? "Inga bud ute." : "Inget avslutat ännu."}</p> : (
            <ul>
              {board[col].map((n) => (
                <li key={n.id}>
                  <Link href={`/career/staff/${encodeURIComponent(n.staffId)}?from=recruitment`}>
                    <b>{name(n.staffId)}</b>
                    <small>{STAFF_ROLE_LABEL[n.role]} · {n.kind === "HIRE" ? "rekrytering" : "förlängning"} · {STAGE[n.stage] ?? n.stage}</small>
                    <span className="sf-num">{col === "WAITING" ? `Svar ${n.answerOn}` : col === "YOUR_MOVE" ? `Svara senast ${n.deadline}` : `${n.rounds.at(-1)?.date ?? ""}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}
