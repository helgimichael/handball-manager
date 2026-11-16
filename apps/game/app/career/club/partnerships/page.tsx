"use client";
// Arena Nights CLB-03 C "Partner Dossiers + Guided Deal": each partner is a dossier card (crest, league, months
// left, cost per month, players placed); a "Ny partner" card opens the three-step drawer (CLB-03a A: Sök -> Välj
// kandidat -> Villkor with the total cost -> Ingå avtal); Förläng / Avsluta show their consequence and ask for
// confirmation; placements are a list with Placera / Kalla tillbaka and the international loan form sits in a
// drawer (CLB-03b A); the history folds away.
// HM-CLUB-PARTNERSHIPS-1.0/1.1 rules unchanged: every action is the existing CareerContext action
// (requestPartnershipSearch, startDevelopmentPartnership, renewPartnership, terminatePartnership, startPlacement,
// recallPlayerFromPlacement, startInternationalPartnershipLoan) with its own validation and error messages.
import { useState } from "react";
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import MoneyInput from "@/components/MoneyInput";
import { PlayerCell } from "@/components/game/Identity";
import { SideDrawer } from "@/components/players/SideDrawer";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { useMoney } from "@/lib/settings/usePreferences";
import { canRequestPartnershipSearch, isPartnershipExposureEligible, type ClubPartnership, type PartnershipStatus, type PartnershipType } from "@/lib/career/clubPartnerships";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { clubCompetitionId } from "@/lib/career/competitionMembership";
import { getActivePlacementsAtClub, type PlayerPlacement } from "@/lib/career/playerPlacements";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";

const TYPE_LABEL_SV: Record<PartnershipType, string> = { AFFILIATED_B_TEAM: "Permanent B-lag", DEVELOPMENT_PARTNERSHIP: "Samarbetsklubb", INTERNATIONAL_LOAN_PARTNERSHIP: "Internationellt låneavtal" };
const STATUS_LABEL_SV: Record<PartnershipStatus, string> = { ACTIVE: "Aktivt", EXPIRED: "Utgånget", TERMINATED: "Avslutat" };
const clubName = (id: string) => getClub(id)?.name ?? id;
const leagueOf = (career: ReturnType<typeof useCareer>["career"], id: string) => { const c = clubCompetitionId(career, id); return c ? COMPETITIONS.find((x) => x.id === c)?.name ?? null : null; };
function monthsLeft(from: string, to: string | null): number | null {
  if (!to) return null;
  const [fy, fm, fd] = from.split("-").map(Number); const [ty, tm, td] = to.split("-").map(Number);
  return Math.max(0, (ty! - fy!) * 12 + (tm! - fm!) - (td! < fd! ? 1 : 0));
}

