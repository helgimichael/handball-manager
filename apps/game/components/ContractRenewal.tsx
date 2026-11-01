'use client';
import { useState } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { renewPlayerContract } from '@/lib/career/contractRenewal';
import { localizeMoneyText } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import MoneyInput from './MoneyInput';
export default function ContractRenewal({ playerId }: { playerId: string }) {
  const { career, updateCareer } = useCareer();
  const money = useMoney();
  const contract = career.playerContracts[playerId];
  const [years, setYears] = useState(1), [wage, setWage] = useState(contract?.wageEurPerMonth ?? 0), [message, setMessage] = useState('');
  if (!contract || contract.clubId !== career.playerClubId) return null;
  return <div style={{ marginTop: 12 }}><strong>Förläng kontrakt</strong><p className="hm-text-muted">Behåll nuvarande lön eller erbjud en höjning inom klubbens lönebudget.</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}><label>Förlängning<br /><select aria-label="Förlängning" value={years} onChange={e => setYears(Number(e.target.value))}>{[1, 2, 3].map(n => <option value={n} key={n}>{n} år efter säsongens slut</option>)}</select></label><label>Lön, {money.symbol}/månad<br /><MoneyInput aria-label={`Lön, ${money.symbol}/månad`} minEur={contract.wageEurPerMonth} stepEur={1} valueEur={wage} onChangeEur={setWage} /></label><button className="hm-btn" onClick={() => { try { updateCareer(state => renewPlayerContract(state, playerId, years, wage)); setMessage('Kontraktet är förlängt.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Kunde inte förlänga avtalet.'); } }}>Förläng kontrakt</button></div><p role="status">{localizeMoneyText(message)}</p></div>;
}
