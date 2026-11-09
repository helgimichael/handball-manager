"use client";
// HM-ALPHA3-M05: one of the manager's players as a person -- how he feels
// and why, what he has been promised, what he wants to talk about, whether
// he wants to leave, the bids for him, and the transfer list and release.
import Link from "next/link";
import { useState } from "react";
import { DecisionCard, EventCard } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { playerIntentionOf, INTENTION_LABEL } from "@/lib/players/intentions";
import { dynamicsOf } from "@/lib/players/dynamicsState";
import { releaseCost, releasePlayer } from "@/lib/players/market";
import { moraleLabel, moraleOf, NEUTRAL_MORALE } from "@/lib/players/morale";
import { activePromises, describePromise, PROMISE_KIND_LABEL } from "@/lib/players/promises";
import { answerConcern, decideTransferRequest, listPlayer, openConcerns, unlistPlayer } from "@/lib/players/talks";

export function PlayerIntentionSummary({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const intention = playerIntentionOf(career, playerId);
  return <p className="pd-note"><strong>{intention ? INTENTION_LABEL[intention.kind] : 'Avsikt bedöms vid nästa veckogenomgång'}</strong>{intention && <> &middot; {intention.reasons.join(' ')}</>}</p>;
}

export function MoraleBadge({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const m = moraleOf(career, playerId);
  const tone = m >= 70 ? "good" : m >= 55 ? "ok" : m >= 40 ? "low" : "bad";
  return <span className="pd-morale-badge" data-tone={tone} title={`Moral ${m} %: ${moraleLabel(m)}`}>{m}</span>;
}

export function PlayerDynamicsPanel({ playerId }: { playerId: string }) {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  if (career.playerContracts[playerId]?.clubId !== career.playerClubId) return null;
  const d = dynamicsOf(career);
  const m = d.morale[playerId];
  const morale = moraleOf(career, playerId);
  const concerns = openConcerns(career, playerId);
  const request = d.requests[playerId];
  const listing = d.listings[playerId];
  const promises = activePromises(career, playerId);
  const history = Object.values(d.promises).filter((p) => p.playerId === playerId && p.status !== "ACTIVE").slice(-3);
  const offers = Object.values(career.incomingOffers ?? {}).filter((o) => o.playerId === playerId && ["OPEN", "COUNTERED", "AWAITING_WINDOW"].includes(o.status));
  const pre = career.preContracts?.[playerId];
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); } };
  const value = getPlayerMarketValueEur(career, playerId) ?? 0;

  return (
    <section className="pd-panel" aria-label="Spelaren som person">
      <header className="pd-head">
        <div><span className="xp-eyebrow">Moral</span><h3>{moraleLabel(morale)}</h3></div>
        <MeterBar label="Moral" value={morale / 100} figure={`${morale} %${m ? ` · på väg mot ${m.targetPct} %` : ""}`} tone={morale >= 70 ? "success" : morale >= 45 ? "gold" : "loss"} />
      </header>
      {m && m.factors.length > 0 ? (
        <ul className="pd-factors">{[...m.factors].sort((a, b) => a.points - b.points).map((f, i) => <li key={i} data-tone={f.points > 0 ? "up" : "down"}><span>{f.label}</span><b>{f.points > 0 ? "+" : ""}{f.points}</b></li>)}</ul>
      ) : <p className="pd-note">Inget särskilt påverkar honom just nu (neutral {NEUTRAL_MORALE} %). Moralen uppdateras varje måndag.</p>}
      <p className="pd-note">Moralen påverkar prestationen i match med högst ±3 %.</p>

      <PlayerIntentionSummary playerId={playerId} />
      {pre && <EventCard tone="loss" eyebrow="Förhandsavtal" title={`Lämnar för ${getClub(pre.toClubId)?.shortName ?? pre.toClubId}`}>{`Han går ${pre.effectiveOn} när avtalet löper ut. Klubben får ingen ersättning.`}</EventCard>}

      {concerns.map((c) => (
        <DecisionCard key={c.id} tone="gold" title="Spelarsamtal" status={<span className="tc-pill">{c.raisedOn}</span>}>
          <blockquote className="pd-quote">”{c.message}”</blockquote>
          <div className="pd-options">{c.options.map((o) => <button key={o.id} type="button" className="pd-option" onClick={() => run(() => updateCareer((s) => answerConcern(s, c.id, o.id)), "Du har svarat.")}><b>{o.label}</b><small>{o.consequence}</small></button>)}</div>
        </DecisionCard>
      ))}

      {request?.status === "OPEN" && !pre && (
        <DecisionCard tone="loss" title="Han begär att få lämna" status={<span className="tc-pill">{request.submittedOn}</span>}>
          <p className="pd-note">{request.reason}</p>
          <div className="pd-options">
            <button type="button" className="pd-option" onClick={() => run(() => updateCareer((s) => decideTransferRequest(s, playerId, "ACCEPT")), "Han är transferlistad.")}><b>Godkänn -- lyssna på bud</b><small>Han sätts på transferlistan och blir lugnare. Bud kommer oftare.</small></button>
            <button type="button" className="pd-option" onClick={() => run(() => updateCareer((s) => decideTransferRequest(s, playerId, "PROMISE")), "Han stannar på ditt löfte.")}><b>Övertala med ett löfte</b><small>Bara lojala spelare lyssnar. Löfte om en större roll i tre månader.</small></button>
            <button type="button" className="pd-option" onClick={() => run(() => updateCareer((s) => decideTransferRequest(s, playerId, "REFUSE")), "Begäran är avslagen.")}><b>Avslå</b><small>Moralen sjunker kraftigt. Han kan begära igen om två månader.</small></button>
          </div>
        </DecisionCard>
      )}

      {(promises.length > 0 || history.length > 0) && (
        <div className="pd-promises">
          <h4>Löften</h4>
          <ul>{[...promises, ...history].map((p) => <li key={p.id} data-status={p.status}><b>{PROMISE_KIND_LABEL[p.kind]}</b><span>{describePromise(p)}</span><small>{p.status === "ACTIVE" ? `Utvärderas ${p.deadline}` : `${p.status === "KEPT" ? "Hållet" : p.status === "BROKEN" ? "Brutet" : "Avslutat"}${p.note ? ` · ${p.note}` : ""}`}</small></li>)}</ul>
        </div>
      )}

      {offers.length > 0 && (
        <div className="pd-offers">
          <h4>Bud på honom</h4>
          <ul>{offers.map((o) => <li key={o.id}><span>{getClub(o.fromClubId)?.shortName ?? o.fromClubId}{o.foreign ? " (utland)" : ""}</span><b>{money.format(o.feeEur)}</b><Link className="hm-btn hm-btn-sm" href={`/career/transfers/offers/${encodeURIComponent(o.id)}`}>Öppna budet</Link></li>)}</ul>
        </div>
      )}

      <div className="pd-actions">
        {listing ? (
          <button type="button" className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => unlistPlayer(s, playerId)), "Han är borttagen från transferlistan.")}>Ta bort från transferlistan ({money.format(listing.askingEur, { compact: true })})</button>
        ) : (
          <button type="button" className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => listPlayer(s, playerId, "MANAGER")), "Han är transferlistad.")}>Transferlista (värde {money.format(value, { compact: true })})</button>
        )}
        <button type="button" className="hm-btn hm-btn-sm" onClick={() => setConfirmRelease(true)}>Bryt avtalet…</button>
      </div>
      {confirmRelease && (
        <DecisionCard tone="loss" title="Bryt avtalet" primary={{ label: "Bekräfta", consequence: `Kostnad ${money.format(releaseCost(career, playerId))} bokförs direkt`, onSelect: () => run(() => updateCareer((s) => releasePlayer(s, playerId)), "Avtalet är brutet.") }} secondary={<button type="button" className="hm-btn" onClick={() => setConfirmRelease(false)}>Avbryt</button>}>
          Han blir kontraktslös direkt. Klubben betalar resterande lön, högst sex månader. Andra klubbar kan värva honom gratis.
        </DecisionCard>
      )}
      {message && <p className="pd-note" role="status">{message}</p>}
    </section>
  );
}
