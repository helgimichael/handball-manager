"use client";

// HM-ALPHA2-05E: the Transfer Centre -- market overview and opportunities,
// player search and shortlist, active negotiations and incoming answers,
// finances and squad needs. It never negotiates itself: every deal is
// conducted in the Negotiation Room (/career/transfers/[playerId]), the
// single negotiation workflow the Recruitment Centre and player profiles
// link to as well.
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClubLink, PlayerLink } from "@/components/entityLinks";
import { PageHeading } from "@/components/manager/Workspace";
import { CourtBackdrop } from "@/components/transfers/CourtBackdrop";
import { daysLeftLabel, deadlineUrgency } from "@/components/transfers/transferVisuals";
import { PlayerCell, PlayerGlyph, PlayerHero } from "@/components/game/Identity";
import { KnowledgeMeter } from "@/components/game/RecruitmentPresentation";
import { KnowledgeGatedAbilityPanel } from "@/components/KnowledgeGatedProfilePanels";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad, getCareerPlayer, getExternalCandidateClubs } from "@/lib/career/careerWorld";
import { getFreeAgents } from "@/lib/career/contractExpiry";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "@/lib/transfers/transferWindow";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { formatEur } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/economy/labels";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { getClub, positionLabel, type Club, type HandballPosition, type PlayerMock } from "@/lib/game-data";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolvePlayerVisibility, type KnowledgeRatingInput } from "@/lib/knowledge/playerVisibility";
import { resolveMarketValueRange } from "@/lib/knowledge/scoutReportVisibility";
import { isShortlisted } from "@/lib/career/recruitment";
import {
  getManagerRecruitmentNeeds,
  getOpenNegotiationSummaries,
  getPlayerTransferStatus,
  getRecentResponses,
  getTransferFinance,
  getTransferOpportunities,
  summarizeNegotiation,
  type NegotiationSummary,
} from "@/lib/transfers/transferCentre";
import { getLatestNegotiation } from "@/lib/transfers/negotiationIntegration";
import type { TransferOfferStatus } from "@/lib/transfers/types";
import type { CareerState } from "@/lib/career/types";

type Tab = "OPPORTUNITIES" | "MARKET" | "SHORTLIST";
const POSITIONS: readonly (HandballPosition | "ALL")[] = ["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6"];
const NEED_LABEL = { HIGH: "Akut", MEDIUM: "Behov", LOW: "Täckt", NONE: "Full" } as const;
const OFFER_STATUS_LABEL: Record<TransferOfferStatus, string> = {
  BLOCKED_UNAFFORDABLE: "Ej råd",
  BLOCKED_PENDING_TRANSFER: "Pågående affär",
  REJECTED_BY_CLUB: "Nekat av klubben",
  REJECTED_BY_PLAYER: "Nekat av spelaren",
  AGREED_AWAITING_WINDOW: "Väntar på fönster",
  COMPLETED: "Genomförd",
  CANCELLED_STALE: "Avbruten",
};

export default function TransfersPage() { return <Suspense><TransferCentre /></Suspense>; }

function valueRangeLabel(career: CareerState, player: PlayerMock): string {
  const value = getPlayerMarketValueEur(career, player.id);
  if (value === undefined) return "—";
  const range = resolveMarketValueRange(value, getPlayerKnowledgePct(career, player.id, player.clubId));
  return range.min === range.max ? formatEur(range.min) : `${formatEur(range.min)} – ${formatEur(range.max)}`;
}

function NegotiationPill({ summary }: { summary?: NegotiationSummary }) {
  if (!summary) return null;
  const tone = summary.nextStep === "YOUR_MOVE" ? "move" : summary.nextStep === "WAITING" ? "wait" : summary.nextStep === "COMPLETED" ? "done" : "closed";
  const label = summary.nextStep === "YOUR_MOVE" ? "Ditt drag" : summary.nextStep === "WAITING" ? "Väntar svar" : summary.nextStep === "COMPLETED" ? "Klar" : "Avslutad";
  return <span className="tc-pill" data-tone={tone}>{label}</span>;
}

