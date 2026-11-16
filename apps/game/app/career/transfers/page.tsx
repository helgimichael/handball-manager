"use client";

// Arena Nights 231 -- the Transfer Centre as a trading desk (REC-03 A "Market Table + Deal Panel").
// Header: mode switch Köp · Sälj · Affärer and the budget waterfall, always in sight. Köp: saved views over
// one canonical market table (REC-03b A), the need court as the position filter (REC-03d B) and the Deal
// Panel / drawer for the selected player (REC-03c A). Sälj: the sell board (REC-03a A). Affärer: ongoing
// negotiations, market pulse and recent deals. Mode, view, filters and the selected player live in the URL.
// It still never negotiates itself: every deal is conducted in the Negotiation Room.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DelegationToggle } from "@/components/staff/DelegationToggle";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/manager/Workspace";
import { PlayerGlyph } from "@/components/game/Identity";
import { PlayerLink } from "@/components/entityLinks";
import { BudgetWaterfall } from "@/components/transfers/BudgetWaterfall";
import { DealDrawer } from "@/components/transfers/DealDrawer";
import { MarketTable, NegotiationPill } from "@/components/transfers/MarketTable";
import { NeedCourt } from "@/components/transfers/NeedCourt";
import { daysLeftLabel, deadlineUrgency } from "@/components/transfers/transferVisuals";
import { IncomingOffersBoard } from "@/components/players/IncomingOffersBoard";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { formatMoney, localizeMoneyText } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { getClub } from "@/lib/game-data";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "@/lib/transfers/transferWindow";
import { getManagerRecruitmentNeeds, getOpenNegotiationSummaries, getRecentResponses } from "@/lib/transfers/transferCentre";
import type { TransferOfferStatus } from "@/lib/transfers/types";
import type { InterestFilter } from "@/lib/transfers/playerInterest";
import {
  budgetWaterfall, buildMarketTable, DESK_MODES, deskSearch, describeView, MARKET_VIEWS, parseDeskQuery, sellBadgeCount,
  type DeskQuery, type MarketView,
} from "@/lib/transfers/transferDesk";
import type { CareerState } from "@/lib/career/types";

const OFFER_STATUS_LABEL: Record<TransferOfferStatus, string> = {
  BLOCKED_UNAFFORDABLE: "Ej råd",
  BLOCKED_PENDING_TRANSFER: "Pågående affär",
  REJECTED_BY_CLUB: "Nekat av klubben",
  REJECTED_BY_PLAYER: "Nekat av spelaren",
  AGREED_AWAITING_WINDOW: "Väntar på fönster",
  COMPLETED: "Genomförd",
  CANCELLED_STALE: "Avbruten",
};
const INTEREST_LABEL: Record<InterestFilter, string> = { REALISTIC: "Realistiska mål", PERSUADABLE: "Möjligen intresserade", ALL: "Alla" };
const SAVED_VIEWS_KEY = "hm-tx-saved-views";
interface SavedView { name: string; search: string }

export default function TransfersPage() { return <Suspense><TransferDesk /></Suspense>; }

/** Browser-local saved views -- a per-viewer convenience only; the desk works the same without them. */
function useSavedViews(): [SavedView[], (v: SavedView[]) => void] {
  const [views, setViews] = useState<SavedView[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from browser storage.
      if (raw) setViews((JSON.parse(raw) as SavedView[]).filter((v) => typeof v?.name === "string" && typeof v?.search === "string").slice(0, 6));
    } catch { /* storage unavailable -- no saved views */ }
  }, []);
  const store = useCallback((next: SavedView[]) => {
    setViews(next);
    try { window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { /* convenience only */ }
  }, []);
  return [views, store];
}

