import { getCareerPlayer } from './careerWorld';
import { assessTransferAffordability } from '../transfers/affordability';
import type { CareerState } from './types';

/** A compact renewal agreement: retain the current salary or offer a raise.
 * Existing wages are already committed; only a raise consumes new wage budget.
 * Free agents must be recruited through the existing transfer system.
 */
export function renewPlayerContract(state: CareerState, playerId: string, years = 1, wageEurPerMonth?: number): CareerState {
  const player = getCareerPlayer(state, playerId);
  const current = state.playerContracts[playerId];
  // HM-ALPHA2-05C: ownership is the CONTRACT's club, not where the player plays -- the owner may extend a player it has loaned out; a borrowing club never may.
  const loanedIn = Object.values(state.loans ?? {}).some((loan) => loan.active && loan.playerId === playerId && loan.borrowingClubId === state.playerClubId);
  if (loanedIn) throw new Error('Spelaren är inlånad. Avtalet ägs av moderklubben och kan inte förlängas av er.');
  if (!player || !current || current.clubId !== state.playerClubId) throw new Error('Du kan bara förlänga avtal med spelare som din klubb äger.');
  if (current.contractEndDate < state.gameDate) throw new Error('Avtalet har löpt ut. Rekrytera spelaren som kontraktslös via Transfers.');
  if (![1, 2, 3].includes(years)) throw new Error('Välj ett, två eller tre år.');
  const wage = wageEurPerMonth ?? current.wageEurPerMonth;
  if (!Number.isFinite(wage) || wage < current.wageEurPerMonth) throw new Error('En förlängning kräver minst spelarens nuvarande månadslön.');
  const increase = wage - current.wageEurPerMonth;
  if (increase > 0) {
    const affordability = assessTransferAffordability(state, state.playerClubId, 0, 0, increase);
    if (!affordability.affordable) throw new Error(affordability.reasons.join(' '));
  }
  const year = Number(state.gameDate.slice(0, 4));
  const seasonEndYear = state.gameDate.slice(5) > '05-31' ? year + 1 : year;
  const contractEndDate = `${seasonEndYear + years}-05-31`;
  if (contractEndDate <= current.contractEndDate) throw new Error('Spelaren har redan ett avtal som gäller minst så länge. Välj en längre period.');
  return { ...state, playerContracts: { ...state.playerContracts, [playerId]: { ...current, contractEndDate, wageEurPerMonth: Math.round(wage * 100) / 100, wageAgreed: true } } };
}