export default function ClubPartnershipsPage() {
  const money = useMoney();
  const { career, requestPartnershipSearch, startDevelopmentPartnership, terminatePartnership, renewPartnership, startPlacement, recallPlayerFromPlacement } = useCareer();
  const [drawer, setDrawer] = useState<null | "deal" | { loan: string }>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; renewedFrom?: string | null } | null>(null);

  const clubId = career.playerClubId;
  const partnerships = Object.values(career.clubPartnerships).filter((p) => p.clubAId === clubId || p.clubBId === clubId);
  const permanentBTeam = partnerships.filter((p) => p.type === "AFFILIATED_B_TEAM");
  const others = partnerships.filter((p) => p.type !== "AFFILIATED_B_TEAM").sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const activeDevelopment = others.find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");
  const loans = others.filter((p) => p.type === "INTERNATIONAL_LOAN_PARTNERSHIP" && p.status === "ACTIVE" && p.clubAId === clubId);
  const active = [...permanentBTeam, ...(activeDevelopment ? [activeDevelopment] : []), ...loans];
  const search = Object.values(career.partnershipSearches).filter((s) => s.clubId === clubId).sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
  const pending = search?.status === "IN_PROGRESS" ? search : null;
  const ready = search?.status === "COMPLETED" && !activeDevelopment ? search : null;

  const renew = (p: ClubPartnership) => {
    const before = p.endDate;
    renewPartnership(p.id, 6);
    // renewPartnership leaves rows it may not extend untouched (e.g. a real-world cooperation team) -- the note says which.
    setNote({ id: p.id, renewedFrom: before });
    setConfirm(null);
  };
  const end = (p: ClubPartnership) => { terminatePartnership(p.id); setConfirm(null); setNote(null); };

  return (
    <div className="pt-page">
      <header className="pt-head">
        <Link href="/career/club" className="pt-back">← Klubben</Link>
        <h1>Klubbpartnerskap</h1>
        <p>B-lag, samarbetsklubbar och internationella låneavtal: speltid och utveckling för spelare som inte får minuter i A-laget.</p>
      </header>

      <section aria-labelledby="pt-partners-h">
        <h2 id="pt-partners-h" className="pt-h">Partners</h2>
        <ul className="pt-cards">
          {active.map((p) => {
            const placed = getActivePlacementsAtClub(career, p.clubBId);
            const left = monthsLeft(career.gameDate, p.endDate);
            const asking = confirm?.endsWith(p.id) ? confirm.slice(0, confirm.indexOf(":")) : null;
            return (
              <li key={p.id} className="pt-card" data-type={p.type}>
                <header>
                  <ClubCrest shortName={getClub(p.clubBId)?.shortName ?? ""} primaryColor={getClub(p.clubBId)?.primaryColor ?? ""} clubId={p.clubBId} size={48} />
                  <div><small>{TYPE_LABEL_SV[p.type]}</small><strong><Link href={`/career/clubs/${encodeURIComponent(p.clubBId)}`}>{clubName(p.clubBId)}</Link></strong><span>{leagueOf(career, p.clubBId) ?? "Okänd serie"}</span></div>
                </header>
                <dl>
                  <div><dt>Löptid</dt><dd>{p.permanent ? "Permanent" : left === null ? "Tillsvidare" : `${left} mån kvar`}</dd></div>
                  <div><dt>Kostnad</dt><dd>{p.monthlyCostEur > 0 ? `${money.format(p.monthlyCostEur)}/mån` : "Ingen"}</dd></div>
                  <div><dt>Placerade</dt><dd>{placed.length ? `${placed.length} · ${placed.reduce((n, x) => n + x.exposureAccrued, 0)} dagar` : "Inga"}</dd></div>
                </dl>
                {p.type === "DEVELOPMENT_PARTNERSHIP" && (
                  asking ? (
                    <div className="pt-confirm" role="group" aria-label="Bekräfta">
                      <p>{asking === "renew" ? `Förläng 6 månader${p.endDate ? ` från ${p.endDate}` : ""}${p.monthlyCostEur > 0 ? `: ${money.format(p.monthlyCostEur * 6)} till totalt` : ""}.` : `Avsluta samarbetet i dag. Kostnaden upphör och det går inte att ångra${placed.length ? ` (${placed.length} spelare är placerade där)` : ""}.`}</p>
                      <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => (asking === "renew" ? renew(p) : end(p))}>{asking === "renew" ? "Bekräfta förlängning" : "Bekräfta avslut"}</button>
                      <button type="button" className="hm-btn hm-btn-sm" onClick={() => setConfirm(null)}>Avbryt</button>
                    </div>
                  ) : (
                    <div className="pt-card-actions">
                      <button type="button" className="hm-btn hm-btn-sm" onClick={() => setConfirm(`renew:${p.id}`)}>Förläng 6 mån</button>
                      <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setConfirm(`end:${p.id}`)}>Avsluta</button>
                    </div>
                  )
                )}
                {p.type === "AFFILIATED_B_TEAM" && <p className="pt-note">Permanent relation. Kan inte sägas upp.</p>}
                {p.type === "INTERNATIONAL_LOAN_PARTNERSHIP" && <button type="button" className="hm-btn hm-btn-sm" onClick={() => setDrawer({ loan: p.id })}>Låna ut en spelare</button>}
                {note?.id === p.id && note.renewedFrom !== undefined && <p className="pt-note" role="status">{p.endDate !== note.renewedFrom ? `Förlängt t.o.m. ${p.endDate}.` : "Samarbetet kunde inte förlängas: ett verkligt samarbetslag löper till sitt slutdatum."}</p>}
              </li>
            );
          })}
          {!activeDevelopment && (
            <li className="pt-card pt-card-new">
              <strong>Ny samarbetsklubb</strong>
              <p>{pending ? `Styrelsen söker. Förslagen kommer ${pending.endDate}.` : ready ? `Styrelsen har ${ready.candidateClubIds.length} förslag klara.` : "Styrelsen letar upp Division 1-klubbar som kan ge unga spelare matcher. Sökningen tar flera veckor."}</p>
              <button type="button" className="hm-btn hm-btn-primary" onClick={() => setDrawer("deal")}>{ready ? "Välj samarbetsklubb" : pending ? "Se sökningen" : "Hitta samarbetsklubb"}</button>
            </li>
          )}
        </ul>
        {active.length === 0 && <p className="pt-note">Inget aktivt samarbete ännu. Börja med att låta styrelsen söka en samarbetsklubb.</p>}
      </section>

      {[...permanentBTeam, ...(activeDevelopment ? [activeDevelopment] : [])].map((relation) => (
        <Placements key={relation.id} partnerClubId={relation.clubBId} startPlacement={startPlacement} recall={recallPlayerFromPlacement} />
      ))}

      <details className="pt-history">
        <summary>Historik ({others.length})</summary>
        {others.length === 0 ? <p className="pt-note">Inga tidigare samarbeten.</p> : (
          <ul>{others.map((p) => <li key={p.id} data-status={p.status}><b>{clubName(p.clubBId)}</b><span>{TYPE_LABEL_SV[p.type]}</span><span>{p.startDate} – {p.endDate ?? "tillsvidare"}</span><span>{p.monthlyCostEur > 0 ? `${money.format(p.monthlyCostEur)}/mån` : "—"}</span><em>{STATUS_LABEL_SV[p.status]}</em></li>)}</ul>
        )}
      </details>

      {drawer === "deal" && <DealDrawer onClose={() => setDrawer(null)} pending={pending} ready={ready} blockers={canRequestPartnershipSearch(career, clubId)} request={requestPartnershipSearch} start={startDevelopmentPartnership} />}
      {drawer && typeof drawer === "object" && (() => { const p = loans.find((x) => x.id === drawer.loan); return p ? <LoanDrawer partnership={p} onClose={() => setDrawer(null)} /> : null; })()}
    </div>
  );
}

