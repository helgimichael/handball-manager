import { CLUBS, COMPETITIONS, type PlayerMock, type InboxMessage } from '../game-data';
import { getCareerSquad } from './careerWorld';
import { isSelectableForMatch } from './playerStatus';
import { getPlayerContractStatus } from '../economy/contractIntegration';
import { daysBetween } from './dateUtils';
import type { CareerState } from './types';

/** One career snapshot, indexed once per consumer; no requests or rating leaks. */
export function managementPlayers(state: CareerState): PlayerMock[] {
  const players = new Map<string, PlayerMock>();
  for (const squad of Object.values(state.worldSquads)) for (const player of squad) players.set(player.id, player);
  for (const player of getCareerSquad(state)) players.set(player.id, player);
  return [...players.values()];
}

export function contractRows(state: CareerState) {
  return getCareerSquad(state).map(player => {
    const contract = state.playerContracts[player.id];
    return { player, contract, status: getPlayerContractStatus(state, player.id), days: contract ? daysBetween(state.gameDate, contract.contractEndDate) : null };
  }).sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
}

export function squadEnergy(state: CareerState, player: PlayerMock): number {
  return state.playerPhysicalState[player.id]?.currentEnergy ?? player.fitnessPct;
}

export function managementAttention(state: CareerState) {
  const squad = getCareerSquad(state);
  return {
    contracts: contractRows(state).filter(row => row.status === 'EXPIRING' || row.status === 'EXPIRING_SOON' || row.status === 'FREE_AGENT'),
    unavailable: squad.filter(player => !isSelectableForMatch(state.playerStatuses, player.id)),
    tired: squad.filter(player => squadEnergy(state, player) < 75),
    reports: Object.values(state.scoutReports).sort((a, b) => b.createdDate.localeCompare(a.createdDate)),
    shortlist: Object.values(state.recruitmentTargets).filter(target => target.shortlisted),
    offers: Object.values(state.transferOffers).filter(offer => offer.toClubId === state.playerClubId || offer.fromClubId === state.playerClubId),
  };
}

export function searchManagement(state: CareerState, query: string) {
  const term = query.trim().toLocaleLowerCase('sv');
  if (term.length < 2) return [];
  const matches = (text: string) => text.toLocaleLowerCase('sv').includes(term);
  return [
    ...managementPlayers(state).filter(p => matches(`${p.firstName} ${p.lastName}`)).map(p => ({ id: p.id, kind: 'Spelare', label: `${p.firstName} ${p.lastName}`, context: p.position, href: `/career/squad/${encodeURIComponent(p.id)}` })),
    ...CLUBS.filter(c => matches(`${c.name} ${c.shortName}`)).map(c => ({ id: c.id, kind: 'Klubb', label: c.name, context: COMPETITIONS.find(x => x.id === c.competitionId)?.name ?? '', href: c.id === state.playerClubId ? '/career/club' : `/career/clubs/${encodeURIComponent(c.id)}` })),
    ...COMPETITIONS.filter(c => matches(c.name)).map(c => ({ id: c.id, kind: 'Tävling', label: c.name, context: c.nation, href: `/career/competitions/${encodeURIComponent(c.id)}` })),
  ];
}

/** Adds actual contract risks and transfer outcomes once, preserving read/archive state.
 * A renewed/departed player's old alert becomes resolved; it never keeps blocking the manager.
 */
