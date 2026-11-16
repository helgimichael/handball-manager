'use client';
// HM-ALPHA3-M05: contract renewal is a negotiation. The player states a
// demand with its reasons, answers each offer the next day and can refuse.
// Used on the player profile, the Contracts drawer and the squad drawer.
// Arena Nights SQD-02n (A) "Offer with consequence preview": demand breakdown left, offer form right, payroll /
// wage-budget delta bar below; on phones a three-step flow (Krav → Bud → Bekräfta). The actions submitted are
// unchanged (openRenewalTalks, submitRenewalOffer, withdrawRenewalTalks); the preview only reads existing
// calculations (lib/players/renewalPreview.ts).
import { PlayerIntentionSummary } from './players/PlayerDynamicsPanel';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import type { CareerState } from '@/lib/career/types';
import { useCareer } from '@/lib/career/CareerContext';
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '@/lib/career/squadStatus';
import { localizeMoneyText } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { lastTalkFor, openRenewalTalks, openTalkFor, renewalBlocker, submitRenewalOffer, withdrawRenewalTalks } from '@/lib/players/renewals';
import { renewalPreview } from '@/lib/players/renewalPreview';
import { addDaysIso } from '@/lib/players/dynamicsState';
import { MomentHero } from '@/components/experience/Moment';
import { DEAL_SIGNED_BACKDROP } from '@/components/transfers/transferVisuals';
import MoneyInput from './MoneyInput';

const STEPS = ['Krav', 'Bud', 'Bekräfta'] as const;

