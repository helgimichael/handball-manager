'use client';
// HM-ALPHA3-M05: contract renewal is a negotiation. The player states a
// demand with its reasons, answers each offer the next day and can refuse.
// Used on the player profile and the Contracts page.
import { PlayerIntentionSummary } from './players/PlayerDynamicsPanel';
import { useState } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '@/lib/career/squadStatus';
import { localizeMoneyText } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { lastTalkFor, openRenewalTalks, openTalkFor, renewalBlocker, submitRenewalOffer, withdrawRenewalTalks } from '@/lib/players/renewals';
import { addDaysIso } from '@/lib/players/dynamicsState';
import { MomentHero } from '@/components/experience/Moment';
import { DEAL_SIGNED_BACKDROP } from '@/components/transfers/transferVisuals';
import MoneyInput from './MoneyInput';

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
  if (!contract || contract.clubId !== career.playerClubId) return null;
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : 'Det gick inte.'); } };
  const blocker = renewalBlocker(career, playerId);
  const agreedRecently = last?.status === 'AGREED' && !!last.closedOn && addDaysIso(last.closedOn, 14) >= career.gameDate;

  return (
    <div className="pd-renewal">
      <PlayerIntentionSummary playerId={playerId} />
      {talk && blocker && <p className="pd-note" role="status">{blocker}</p>}
      <strong>Förläng kontrakt</strong>
      {agreedRecently && last && <MomentHero kind="SIGNING" size="compact" headingLevel={2} backdrop={{ kind: 'photo', style: DEAL_SIGNED_BACKDROP }} tags={[last.closedOn!]} headline="Förlängningen är klar" lede={`Nytt avtal till ${contract.contractEndDate}, ${money.format(contract.wageEurPerMonth)} i månaden.`} />}
      {!talk ? (
        <>
          {last?.status === 'REFUSED' && <p className="pd-note" data-tone="loss">{localizeMoneyText(last.rounds.at(-1)?.reason ?? 'Han sa nej.')} {last.cooldownUntil ? `Nytt försök tidigast ${last.cooldownUntil}.` : ''}</p>}
          {blocker ? <p className="pd-note">{blocker}</p> : <><p className="hm-text-muted">Spelaren berättar vad han vill ha. Han svarar på varje bud dagen efter och kan säga nej.</p><button className="hm-btn" onClick={() => run(() => updateCareer((s) => openRenewalTalks(s, playerId, { kind: 'MANAGER' })), 'Förhandlingen är öppnad.')}>Inled förlängningssamtal</button></>}
        </>
      ) : (
        <>
          <dl className="pd-demand">
            <div><dt>Hans krav</dt><dd>{money.format(talk.demandEurPerMonth)} / mån</dd></div>
            <div><dt>Nu</dt><dd>{money.format(contract.wageEurPerMonth)} / mån</dd></div>
            <div><dt>Roll han räknar med</dt><dd>{SQUAD_STATUS_TIER_LABEL_SV[talk.expectedRole]}</dd></div>
          </dl>
          {talk.demandFactors.length > 0 && <ul className="pd-factors">{talk.demandFactors.map((f) => <li key={f.label} data-tone={f.effectPct > 0 ? 'up' : 'down'}><span>{f.label}</span><b>{f.effectPct > 0 ? '+' : ''}{f.effectPct} %</b></li>)}</ul>}
          {lastRound?.response && <blockquote className="tc-stance" data-response={lastRound.response}>{localizeMoneyText(lastRound.reason ?? '')}</blockquote>}
          {talk.answerOn ? (
            <div className="tc-wait" role="status"><span className="tc-wait-mark" aria-hidden="true" /><span>Budet ligger hos spelaren. Svar {talk.answerOn}.</span><button className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => withdrawRenewalTalks(s, talk.id)), 'Du drog dig ur.')}>Dra dig ur</button></div>
          ) : (
            <div className="pd-offer">
              <label>Förlängning<select aria-label="Förlängning" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option value={n} key={n}>{n} år efter säsongens slut</option>)}</select></label>
              <label>Lön, {money.symbol}/månad<MoneyInput aria-label={`Lön, ${money.symbol}/månad`} minEur={contract.wageEurPerMonth} stepEur={10} valueEur={wage} onChangeEur={setWage} /></label>
              <label>Lova roll (valfritt)<select value={role} onChange={(e) => setRole(e.target.value as SquadStatusTier | '')}><option value="">Inget löfte</option>{SQUAD_STATUS_TIERS.map((t) => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}</option>)}</select></label>
              <button className="hm-btn hm-btn-primary" onClick={() => run(() => updateCareer((s) => submitRenewalOffer(s, talk.id, { wageEurPerMonth: wage, years, promisedRole: role || undefined })), 'Budet är lämnat. Svar i morgon.')}>Förläng kontrakt</button>
              {role && <p className="pd-note">Ett löfte om rollen sänker kravet något men utvärderas om ett halvår.</p>}
            </div>
          )}
        </>
      )}
      <p role="status" className="pd-note">{localizeMoneyText(message)}</p>
    </div>
  );
}