export function syncManagementInbox(state: CareerState): CareerState {
  const risks = managementAttention(state).contracts;
  const active = new Map(risks.map(r => [`management-contract:${r.player.id}:${r.contract?.contractEndDate ?? 'none'}`, r]));
  let changed = false;
  const inbox = state.inbox.map(message => {
    const risk = active.get(message.id);
    if (risk && (message.resolved || message.important !== (risk.status === 'EXPIRING'))) {
      changed = true;
      return { ...message, resolved: false, important: risk.status === 'EXPIRING', subject: message.subject.replace(' · Hanterat', '') };
    }
    if (message.id.startsWith('management-contract:') && !active.has(message.id) && !message.resolved) {
      changed = true;
      return { ...message, resolved: true, important: false, subject: `${message.subject} · Hanterat` };
    }
    return message;
  });
  const ids = new Set(inbox.map(m => m.id));
  const append = (message: InboxMessage) => { if (!ids.has(message.id)) { inbox.push(message); ids.add(message.id); changed = true; } };
  for (const row of risks) {
    const name = `${row.player.firstName} ${row.player.lastName}`;
    append({ id: `management-contract:${row.player.id}:${row.contract?.contractEndDate ?? 'none'}`, category: 'PLAYER', sender: 'Klubbadministrationen', subject: `Kontraktsplanering: ${name}`, preview: `Avtal till ${row.contract?.contractEndDate ?? 'okänt datum'}`, body: [`${name} (${row.player.position}) har ${row.days ?? 0} dagar kvar på sitt avtal.`, 'Inspektera form och speltid, jämför alternativen och besluta om en förlängning.'], date: state.gameDate, read: false, archived: false, resolved: false, important: row.status === 'EXPIRING', destinations: [{ route: 'PLAYER_PROFILE', playerId: row.player.id }, { route: 'RECRUITMENT' }] });
  }
  const newOffers = Object.values(state.transferOffers).filter(offer => (offer.toClubId === state.playerClubId || offer.fromClubId === state.playerClubId) && (offer.status === 'COMPLETED' || offer.status === 'AGREED_AWAITING_WINDOW') && !ids.has(`management-transfer:${offer.id}:${offer.status}`));
  const playerIndex = newOffers.length ? new Map(managementPlayers(state).map(p => [p.id, p])) : new Map<string, PlayerMock>();
  for (const offer of newOffers) {
    const player = playerIndex.get(offer.playerId);
    const name = player ? `${player.firstName} ${player.lastName}` : offer.playerId;
    append({ id: `management-transfer:${offer.id}:${offer.status}`, category: 'CLUB', sender: 'Klubbadministrationen', subject: `${offer.status === 'COMPLETED' ? 'Övergång genomförd' : 'Övergång överenskommen'}: ${name}`, preview: offer.status === 'COMPLETED' ? 'Truppen och klubbens ekonomi har uppdaterats.' : 'Affären väntar på transferfönstret.', body: [`${CLUBS.find(c => c.id === offer.fromClubId)?.name ?? 'Fri agent'} → ${CLUBS.find(c => c.id === offer.toClubId)?.name ?? offer.toClubId}.`, offer.status === 'COMPLETED' ? 'Spelarens nya klubb och kontrakt gäller nu. Kontrollera truppens rollfördelning och träningsplan.' : 'Spelaren byter klubb när transferfönstret öppnar, förutsatt att affären fortfarande är giltig.'], date: state.gameDate, read: false, archived: false, resolved: true, important: false, destinations: [{ route: 'PLAYER_PROFILE', playerId: offer.playerId }, { route: 'RECRUITMENT' }] });
  }
  return changed ? { ...state, inbox } : state;
}

export function playerMatchHistory(state: CareerState, playerId: string) {
  const fixtures = new Map(state.fixtures.map(f => [f.id, f]));
  for (const archive of Object.values(state.matchArchives ?? {})) fixtures.set(archive.fixture.id, archive.fixture);
  return [...fixtures.values()].flatMap(fixture => {
    const result = state.results[fixture.id] ?? state.matchArchives?.[fixture.id]?.result;
    const performance = result && [...result.homePlayerContributions, ...result.awayPlayerContributions].find(p => p.playerId === playerId);
    return performance ? [{ fixture, result: result!, performance, load: state.matchArchives?.[fixture.id]?.load[playerId] }] : [];
  }).sort((a, b) => b.fixture.date.localeCompare(a.fixture.date));
}