function TransferCentre() {
  const params = useSearchParams();
  const { career, addToShortlist, removeFromShortlist } = useCareer();
  const [tab, setTab] = useState<Tab>("OPPORTUNITIES");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<HandballPosition | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("target"));

  const finance = getTransferFinance(career);
  const needs = getManagerRecruitmentNeeds(career);
  const negotiations = getOpenNegotiationSummaries(career);
  const responses = getRecentResponses(career).slice(0, 5);
  const opportunities = useMemo(() => getTransferOpportunities(career), [career]);
  const urgent = negotiations.filter((n) => n.nextStep === "YOUR_MOVE");
  const yourMove = urgent.length;
  const urgentNeeds = needs.filter((n) => n.level === "HIGH").map((n) => n.position);
  const windowOpen = isTransferWindowOpen(career.gameDate);

  const market = useMemo(() => {
    const rows: { player: PlayerMock; club: Club | null }[] = [
      ...getExternalCandidateClubs(career).flatMap((club) => getCareerClubSquad(career, club.id).map((player) => ({ player, club: club as Club | null }))),
      ...getFreeAgents(career).map((player) => ({ player, club: null as Club | null })),
    ];
    const q = query.trim().toLowerCase();
    return rows.filter(({ player }) => (position === "ALL" || player.position === position) && (!q || `${player.firstName} ${player.lastName}`.toLowerCase().includes(q)));
  }, [career, query, position]);

  const shortlist = useMemo(
    () => Object.values(career.recruitmentTargets ?? {}).filter((t) => t.shortlisted).map((t) => getCareerPlayer(career, t.playerId)).filter((p): p is PlayerMock => !!p && p.clubId !== career.playerClubId),
    [career],
  );

  const rows: PlayerMock[] = tab === "OPPORTUNITIES" ? opportunities.map((o) => o.player) : tab === "SHORTLIST" ? shortlist : market.map((r) => r.player);
  const whyById = new Map(opportunities.map((o) => [o.player.id, o.why]));
  const selected = selectedId ? getCareerPlayer(career, selectedId) ?? null : null;

  return (
    <div className="game-transfers-page tc-page">
      <PageHeading eyebrow="Rekrytering / bygg laget" title="Transfer Centre" description="Marknaden, era förhandlingar och ekonomin på ett ställe. Varje affär görs i förhandlingsrummet." actions={<><Link className="hm-btn" href="/career/recruitment">Rekryteringscentrum</Link><Link className="hm-btn" href="/career/players">Spelarsök →</Link></>} />

      <section className="tc-stage" aria-label="Transferläge och ekonomi">
        <CourtBackdrop />
        <div className="tc-stage-lead">
          <div className="tc-eyebrow"><span className="tc-live-dot" data-open={windowOpen} aria-hidden="true" />{windowOpen ? "Transferfönstret är öppet" : `Fönstret stängt -- öppnar ${nextTransferWindowOpenDate(career.gameDate)}`}</div>
          <h2>{yourMove > 0 ? `${yourMove} förhandling${yourMove > 1 ? "ar" : ""} väntar på ditt drag` : negotiations.length > 0 ? `${negotiations.length} pågående förhandling${negotiations.length > 1 ? "ar" : ""}` : urgentNeeds.length > 0 ? `Akut behov: ${urgentNeeds.join(", ")}` : "Hitta nästa förstärkning"}</h2>
          <p>{windowOpen ? "Överenskomna övergångar registreras direkt." : "Överenskommelser registreras när fönstret öppnar. Lån startar direkt."} {opportunities.length > 0 ? `${opportunities.length} realistiska möjligheter på positioner ni behöver.` : ""}</p>
        </div>
        <div className="tc-stat"><small>Kassa</small><strong>{finance ? formatEur(finance.cashEur) : "—"}</strong></div>
        <div className="tc-stat">
          <small>Transferbudget</small><strong>{finance ? formatEur(finance.transferBudgetEur) : "—"}</strong>
          {finance && finance.committedEur > 0 && <span className="tc-stat-meter" aria-label={`${formatEur(finance.committedEur)} bundet i affärer`}><i style={{ width: `${Math.min(100, Math.round(finance.committedEur / Math.max(1, finance.transferBudgetEur + finance.committedEur) * 100))}%` }} /></span>}
        </div>
        <div className="tc-stat" data-tone={finance && finance.wageRoomEurPerMonth < 0 ? "warning" : undefined}><small>Löneutrymme / mån</small><strong>{finance ? formatEur(Math.round(finance.wageRoomEurPerMonth)) : "—"}</strong></div>
        <div className="tc-stat"><small>Bundet i affärer</small><strong>{finance ? formatEur(finance.committedEur) : "—"}</strong></div>
      </section>

      {urgent.length > 0 && (
        <section className="tc-urgent" aria-label="Kräver beslut">
          <div className="tc-urgent-head"><span className="tc-eyebrow">Kräver beslut</span><span>{urgent.length} förhandling{urgent.length > 1 ? "ar" : ""} väntar på er</span></div>
          <div className="tc-urgent-list">
            {urgent.map((s) => {
              const p = getCareerPlayer(career, s.negotiation.playerId);
              const clock = deadlineUrgency(career.gameDate, s.date);
              return (
                <Link key={s.negotiation.id} className="tc-urgent-card" data-urgency={clock?.urgency} href={`/career/transfers/${encodeURIComponent(s.negotiation.playerId)}`}>
                  {p ? <PlayerGlyph player={p} size={40} /> : <span />}
                  <div>
                    <strong>{p ? `${p.firstName} ${p.lastName}` : ""}</strong>
                    <span>{s.latest?.response === "COUNTER" ? "Motbud att ta ställning till" : s.latest?.response === "ACCEPT" ? "Klubben är överens -- villkor till spelaren" : "Lägg nästa bud"}</span>
                  </div>
                  <b>{clock ? daysLeftLabel(clock.daysLeft) : "Ditt drag"}</b>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="tc-hub">
        <section className="tc-panel" aria-label="Marknaden">
          <div className="tc-tabs" role="tablist" aria-label="Marknadsvy">
            <button type="button" role="tab" aria-selected={tab === "OPPORTUNITIES"} onClick={() => setTab("OPPORTUNITIES")}>Möjligheter<b>{opportunities.length}</b></button>
            <button type="button" role="tab" aria-selected={tab === "MARKET"} onClick={() => setTab("MARKET")}>Hela marknaden<b>{market.length}</b></button>
            <button type="button" role="tab" aria-selected={tab === "SHORTLIST"} onClick={() => setTab("SHORTLIST")}>Bevakade<b>{shortlist.length}</b></button>
          </div>
          {tab === "MARKET" && (
            <div className="tc-filters">
              <input className="tc-input" aria-label="Sök spelare" placeholder="Sök namn…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {POSITIONS.map((p) => <button key={p} type="button" className="tc-chip" aria-pressed={position === p} onClick={() => setPosition(p)}>{p === "ALL" ? "Alla" : p}</button>)}
            </div>
          )}
          {tab === "OPPORTUNITIES" && <div className="tc-filters"><span className="tc-why">Spelare på positioner ni behöver, med kontrakt som gör en affär realistisk och inom transferbudgeten.</span></div>}
          {tab === "OPPORTUNITIES" && opportunities.length > 0 && (
            <div className="tc-featured" aria-label="Utvalda möjligheter">
              {opportunities.slice(0, 3).map((o) => (
                <button key={o.player.id} type="button" className="tc-feature" data-selected={selectedId === o.player.id} data-need={o.needLevel} onClick={() => setSelectedId(o.player.id)}>
                  <span className="tc-feature-top"><PlayerGlyph player={o.player} size={38} /><span className="tc-feature-pos">{o.player.position}</span></span>
                  <strong>{o.player.firstName} {o.player.lastName}</strong>
                  <span className="tc-feature-club">{o.clubId ? getClub(o.clubId)?.shortName ?? o.clubId : "Fri agent"} · {playerAgeAtDate(o.player.dateOfBirth, o.player.birthYear, career.gameDate) ?? "–"} år</span>
                  <span className="tc-feature-why">{o.why}</span>
                  <span className="tc-feature-value">{valueRangeLabel(career, o.player)}</span>
                </button>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <div className="tc-empty">{tab === "SHORTLIST" ? "Inga bevakade spelare än. Bevaka en spelare från dossiern eller rekryteringscentrumet." : tab === "OPPORTUNITIES" ? "Inga tydliga möjligheter just nu -- truppen är täckt eller marknaden för dyr. Sök på hela marknaden." : "Inga spelare matchar filtret."}</div>
          ) : (
            <div className="tc-table hm-scroll-x">
              <table className="hm-table">
                <thead><tr><th>Spelare</th><th>Pos</th><th>Ålder</th><th>Klubb</th><th>Kontrakt</th><th className="hm-table-num">Marknadsvärde</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.slice(0, 80).map((player) => {
                    const status = getPlayerContractStatus(career, player.id);
                    const latest = getLatestNegotiation(career, player.id, career.playerClubId);
                    return (
                      <tr key={player.id} data-clickable="true" data-selected={selectedId === player.id} onClick={() => setSelectedId(player.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(player.id); } }} aria-selected={selectedId === player.id}>
                        <td className="hm-td-strong"><PlayerCell player={player} />{tab === "OPPORTUNITIES" && <div className="tc-why">{whyById.get(player.id)}</div>}</td>
                        <td title={positionLabel(player.position)}>{player.position}</td>
                        <td>{playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate) ?? "–"}</td>
                        <td className="hm-text-muted">{player.clubId && getClub(player.clubId) ? <ClubLink clubId={player.clubId} stopPropagation>{getClub(player.clubId)!.shortName}</ClubLink> : "Fri agent"}</td>
                        <td>{status ? <span className={`hm-badge hm-badge-${CONTRACT_STATUS_TONE[status]}`}>{CONTRACT_STATUS_LABEL[status]}</span> : "—"}</td>
                        <td className="hm-table-num">{valueRangeLabel(career, player)}</td>
                        <td>{latest ? <NegotiationPill summary={summarizeNegotiation(latest)} /> : isShortlisted(career, player.id) ? <span className="tc-pill">Bevakad</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="tc-rail">
          {selected && <Dossier career={career} player={selected} onShortlist={(on) => (on ? addToShortlist(selected.id) : removeFromShortlist(selected.id))} onClose={() => setSelectedId(null)} />}

          <section className="tc-panel" aria-label="Pågående förhandlingar">
            <div className="tc-panel-head"><h3>Förhandlingar</h3><span>{negotiations.length} pågående</span></div>
            {negotiations.length === 0 ? <div className="tc-empty">Inga pågående förhandlingar. Välj en spelare och öppna förhandlingsrummet.</div> : (
              <div className="tc-deal-list">
                {negotiations.map((s) => {
                  const p = getCareerPlayer(career, s.negotiation.playerId);
                  return (
                    <Link key={s.negotiation.id} className="tc-deal" data-step={s.nextStep} href={`/career/transfers/${encodeURIComponent(s.negotiation.playerId)}`}>
                      {/* The glyph only -- PlayerCell carries its own profile link, and links must not nest. */}
                      {p ? <PlayerGlyph player={p} size={34} /> : <span />}
                      <div>
                        <strong>{p ? `${p.firstName} ${p.lastName}` : ""}</strong>
                        <span>{s.negotiation.dealType === "LOAN" ? "Lån" : "Övergång"} · {s.negotiation.stage === "CLUB" ? "med klubben" : "med spelaren"}</span>
                        <span>{s.nextStep === "WAITING" ? `Svar väntas ${s.date}` : s.date ? `Ditt bud senast ${s.date}` : "Ditt drag"}{s.activeRivals.length ? ` · ${s.activeRivals.length} konkurrent${s.activeRivals.length > 1 ? "er" : ""}` : ""}</span>
                      </div>
                      <NegotiationPill summary={s} />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="tc-panel" aria-label="Truppbehov">
            <div className="tc-panel-head"><h3>Truppbehov</h3><span>spelare per position</span></div>
            <div className="tc-panel-body">
              <div className="tc-needs">{needs.map((n) => <div key={n.position} className="tc-need" data-level={n.level} title={n.reason}><small>{n.position}</small><strong>{n.projectedDepth}</strong><span className="tc-need-bar" aria-hidden="true"><i style={{ height: `${Math.min(100, n.projectedDepth * 25)}%` }} /></span><small>{NEED_LABEL[n.level]}</small></div>)}</div>
              <p className="tc-note" style={{ marginTop: 10 }}>{urgentNeeds.length ? `Akut: ${urgentNeeds.join(", ")}. ` : "Inga akuta luckor. "}Siffran är spelare på positionen inklusive överenskomna ankomster.</p>
            </div>
          </section>

          <section className="tc-panel" aria-label="Inkommande svar">
            <div className="tc-panel-head"><h3><span className="tc-live-dot" data-open="true" aria-hidden="true" />Marknadspuls</h3><span>svar och rörelser, 14 dagar</span></div>
            {responses.length === 0 ? <div className="tc-empty">Inga svar än. Svar på era bud kommer efter några dagar och syns här och i inkorgen.</div> : responses.map(({ negotiation, round }, i) => {
              const p = getCareerPlayer(career, negotiation.playerId);
              return (
                <Link key={`${negotiation.id}:${round.date}:${i}`} className="tc-response" data-response={round.response} data-party={round.party} href={`/career/transfers/${encodeURIComponent(negotiation.playerId)}`} style={{ color: "inherit", textDecoration: "none" }}>
                  <header><span>{round.party === "CLUB" ? "Klubben" : round.party === "PLAYER" ? "Spelaren" : "Marknaden"} · {p ? `${p.firstName} ${p.lastName}` : ""}</span><span>{round.date}</span></header>
                  <p>{round.reason}</p>
                </Link>
              );
            })}
          </section>

          <RecentDeals career={career} />
        </div>
      </div>
    </div>
  );
}

function Dossier({ career, player, onShortlist, onClose }: { career: CareerState; player: PlayerMock; onShortlist: (on: boolean) => void; onClose: () => void }) {
  const status = getPlayerTransferStatus(career, player.id);
  const contract = getPlayerContract(career, player.id);
  const knowledge = getPlayerKnowledgePct(career, player.id, player.clubId);
  const shortlisted = isShortlisted(career, player.id);
  const freeAgent = status?.contractStatus === "FREE_AGENT";
  const own = status?.isOwnPlayer ?? false;
  const canLoan = !freeAgent && !status?.loan && !own;

  // Knowledge-gated ability (HM-SCOUTING-1.0 Part 9) -- fetched for the selected player only, same as Player Profile.
  const [ratingRow, setRatingRow] = useState<KnowledgeRatingInput | null | undefined>(undefined);
  useEffect(() => {
    const local = getCareerPlayerRating(career, player.id, player.clubId);
    if (local || player.dataSource !== "REAL_WORLD") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sync from career state for the newly selected player.
      setRatingRow(local ?? null);
      return;
    }
    let cancelled = false;
    fetch(`/api/game-world/gameplay-ratings/clubs/${encodeURIComponent(player.clubId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setRatingRow((data?.players ?? []).find((r: KnowledgeRatingInput & { playerId: string }) => r.playerId === player.id) ?? null); })
      .catch(() => { if (!cancelled) setRatingRow(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the selected player, matching Player Profile's fetch pattern.
  }, [player.id, player.clubId, player.dataSource]);
  const view = ratingRow ? resolvePlayerVisibility(ratingRow, knowledge) : null;

  return (
    <aside className="game-target-dossier" aria-label="Vald spelare">
      <div className="game-dossier-heading"><span className="hm-eyebrow">Spelardossier</span><button type="button" className="hm-btn hm-btn-sm" onClick={onClose} aria-label="Stäng dossiern">Stäng</button></div>
      <PlayerHero player={player} career={career} />
      <div className="game-dossier-body" style={{ display: "grid", gap: 12 }}>
        <KnowledgeMeter pct={knowledge} />
        {view && <KnowledgeGatedAbilityPanel view={view} />}
        <dl className="tc-facts">
          <div><dt>Avtalet ägs av</dt><dd>{status?.ownerClubId ? <ClubLink clubId={status.ownerClubId}>{getClub(status.ownerClubId)?.shortName ?? status.ownerClubId}</ClubLink> : "Fri agent"}</dd></div>
          {status?.loan && <div><dt>Spelar för</dt><dd>{getClub(status.loan.borrowingClubId)?.shortName} (lån till {status.loan.endDate})</dd></div>}
          <div><dt>Kontrakt</dt><dd>{status?.contractStatus ? CONTRACT_STATUS_LABEL[status.contractStatus] : "—"}{contract ? ` · t.o.m. ${contract.contractEndDate}` : ""}</dd></div>
          <div><dt>Lön</dt><dd>{contract ? `${formatEur(contract.wageEurPerMonth)}/mån` : "—"}</dd></div>
          <div><dt>Marknadsvärde</dt><dd>{valueRangeLabel(career, player)}</dd></div>
          {status && status.interestedClubIds.length > 0 && <div><dt>Konkurrerande intresse</dt><dd>{status.interestedClubIds.map((id) => getClub(id)?.shortName ?? id).join(", ")}</dd></div>}
          {status?.managerNegotiation && <div><dt>Er förhandling</dt><dd><NegotiationPill summary={status.managerNegotiation} /></dd></div>}
        </dl>
        {own ? (
          <div className="tc-actions"><Link className="hm-btn tc-wide" href={`/career/squad/${encodeURIComponent(player.id)}`}>Spelaren tillhör er -- öppna profilen →</Link></div>
        ) : (
          <div className="tc-actions">
            <Link className="hm-btn hm-btn-primary tc-wide" href={`/career/transfers/${encodeURIComponent(player.id)}`}>{status?.managerNegotiation && status.managerNegotiation.nextStep !== "CLOSED" && status.managerNegotiation.nextStep !== "COMPLETED" ? "Fortsätt förhandlingen →" : "Förhandla om övergång →"}</Link>
            {canLoan ? <Link className="hm-btn" href={`/career/transfers/${encodeURIComponent(player.id)}?deal=LOAN`}>Föreslå lån</Link> : <span className="hm-btn" aria-disabled="true" title={freeAgent ? "En kontraktslös spelare värvas, inte lånas." : "Spelaren är redan utlånad."}>Lån ej möjligt</span>}
            <button type="button" className="hm-btn" onClick={() => onShortlist(!shortlisted)} aria-pressed={shortlisted}>{shortlisted ? "Sluta bevaka" : "Bevaka"}</button>
            <Link className="hm-btn" href={`/career/compare?right=${encodeURIComponent(player.id)}`}>Jämför med truppen</Link>
            <Link className="hm-btn" href={`/career/squad/${encodeURIComponent(player.id)}`}>Spelarprofil</Link>
          </div>
        )}
      </div>
    </aside>
  );
}

function RecentDeals({ career }: { career: CareerState }) {
  const deals = Object.values(career.transferOffers).filter((o) => o.toClubId === career.playerClubId || o.fromClubId === career.playerClubId).reverse().slice(0, 6);
  return (
    <section className="tc-panel" aria-label="Senaste affärer">
      <div className="tc-panel-head"><h3>Senaste affärer</h3><span>{deals.length ? "in och ut" : ""}</span></div>
      {deals.length === 0 ? <div className="tc-empty">Inga affärer registrerade i karriären.</div> : deals.map((offer) => (
        <div key={offer.id} className="tc-response">
          <header><span>{offer.toClubId === career.playerClubId ? "In" : "Ut"} · {offer.dealType === "LOAN" ? "Lån" : "Övergång"}</span><span>{offer.resolvedDate ?? offer.offeredDate}</span></header>
          <p><PlayerLink playerId={offer.playerId}>{getCareerPlayer(career, offer.playerId)?.lastName ?? offer.playerId}</PlayerLink> · {offer.fromClubId ? getClub(offer.fromClubId)?.shortName ?? offer.fromClubId : "Fri agent"} → {getClub(offer.toClubId)?.shortName ?? offer.toClubId} · {formatEur(offer.transferFeeEur)} · {OFFER_STATUS_LABEL[offer.status]}</p>
        </div>
      ))}
    </section>
  );
}