/** CLB-03a A: Sök -> Välj kandidat -> Villkor -> Ingå avtal. The search itself takes weeks; the drawer shows where it stands. */
function DealDrawer({ onClose, pending, ready, blockers, request, start }: {
  onClose: () => void;
  pending: { endDate: string } | null;
  ready: { id: string; candidateClubIds: string[] } | null;
  blockers: string[];
  request: () => { ok: boolean; errors: string[] };
  start: (searchId: string, clubId: string, monthlyCostEur: number, months: number) => { ok: boolean; errors: string[] };
}) {
  const money = useMoney();
  const { career } = useCareer();
  const [chosen, setChosen] = useState<string | null>(null);
  const [cost, setCost] = useState(1000);
  const [months, setMonths] = useState(12);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const step = ready ? (chosen ? 3 : 2) : 1;
  const steps = ["Sök", "Välj kandidat", "Villkor"];
  const sign = () => { if (!ready || !chosen) return; const r = start(ready.id, chosen, cost, months); if (!r.ok) { setError(r.errors.join(" ")); setSure(false); return; } setDone(`Avtalet med ${clubName(chosen)} gäller i ${months} månader.`); };
  return (
    <SideDrawer title="Ny samarbetsklubb" onClose={onClose}
      actions={done ? <button type="button" className="hm-btn hm-btn-primary" onClick={onClose}>Klar</button> : step === 3 ? (sure
        ? <><button type="button" className="hm-btn hm-btn-primary" onClick={sign}>Ingå avtal</button><button type="button" className="hm-btn" onClick={() => setSure(false)}>Tillbaka</button></>
        : <><button type="button" className="hm-btn hm-btn-primary" disabled={months < 1 || cost < 0} onClick={() => setSure(true)}>Granska avtalet</button><button type="button" className="hm-btn" onClick={() => setChosen(null)}>Byt kandidat</button></>) : undefined}>
      <ol className="pt-steps" aria-label="Steg">{steps.map((s, i) => <li key={s} data-state={done || i + 1 < step ? "done" : i + 1 === step ? "current" : "todo"}>{s}</li>)}</ol>
      {done ? <p className="pt-note" role="status">{done}</p> : step === 1 ? (
        pending ? <p>Styrelsen söker efter en lämplig samarbetsklubb. Förslagen kommer <b>{pending.endDate}</b>; du får besked i inkorgen.</p> : (
          <>
            <p>Be styrelsen leta upp en lämplig Division 1-klubb för ett samarbete kring speltid för unga spelare. Sökningen tar flera veckor.</p>
            <button type="button" className="hm-btn hm-btn-primary" disabled={blockers.length > 0} onClick={() => { setError(null); const r = request(); if (!r.ok) setError(r.errors.join(" ")); }}>Starta sökningen</button>
            {blockers.length > 0 && <p className="pt-note">{blockers.join(" ")}</p>}
          </>
        )
      ) : step === 2 ? (
        <ul className="pt-candidates" aria-label="Styrelsens förslag">{ready!.candidateClubIds.map((id) => { const c = getClub(id); return (
          <li key={id}><button type="button" onClick={() => setChosen(id)}>
            <ClubCrest shortName={c?.shortName ?? ""} primaryColor={c?.primaryColor ?? ""} clubId={id} size={36} />
            <span><b>{c?.name ?? id}</b><small>{[leagueOf(career, id), c?.city].filter(Boolean).join(" · ") || "Okänd serie"}</small></span>
          </button></li>
        ); })}</ul>
      ) : (
        <div className="pt-terms">
          <p><b>{clubName(chosen!)}</b></p>
          <label>Kostnad per månad<MoneyInput className="hm-input" minEur={0} stepEur={100} valueEur={cost} onChangeEur={(v) => { setCost(v); setSure(false); }} /></label>
          <label>Avtalslängd (månader)<input className="hm-input" type="number" min={1} step={1} value={months} onChange={(e) => { setMonths(Number(e.target.value)); setSure(false); }} /></label>
          <p className="pt-total">{money.format(cost)} × {months} mån = <b>{money.format(cost * Math.max(0, months))}</b></p>
          <p className="pt-note">Kostnaden bokförs varje månad i kassan. Klubben kan bara ha ett aktivt samarbete åt gången.</p>
          {sure && <p className="pt-note" role="status">Granska: {clubName(chosen!)}, {months} månader, totalt {money.format(cost * months)}. Tryck Ingå avtal för att skriva under.</p>}
        </div>
      )}
      {error && <p className="pt-error" role="alert">{error}</p>}
    </SideDrawer>
  );
}