function TransferDesk() {
  useMoney(); // re-render every figure when the display currency changes
  const params = useSearchParams();
  const { career } = useCareer();
  const query = parseDeskQuery(params);
  const setQuery = useCallback((patch: Partial<DeskQuery>) => {
    const next = { ...parseDeskQuery(new URLSearchParams(window.location.search)), ...patch };
    // The native History API keeps useSearchParams in sync without a route transition (cheap for arrow-key row nav).
    window.history.replaceState(null, "", `/career/transfers${deskSearch(next)}`);
  }, []);

  const negotiations = getOpenNegotiationSummaries(career);
  const yourMove = negotiations.filter((n) => n.nextStep === "YOUR_MOVE").length;
  const bids = sellBadgeCount(career);
  const windowOpen = isTransferWindowOpen(career.gameDate);
  const badges: Record<DeskQuery["mode"], number> = { kop: 0, salj: bids, affarer: yourMove };

  return (
    <div className="game-transfers-page tc-page tx-desk">
      <PageHeading eyebrow="Rekrytering / bygg laget" title="Transfer Centre" description="Köp, sälj och följ dina affärer. Varje förhandling görs i förhandlingsrummet." actions={<Link className="hm-btn" href="/career/recruitment">Rekryteringscentrum</Link>} />

      <header className="tx-desk-head">
        <div className="tx-desk-modes">
          <div className="tx-modes" role="tablist" aria-label="Läge">
            {DESK_MODES.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={query.mode === m.id} onClick={() => setQuery({ mode: m.id })}>
                {m.label}{badges[m.id] > 0 && <b className="tx-badge" aria-label={`${badges[m.id]} väntar på dig`}>{badges[m.id]}</b>}
              </button>
            ))}
          </div>
          <p className="tx-window"><span className="tc-live-dot" data-open={windowOpen} aria-hidden="true" />{windowOpen ? "Transferfönstret är öppet -- överenskomna övergångar registreras direkt." : `Fönstret är stängt -- öppnar ${nextTransferWindowOpenDate(career.gameDate)}. Lån startar direkt.`}</p>
        </div>
        <BudgetWaterfall w={budgetWaterfall(career)} compact />
        <DelegationToggle area="PLAYER_RECRUITMENT" compact />
      </header>

      {query.mode === "kop" && <BuyMode career={career} query={query} setQuery={setQuery} yourMove={yourMove} />}
      {query.mode === "salj" && <IncomingOffersBoard />}
      {query.mode === "affarer" && <DealsMode career={career} />}
    </div>
  );
}

