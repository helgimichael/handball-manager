// Club Identity C4/C5: the two identity facts a club name never hides --
// its relation to a parent club (D7: shown as TEXT, never as a colour) and an
// unverified club colour (G11: the orange fallback is visibly marked, never
// presented as real data). One component for every surface.
import { clubRelationLabel, clubVisualIdentity } from "@/lib/game-data";

export function ClubIdentityTags({ clubId, seasonId, compact = false }: { clubId: string; seasonId?: string; compact?: boolean }) {
  const relation = clubRelationLabel(clubId, seasonId);
  const visual = clubVisualIdentity(clubId);
  if (!relation && !visual.fallbackLabel) return null;
  return (
    <span className="hm-club-identity-tags" data-compact={compact || undefined}>
      {relation && <span className="hm-club-relation" title="Relation till moderklubb">{relation}</span>}
      {visual.fallbackLabel && <span className="hm-club-colour-fallback" data-club-identity="fallback" title="Tillfällig standardfärg tills klubbens matchställ är verifierat">{visual.fallbackLabel}</span>}
    </span>
  );
}
