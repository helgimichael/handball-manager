import type { CorePlayer } from './state';
import type { Profile } from './profile';
/** Test helper: override named execution capacities on one player. */
export function setProfile(p: CorePlayer, patch: Partial<Profile>): void {
  p.profile = { ...p.profile, ...patch };
}
