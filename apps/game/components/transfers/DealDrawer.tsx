"use client";
// Arena Nights 231 -- REC-03c A "Deal drawer" (and the REC-03 A Deal Panel). The selected player as a
// decision: knowledge-gated ranges, the deal readiness checklist with a visible ✓/✕ and reason per real
// guard, then the actions. A disabled action always shows its reason as text. Sticky right panel on wide
// screens, slide-over drawer on tablets and a bottom sheet with a sticky "Förhandla" on phones.
import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayerGlyph } from "@/components/game/Identity";
import { StarBand } from "@/components/recruitment/PipelineBoard";
import { ClubLink } from "@/components/entityLinks";
import { KnowledgeMeter } from "@/components/game/RecruitmentPresentation";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import { isShortlisted } from "@/lib/career/recruitment";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { formatMoney } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
import { getPlayerContract } from "@/lib/economy/contractIntegration";
import { getClub, positionLabel } from "@/lib/game-data";
import { careerPlayerVisibility } from "@/lib/knowledge/careerVisibility";
import type { KnowledgeRatingInput, PlayerVisibleView } from "@/lib/knowledge/playerVisibility";
import { getPlayerTransferStatus } from "@/lib/transfers/transferCentre";
import { dealReadiness, type ReadinessItem, type ReadinessStatus } from "@/lib/transfers/transferDesk";
import { NegotiationPill } from "./MarketTable";

const MARK: Record<ReadinessStatus, string> = { ok: "✓", blocked: "✕", warn: "!", info: "i" };
const MARK_LABEL: Record<ReadinessStatus, string> = { ok: "Uppfyllt", blocked: "Stoppar", warn: "Varning", info: "Bra att veta" };

/** The deal readiness checklist: a visible mark and reason per item, with a fix-it link where one exists. */
export function ReadinessList({ items }: { items: ReadinessItem[] }) {
  return (
    <ul className="tx-ready">
      {items.map((item) => (
        <li key={item.key} data-status={item.status}>
          <span className="tx-ready-mark" role="img" aria-label={MARK_LABEL[item.status]}>{MARK[item.status]}</span>
          <div><b>{item.label}</b><p>{item.detail}</p>{item.fix && <Link className="tx-fix" href={item.fix.href}>{item.fix.label} →</Link>}</div>
        </li>
      ))}
    </ul>
  );
}