/** CLB-03b A: who is placed (with Kalla tillbaka) and who could be (Placera), as rows with the player's face. */
function Placements({ partnerClubId, startPlacement, recall }: { partnerClubId: string; startPlacement: (playerId: string, partnerClubId: string) => { ok: boolean; errors: string[] }; recall: (playerId: string) => void }) {
  const { career } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const squad = getCareerSquad(career);
  const placed = getActivePlacementsAtClub(career, partnerClubId);
  const placedIds = new Set(placed.map((p) => p.playerId));
  const eligible = squad.filter((p) => !placedIds.has(p.id) && isPartnershipExposureEligible(career, p.id, partnerClubId).eligible);
  const row = (playerId: string, action: React.ReactNode, detail: string) => {
    const p = squad.find((x) => x.id === playerId);
    const age = p ? playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate) : null;
    const apps = career.playerSeasonStats[playerId]?.appearances ?? 0;
    return <li key={playerId}>{p ? <PlayerCell player={p} /> : <span>Okänd spelare</span>}<span className="pt-meta">{p?.position ?? ""}{age !== null ? ` · ${age} år` : ""} · {apps} A-lagsmatcher</span><span className="pt-meta">{detail}</span>{action}</li>;
  };
  return (
    <section className="pt-placements" aria-labelledby={`pt-pl-${partnerClubId}`}>
      <h2 id={`pt-pl-${partnerClubId}`} className="pt-h">Speltid hos {clubName(partnerClubId)}</h2>
      {placed.length === 0 ? <p className="pt-note">Ingen spelare placerad där just nu.</p> : (
        <ul className="pt-rows">{placed.map((pl: PlayerPlacement) => row(pl.playerId, <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => recall(pl.playerId)}>Kalla tillbaka</button>, `sedan ${pl.startDate} · ${pl.exposureAccrued} dagar`))}</ul>
      )}
      <h3 className="pt-sub">Kan placeras (19 år eller yngre)</h3>
      {eligible.length === 0 ? <p className="pt-note">Inga kvalificerade spelare att placera just nu.</p> : (
        <ul className="pt-rows">{eligible.map((p) => row(p.id, <button type="button" className="hm-btn hm-btn-sm" onClick={() => { setError(null); const r = startPlacement(p.id, partnerClubId); if (!r.ok) setError(r.errors.join(" ")); }}>Placera</button>, "i truppen"))}</ul>
      )}
      {error && <p className="pt-error" role="alert">{error}</p>}
    </section>
  );
}