function BuyMode({ career, query, setQuery, yourMove }: { career: CareerState; query: DeskQuery; setQuery: (p: Partial<DeskQuery>) => void; yourMove: number }) {
  const { addToShortlist } = useCareer();
  const needs = getManagerRecruitmentNeeds(career);
  const table = useMemo(() => buildMarketTable(career, query), [career, query]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [savedViews, storeViews] = useSavedViews();
  const [search, setSearch] = useState(query.q);
  const selected = query.target && getCareerPlayer(career, query.target) ? query.target : null;
  const currentSearch = deskSearch({ ...query, target: null, mode: "kop" });
  const filtered = query.pos !== "ALL" || query.q.trim() !== "" || query.interest !== "ALL" || query.expiring;
  const hidden = Math.max(0, table.totalInView - table.rows.length);

  const pick = (id: string, on: boolean) => setPicked((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });
  const bulkAdd = () => { for (const id of picked) addToShortlist(id); setPicked(new Set()); };
  const clearFilters = () => { setSearch(""); setQuery({ pos: "ALL", q: "", interest: "ALL", expiring: false }); };
  const saveView = () => {
    if (savedViews.some((v) => v.search === currentSearch)) return;
    storeViews([...savedViews, { name: describeView(query), search: currentSearch }].slice(-6));
  };

  return (
    <div className="tx-buy" data-has-selection={selected ? "true" : undefined}>
      <section className="tx-market" aria-label="Marknaden">
        {yourMove > 0 && <button type="button" className="tx-alert" onClick={() => setQuery({ mode: "affarer" })}><b>{yourMove}</b> förhandling{yourMove > 1 ? "ar" : ""} väntar på ditt drag <span>Till Affärer →</span></button>}

        <div className="tx-market-head">
          <NeedCourt needs={needs} selected={query.pos} onSelect={(pos) => setQuery({ pos })} />
          <div className="tx-market-controls">
            <div className="tx-views" role="tablist" aria-label="Vy">
              {MARKET_VIEWS.map((v) => (
                <button key={v.id} type="button" role="tab" aria-selected={query.view === v.id} onClick={() => setQuery({ view: v.id })}>{v.label}<b>{table.counts[v.id]}</b></button>
              ))}
              {savedViews.map((v) => (
                <span key={v.search} className="tx-saved">
                  <button type="button" className="tx-saved-open" aria-pressed={v.search === currentSearch} onClick={() => { const saved = parseDeskQuery(new URLSearchParams(v.search)); setSearch(saved.q); setQuery({ ...saved, mode: "kop", target: query.target }); }}>{v.name}</button>
                  <button type="button" aria-label={`Ta bort sparad vy ${v.name}`} onClick={() => storeViews(savedViews.filter((x) => x.search !== v.search))}>×</button>
                </span>
              ))}
            </div>
            <label className="tx-view-select">
              <span className="tx-sr">Vy</span>
              <select className="tc-input" value={query.view} onChange={(e) => setQuery({ view: e.target.value as MarketView })}>
                {MARKET_VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label} ({table.counts[v.id]})</option>)}
              </select>
            </label>
            <div className="tx-filters">
              <input className="tc-input" type="search" aria-label="Sök spelare" placeholder="Sök namn…" value={search} onChange={(e) => { setSearch(e.target.value); setQuery({ q: e.target.value }); }} />
              <div className="tx-chipset" role="group" aria-label="Mål">
                {(["REALISTIC", "PERSUADABLE", "ALL"] as const).map((fk) => <button key={fk} type="button" className="tc-chip" aria-pressed={query.interest === fk} onClick={() => setQuery({ interest: fk })}>{INTEREST_LABEL[fk]}</button>)}
              </div>
              <button type="button" className="tc-chip" aria-pressed={query.expiring} onClick={() => setQuery({ expiring: !query.expiring })}>Endast utgående kontrakt</button>
              <button type="button" className="hm-btn hm-btn-sm" onClick={saveView} disabled={savedViews.some((v) => v.search === currentSearch)}>{savedViews.some((v) => v.search === currentSearch) ? "Vyn är sparad" : "Spara vy"}</button>
            </div>
            {query.view === "mojligheter" && <p className="tx-muted tx-view-note">Spelare på positioner ni behöver, med kontrakt som gör en affär realistisk och inom transferbudgeten.</p>}
          </div>
        </div>

        {picked.size > 0 && (
          <div className="tx-bulk" role="region" aria-label="Markerade spelare">
            <span><b>{picked.size}</b> markerade</span>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={bulkAdd}>Lägg på Kortlista</button>
            <button type="button" className="hm-btn hm-btn-sm" onClick={() => setPicked(new Set())}>Avmarkera</button>
          </div>
        )}
        {hidden > 0 && filtered && table.rows.length > 0 && <p className="tx-hidden">{hidden} spelare i vyn döljs av filtren. <button type="button" className="tx-linkbtn" onClick={clearFilters}>Rensa filter</button></p>}

        {table.rows.length === 0 ? (
          <div className="tx-empty">
            {query.view === "kortlista" && table.totalInView === 0 ? <>
              <p>Kortlistan är tom. Lägg spelare på Kortlista från marknaden eller rekryteringscentrumet.</p>
              <div className="tx-empty-actions"><button type="button" className="hm-btn" onClick={() => setQuery({ view: "marknad" })}>Visa hela marknaden</button><Link className="hm-btn" href="/career/recruitment">Rekryteringscentrum</Link></div>
            </> : query.view === "mojligheter" && table.totalInView === 0 ? <>
              <p>Inga tydliga möjligheter just nu -- truppen är täckt eller marknaden för dyr.</p>
              <div className="tx-empty-actions"><button type="button" className="hm-btn" onClick={() => setQuery({ view: "marknad" })}>Sök på hela marknaden</button></div>
            </> : <>
              <p>Inga spelare matchar filtren{hidden ? ` (${hidden} dolda)` : ""}.</p>
              <div className="tx-empty-actions"><button type="button" className="hm-btn" onClick={clearFilters}>Rensa filter</button></div>
            </>}
          </div>
        ) : (
          <MarketTable rows={table.rows} selectedId={selected} onSelect={(id) => setQuery({ target: id })} picked={picked} onPick={pick} showWhy={query.view === "mojligheter"} caption={MARKET_VIEWS.find((v) => v.id === query.view)?.label ?? "Marknaden"} />
        )}
        {table.rows.length >= 120 && <p className="tx-hidden">Visar de 120 bäst rankade. Smalna av med position eller sök.</p>}
      </section>

      <div className="tx-panel-col">
        {selected ? <DealDrawer key={selected} playerId={selected} onClose={() => setQuery({ target: null })} /> : (
          <aside className="tx-drawer tx-drawer-idle" aria-label="Affärspanel">
            <div className="tx-drawer-body">
              <h3 className="tx-h4">Välj en spelare</h3>
              <p className="tx-muted">Klicka på en rad (eller använd piltangenterna) för att se värdering, om ni kan buda och vad som stoppar en affär.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function DealsMode({ career }: { career: CareerState }) {
  const negotiations = getOpenNegotiationSummaries(career);
  const responses = getRecentResponses(career).slice(0, 6);
  const deals = Object.values(career.transferOffers).filter((o) => o.toClubId === career.playerClubId || o.fromClubId === career.playerClubId).reverse().slice(0, 8);
  return (
    <div className="tx-deals">
      <section className="tc-panel" aria-label="Pågående förhandlingar">
        <div className="tc-panel-head"><h3>Förhandlingar</h3><span>{negotiations.length} pågående · ditt drag först</span></div>
        {negotiations.length === 0 ? (
          <div className="tx-empty"><p>Inga pågående förhandlingar.</p><div className="tx-empty-actions"><Link className="hm-btn" href="/career/transfers">Hitta en spelare på marknaden</Link></div></div>
        ) : (
          <div className="tc-deal-list">
            {negotiations.map((s) => {
              const p = getCareerPlayer(career, s.negotiation.playerId);
              const clock = deadlineUrgency(career.gameDate, s.date);
              return (
                <Link key={s.negotiation.id} className="tc-deal" data-step={s.nextStep} href={`/career/transfers/${encodeURIComponent(s.negotiation.playerId)}`}>
                  {p ? <PlayerGlyph player={p} size={34} /> : <span />}
                  <div>
                    <strong>{p ? `${p.firstName} ${p.lastName}` : ""}</strong>
                    <span>{s.negotiation.dealType === "LOAN" ? "Lån" : "Övergång"} · {s.negotiation.stage === "CLUB" ? "med klubben" : "med spelaren"}{s.activeRivals.length ? ` · ${s.activeRivals.length} konkurrent${s.activeRivals.length > 1 ? "er" : ""}` : ""}</span>
                    <span>{s.nextStep === "WAITING" ? `Svar väntas ${s.date}` : s.latest?.response === "COUNTER" ? "Motbud att ta ställning till" : s.latest?.response === "ACCEPT" ? "Klubben är överens -- villkor till spelaren" : "Lägg nästa bud"}{s.nextStep === "YOUR_MOVE" && clock ? ` · ${daysLeftLabel(clock.daysLeft)}` : ""}</span>
                  </div>
                  <NegotiationPill summary={s} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="tx-deals-side">
        <section className="tc-panel" aria-label="Marknadspuls">
          <div className="tc-panel-head"><h3><span className="tc-live-dot" data-open="true" aria-hidden="true" />Marknadspuls</h3><span>svar, 14 dagar</span></div>
          {responses.length === 0 ? <div className="tc-empty">Inga svar än. Svar på era bud kommer efter några dagar och syns här och i inkorgen.</div> : responses.map(({ negotiation, round }, i) => {
            const p = getCareerPlayer(career, negotiation.playerId);
            return (
              <Link key={`${negotiation.id}:${round.date}:${i}`} className="tc-response tx-response" data-response={round.response} data-party={round.party} href={`/career/transfers/${encodeURIComponent(negotiation.playerId)}`}>
                <header><span>{round.party === "CLUB" ? "Klubben" : round.party === "PLAYER" ? "Spelaren" : "Marknaden"} · {p ? `${p.firstName} ${p.lastName}` : ""}</span><span>{round.date}</span></header>
                <p>{localizeMoneyText(round.reason)}</p>
              </Link>
            );
          })}
        </section>

        <section className="tc-panel" aria-label="Senaste affärer">
          <div className="tc-panel-head"><h3>Senaste affärer</h3><span>{deals.length ? "in och ut" : ""}</span></div>
          {deals.length === 0 ? <div className="tc-empty">Inga affärer registrerade i karriären ännu.</div> : deals.map((offer) => (
            <div key={offer.id} className="tc-response">
              <header><span>{offer.toClubId === career.playerClubId ? "In" : "Ut"} · {offer.dealType === "LOAN" ? "Lån" : "Övergång"}</span><span>{offer.resolvedDate ?? offer.offeredDate}</span></header>
              <p><PlayerLink playerId={offer.playerId}>{getCareerPlayer(career, offer.playerId)?.lastName ?? offer.playerId}</PlayerLink> · {offer.fromClubId ? getClub(offer.fromClubId)?.shortName ?? offer.fromClubId : "Fri agent"} → {getClub(offer.toClubId)?.shortName ?? offer.toClubId} · <span className="tx-num">{formatMoney(offer.transferFeeEur)}</span> · {OFFER_STATUS_LABEL[offer.status]}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