/** Knowledge-gated star ranges for one player -- local rating first, the club ratings endpoint for real-world players (same pattern as the player profile). */
function useVisibleView(playerId: string, clubId: string, dataSource: string | undefined, knowledge: number): PlayerVisibleView | null {
  const { career } = useCareer();
  const [row, setRow] = useState<KnowledgeRatingInput | null | undefined>(undefined);
  useEffect(() => {
    const local = getCareerPlayerRating(career, playerId, clubId);
    if (local || dataSource !== "REAL_WORLD") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sync from career state for the newly selected player.
      setRow(local ?? null);
      return;
    }
    let cancelled = false;
    fetch(`/api/game-world/gameplay-ratings/clubs/${encodeURIComponent(clubId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setRow((data?.players ?? []).find((r: KnowledgeRatingInput & { playerId: string }) => r.playerId === playerId) ?? null); })
      .catch(() => { if (!cancelled) setRow(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the selected player, matching Player Profile's fetch pattern.
  }, [playerId, clubId, dataSource]);
  return row ? careerPlayerVisibility(career, row, playerId, knowledge) : null;
}

export function DealDrawer({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { career, addToShortlist, removeFromShortlist } = useCareer();
  const player = getCareerPlayer(career, playerId);
  const ready = dealReadiness(career, playerId);
  const view = useVisibleView(playerId, player?.clubId ?? "", player?.dataSource, ready?.knowledgePct ?? 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!player || !ready) return null;

  const status = getPlayerTransferStatus(career, playerId);
  const contract = getPlayerContract(career, playerId);
  const shortlisted = isShortlisted(career, playerId);
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate);
  const negotiation = status?.managerNegotiation;
  const roomHref = `/career/transfers/${encodeURIComponent(playerId)}`;
  const blockers = ready.items.filter((i) => i.status === "blocked").length;

  return (
    <>
      <button type="button" className="tx-drawer-scrim" aria-label="Stäng affärspanelen" onClick={onClose} tabIndex={-1} />
      <aside className="tx-drawer" aria-label={`Affärspanel: ${player.firstName} ${player.lastName}`}>
        <header className="tx-drawer-head">
          <PlayerGlyph player={player} size={48} />
          <div>
            <small>{positionLabel(player.position)}{age !== null ? ` · ${age} år` : ""}</small>
            <h3>{player.firstName} {player.lastName}</h3>
            <span className="tx-muted">{player.clubId ? <ClubLink clubId={player.clubId}>{getClub(player.clubId)?.shortName ?? player.clubId}</ClubLink> : "Fri agent"}{status?.loan ? ` · på lån i ${getClub(status.loan.borrowingClubId)?.shortName ?? ""}` : ""}</span>
          </div>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose} aria-label="Stäng affärspanelen">Stäng</button>
        </header>

        <div className="tx-drawer-body">
          <section className="tx-ranges" aria-label="Scouternas bedömning">
            <div><small>Förmåga</small><StarBand range={view?.abilityRange ?? null} label="Förmåga" /></div>
            <div><small>Potential</small><StarBand range={view?.potentialRange ?? null} label="Potential" /></div>
            <div className="tx-ranges-value"><small>Värde</small><b className="tx-num">{ready.value ? (ready.value.min === ready.value.max ? formatMoney(ready.value.min) : `${formatMoney(ready.value.min)} – ${formatMoney(ready.value.max)}`) : "—"}</b></div>
            <KnowledgeMeter pct={ready.knowledgePct} />
          </section>

          {ready.own ? (
            <p className="tx-state-line">Spelaren tillhör er klubb. Hantera honom från spelarprofilen eller kontraktsöversikten.</p>
          ) : (
            <section aria-label="Kan vi buda?">
              <h4 className="tx-h4">{ready.continuing ? "Förhandlingen pågår" : blockers ? "Kan inte buda just nu" : "Klar att buda"}</h4>
              <ReadinessList items={ready.items} />
            </section>
          )}

          <dl className="tx-facts">
            <div><dt>Avtalet ägs av</dt><dd>{status?.ownerClubId ? getClub(status.ownerClubId)?.shortName ?? status.ownerClubId : "Fri agent"}</dd></div>
            <div><dt>Kontrakt</dt><dd>{status?.contractStatus ? CONTRACT_STATUS_LABEL[status.contractStatus] : "—"}{contract ? ` · t.o.m. ${contract.contractEndDate}` : ""}</dd></div>
            <div><dt>Lön</dt><dd className="tx-num">{contract ? `${formatMoney(contract.wageEurPerMonth)}/mån` : "—"}</dd></div>
            {ready.trainingCompensationEur > 0 && <div><dt>Utbildningsersättning</dt><dd className="tx-num">{formatMoney(ready.trainingCompensationEur)}</dd></div>}
            {status && status.interestedClubIds.length > 0 && <div><dt>Konkurrerande intresse</dt><dd>{status.interestedClubIds.map((id) => getClub(id)?.shortName ?? id).join(", ")}</dd></div>}
            {negotiation && <div><dt>Er förhandling</dt><dd><NegotiationPill summary={negotiation} /></dd></div>}
          </dl>
        </div>

        <footer className="tx-drawer-actions">
          {ready.own ? (
            <Link className="hm-btn hm-btn-primary tx-wide" href={`/career/squad/${encodeURIComponent(playerId)}`}>Öppna spelarprofilen →</Link>
          ) : ready.canNegotiate ? (
            <Link className="hm-btn hm-btn-primary tx-wide tx-cta" href={roomHref}>{ready.continuing ? "Fortsätt förhandlingen →" : "Förhandla →"}</Link>
          ) : (
            <div className="tx-blocked tx-wide" role="note"><button type="button" className="hm-btn tx-wide" disabled>Förhandla</button><span>{ready.blockedReason}</span></div>
          )}
          {!ready.own && (ready.canLoan
            ? <Link className="hm-btn" href={`${roomHref}?deal=LOAN`}>Föreslå lån</Link>
            : <div className="tx-blocked"><button type="button" className="hm-btn" disabled>Föreslå lån</button><span>{ready.loanReason}</span></div>)}
          {!ready.own && <button type="button" className="hm-btn" aria-pressed={shortlisted} onClick={() => (shortlisted ? removeFromShortlist(playerId) : addToShortlist(playerId))}>{shortlisted ? "Ta bort från Kortlista" : "Lägg på Kortlista"}</button>}
          <Link className="hm-btn" href={`/career/compare?right=${encodeURIComponent(playerId)}`}>Jämför</Link>
          <Link className="hm-btn" href={`/career/squad/${encodeURIComponent(playerId)}`}>Spelarprofil</Link>
        </footer>
      </aside>
    </>
  );
}
