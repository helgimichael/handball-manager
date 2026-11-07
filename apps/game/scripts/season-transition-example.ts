/** Reproducible M1.2D example; no live saves are read or written. */
import { attemptSeasonTransition } from '../lib/career/seasonTransition';
import { syntheticTransitionCareer, syntheticTransitionRequest } from '../lib/career/seasonTransition.fixtures';

const career = syntheticTransitionCareer();
const success = attemptSeasonTransition(career, syntheticTransitionRequest(career));
if (success.status !== 'APPLIED') throw new Error(JSON.stringify(success.blockers));
const blocked = attemptSeasonTransition(career);
if (blocked.status !== 'BLOCKED' || blocked.state !== career) throw new Error('Official incomplete profile must preserve the career.');
console.log(JSON.stringify({
  note: 'Success uses a complete SYNTHETIC closed two-tier test policy and synthetic qualification scores, with existing canonical clubs. It is not an official Swedish full-pyramid transition.',
  success: {
    status: success.status, from: career.seasonId, to: success.state.seasonId,
    managedClub: career.playerClubId, fromLeague: career.competitionId, toLeague: success.state.competitionId,
    memberships: success.preview!.leagues.map((l) => ({ competitionId: l.competitionId, size: l.confirmedNextClubIds.length, incoming: l.confirmedIncoming.map((c) => c.clubId), outgoing: l.confirmedOutgoing.map((c) => c.clubId) })),
    fixtures: success.state.fixtures.length, archivedSeasons: success.state.seasonHistory!.length,
    retry: attemptSeasonTransition(success.state, syntheticTransitionRequest(career)).status,
  },
  officialBlocked: { status: blocked.status, originalStatePreserved: blocked.state === career, dependencies: blocked.blockers },
}, null, 2));