/** CLB-03b A: the international loan form in a drawer -- the existing loan machinery, unchanged. */
function LoanDrawer({ partnership, onClose }: { partnership: ClubPartnership; onClose: () => void }) {
  const { career, startInternationalPartnershipLoan } = useCareer();
  const [playerId, setPlayerId] = useState("");
  const [share, setShare] = useState(100);
  const [endDate, setEndDate] = useState(partnership.endDate ?? career.gameDate);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const squad = getCareerSquad(career).filter((p) => career.playerStatuses[p.id]?.availability !== "ON_PLACEMENT");
  const submit = () => { setError(null); const r = startInternationalPartnershipLoan(partnership.id, playerId, share, endDate); if (!r.ok) { setError(r.errors.join(" ")); return; } setDone(true); };
  return (
    <SideDrawer title={`Låna ut till ${clubName(partnership.clubBId)}`} onClose={onClose}
      actions={done ? <button type="button" className="hm-btn hm-btn-primary" onClick={onClose}>Klar</button> : <button type="button" className="hm-btn hm-btn-primary" disabled={!playerId} onClick={submit}>Låna ut</button>}>
      {done ? <p className="pt-note" role="status">Lånet är registrerat.</p> : (
        <div className="pt-terms">
          <label>Spelare<select className="hm-select" value={playerId} onChange={(e) => setPlayerId(e.target.value)}><option value="">Välj spelare</option>{squad.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></label>
          <label>Löneandel som låntagande klubb betalar (%)<input className="hm-input" type="number" min={0} max={100} value={share} onChange={(e) => setShare(Number(e.target.value))} /></label>
          <label>Lån t.o.m.<input className="hm-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          {!playerId && <p className="pt-note">Välj en spelare för att kunna låna ut.</p>}
        </div>
      )}
      {error && <p className="pt-error" role="alert">{error}</p>}
    </SideDrawer>
  );
}