export default function ContractRenewal({ playerId }: { playerId: string }) {
  const { career, updateCareer } = useCareer();
  const money = useMoney();
  const contract = career.playerContracts[playerId];
  const talk = openTalkFor(career, playerId);
  const last = lastTalkFor(career, playerId);
  const lastRound = talk?.rounds.at(-1);
  const [years, setYears] = useState(2);
  const [wage, setWage] = useState(lastRound?.counterWageEurPerMonth ?? talk?.demandEurPerMonth ?? contract?.wageEurPerMonth ?? 0);
  const [role, setRole] = useState<SquadStatusTier | ''>('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(0);
  if (!contract || contract.clubId !== career.playerClubId) return null;
  const run = (update: (state: CareerState) => CareerState, ok: string) => {
    let outcome = ok;
    // Catch validation where React evaluates the queued decision, using the latest
    // career. Flush this button action before reporting its committed outcome.
    flushSync(() => updateCareer(state => {
      try { return update(state); }
      catch (error) { outcome = error instanceof Error ? error.message : 'Det gick inte.'; return state; }
    }));
    setMessage(outcome);
  };
  const blocker = renewalBlocker(career, playerId);
  const agreedRecently = last?.status === 'AGREED' && !!last.closedOn && addDaysIso(last.closedOn, 14) >= career.gameDate;
  const preview = talk ? renewalPreview(career, playerId, wage) : null;
  const sliderMax = Math.ceil(Math.max(contract.wageEurPerMonth * 2, (talk?.demandEurPerMonth ?? 0) * 1.5, wage) / 10) * 10;
  const yearly = (eur: number) => `${money.format(eur, { compact: true })}/år`;

  return (
    <div className="pd-renewal hm-renew">
      <PlayerIntentionSummary playerId={playerId} />
      {talk && blocker && <p className="pd-note" role="status">{blocker}</p>}
      <strong>Förläng kontrakt</strong>
      {agreedRecently && last && <MomentHero kind="SIGNING" size="compact" headingLevel={2} backdrop={{ kind: 'photo', style: DEAL_SIGNED_BACKDROP }} tags={[last.closedOn!]} headline="Förlängningen är klar" lede={`Nytt avtal till ${contract.contractEndDate}, ${money.format(contract.wageEurPerMonth)} i månaden.`} />}
      {!talk ? (
        <>
          {last?.status === 'REFUSED' && <p className="pd-note" data-tone="loss">{localizeMoneyText(last.rounds.at(-1)?.reason ?? 'Han sa nej.')} {last.cooldownUntil ? `Nytt försök tidigast ${last.cooldownUntil}.` : ''}</p>}
          {blocker ? <p className="pd-note">{blocker}</p> : <><p className="hm-text-muted">Spelaren berättar vad han vill ha. Han svarar på varje bud dagen efter och kan säga nej.</p><button className="hm-btn" onClick={() => run((s) => openRenewalTalks(s, playerId, { kind: 'MANAGER' }), 'Förhandlingen är öppnad.')}>Inled förlängningssamtal</button></>}
        </>
      ) : (
        <>
          {!talk.answerOn && <ol className="hm-renew-steps" aria-label="Steg i förlängningen">
            {STEPS.map((label, i) => <li key={label}><button type="button" aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button></li>)}
          </ol>}
          <div className="hm-renew-grid">
            <section className="hm-renew-demand" data-active={talk.answerOn ? true : step === 0} aria-label="Spelarens krav">
              <dl className="pd-demand">
                <div><dt>Hans krav</dt><dd>{money.format(talk.demandEurPerMonth)} / mån</dd></div>
                <div><dt>Nu</dt><dd>{money.format(contract.wageEurPerMonth)} / mån</dd></div>
                <div><dt>Roll han räknar med</dt><dd>{SQUAD_STATUS_TIER_LABEL_SV[talk.expectedRole]}</dd></div>
              </dl>
              {talk.demandFactors.length > 0 && <>
                <h4 className="hm-renew-h">Vad kravet bygger på</h4>
                <ul className="pd-factors hm-renew-factors">{talk.demandFactors.map((f) => <li key={f.label} data-tone={f.effectPct > 0 ? 'up' : 'down'}>
                  <span>{f.label}</span>
                  <i className="hm-renew-factor-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.abs(f.effectPct) * 4)}%` }} /></i>
                  <b>{f.effectPct > 0 ? '+' : ''}{f.effectPct} %</b>
                </li>)}</ul>
              </>}
              {lastRound?.response && <blockquote className="tc-stance" data-response={lastRound.response}>{localizeMoneyText(lastRound.reason ?? '')}</blockquote>}
              {!talk.answerOn && <button type="button" className="hm-btn hm-btn-sm hm-renew-next" onClick={() => setStep(1)}>Till budet →</button>}
            </section>
            {talk.answerOn ? (
              <div className="tc-wait" role="status"><span className="tc-wait-mark" aria-hidden="true" /><span>Budet ligger hos spelaren. Svar {talk.answerOn}.</span><button className="hm-btn hm-btn-sm" onClick={() => run((s) => withdrawRenewalTalks(s, talk.id), 'Du drog dig ur.')}>Dra dig ur</button></div>
            ) : (
              <section className="pd-offer hm-renew-offer" data-active={step === 1} aria-label="Ditt bud">
                <label>Förlängning<select aria-label="Förlängning" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option value={n} key={n}>{n} år efter säsongens slut</option>)}</select></label>
                <label>Lön, {money.symbol}/månad<MoneyInput aria-label={`Lön, ${money.symbol}/månad`} minEur={contract.wageEurPerMonth} stepEur={10} valueEur={wage} onChangeEur={setWage} /></label>
                <input className="hm-renew-slider" type="range" aria-label="Dra lönebudet" min={contract.wageEurPerMonth} max={sliderMax} step={10} value={wage} onChange={(e) => setWage(Number(e.target.value))} />
                {preview?.demand && <p className="hm-renew-gap" data-tone={preview.demand.gapEurPerMonth >= 0 ? 'ok' : 'short'}>
                  {preview.demand.gapEurPerMonth >= 0 ? `Budet möter hans krav (${preview.demand.offerPctOfDemand} %).` : `${money.format(-preview.demand.gapEurPerMonth)} / mån under kravet (${preview.demand.offerPctOfDemand} % av kravet).`}
                </p>}
                <label>Lova roll (valfritt)<select value={role} onChange={(e) => setRole(e.target.value as SquadStatusTier | '')}><option value="">Inget löfte</option>{SQUAD_STATUS_TIERS.map((t) => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}</option>)}</select></label>
                {role && <p className="pd-note">Ett löfte om rollen sänker kravet något men utvärderas om ett halvår.</p>}
                <button type="button" className="hm-btn hm-btn-sm hm-renew-next" onClick={() => setStep(2)}>Se konsekvensen →</button>
              </section>
            )}
          </div>
          {!talk.answerOn && preview && <section className="hm-renew-confirm" data-active={step === 2} aria-label="Konsekvens för lönebudgeten">
            <h4 className="hm-renew-h">Lönebudget efter budet</h4>
            <div className="hm-renew-budget" role="img" aria-label={`Lönekostnad i dag ${yearly(preview.payrollAnnualEur)}, efter budet ${yearly(preview.payrollAfterAnnualEur)}${preview.wageBudgetEur != null ? `, lönebudget ${yearly(preview.wageBudgetEur)}` : ''}`}>
              <i className="hm-renew-budget-base" style={{ width: `${preview.bar.payrollPct}%` }} />
              {preview.annualDeltaEur !== 0 && <i className="hm-renew-budget-delta" data-dir={preview.annualDeltaEur > 0 ? 'up' : 'down'} data-over={!preview.affordable} style={{ left: `${preview.bar.payrollPct}%`, width: `${preview.bar.deltaPct}%` }} />}
              {preview.bar.budgetPct != null && <b className="hm-renew-budget-line" style={{ left: `${preview.bar.budgetPct}%` }} />}
            </div>
            <dl className="hm-renew-figures">
              <div><dt>Lönekostnad i dag</dt><dd>{yearly(preview.payrollAnnualEur)}</dd></div>
              <div><dt>Budet ändrar</dt><dd>{preview.annualDeltaEur >= 0 ? '+' : '−'}{yearly(Math.abs(preview.annualDeltaEur))}</dd></div>
              <div><dt>Lönebudget</dt><dd>{preview.wageBudgetEur != null ? yearly(preview.wageBudgetEur) : 'Ingen ekonomidata'}</dd></div>
              {preview.roomAfterEur != null && <div><dt>Utrymme kvar</dt><dd data-neg={preview.roomAfterEur < 0}>{preview.roomAfterEur < 0 ? '−' : ''}{yearly(Math.abs(preview.roomAfterEur))}</dd></div>}
            </dl>
            <p className="pd-note" data-tone={preview.affordable ? undefined : 'loss'}>{preview.affordable ? (preview.annualDeltaEur > 0 ? 'Löneökningen ryms i lönebudgeten för nästa säsong.' : 'Ingen löneökning -- påverkar inte lönebudgeten.') : localizeMoneyText(preview.reasons.join(' '))}</p>
            <p className="hm-renew-summary">{years} år efter säsongens slut · {money.format(wage)} / mån{role ? ` · lovad roll: ${SQUAD_STATUS_TIER_LABEL_SV[role]}` : ''}</p>
            <button className="hm-btn hm-btn-primary" onClick={() => run((s) => submitRenewalOffer(s, talk.id, { wageEurPerMonth: wage, years, promisedRole: role || undefined }), 'Budet är lämnat. Svar i morgon.')}>Förläng kontrakt</button>
          </section>}
        </>
      )}
      <p role="status" className="pd-note">{localizeMoneyText(message)}</p>
    </div>
  );
}
