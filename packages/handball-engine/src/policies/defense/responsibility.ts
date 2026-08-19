import { distanceBetween, type MeterPoint } from "../../domain/geometry/coordinates";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";
import type { AttackGapId } from "../../domain/geometry/attackGaps";
import type { DefensiveResponsibility, DefensiveThreatObservation } from "./types";

export type SixZeroDefender = Player & { role: DefenseRole };

export type ResponsibilityResolution = {
  primary: SixZeroDefender | null;
  directSupportRoles: readonly DefenseRole[];
  secondarySupportRoles: readonly DefenseRole[];
  farSideRoles: readonly DefenseRole[];
  recoverRoles: readonly DefenseRole[];
  responsibilities: readonly DefensiveResponsibility[];
};

export const SIX_ZERO_ROLE_ORDER: readonly DefenseRole[] = Object.freeze(["L1", "L2", "L3", "R3", "R2", "R1"]);

export const SIX_ZERO_ROLE_ADJACENCY: Readonly<Record<DefenseRole, readonly DefenseRole[]>> = Object.freeze({
  L1: Object.freeze(["L2"] satisfies readonly DefenseRole[]),
  L2: Object.freeze(["L1", "L3"] satisfies readonly DefenseRole[]),
  L3: Object.freeze(["L2", "R3"] satisfies readonly DefenseRole[]),
  R3: Object.freeze(["L3", "R2"] satisfies readonly DefenseRole[]),
  R2: Object.freeze(["R3", "R1"] satisfies readonly DefenseRole[]),
  R1: Object.freeze(["R2"] satisfies readonly DefenseRole[])
});

export const SIX_ZERO_GAP_RESPONSIBILITIES: Readonly<Record<AttackGapId, readonly DefenseRole[]>> = Object.freeze({
  V1_V2: Object.freeze(["L1", "L2"] satisfies readonly DefenseRole[]),
  V2_V3: Object.freeze(["L2", "L3"] satisfies readonly DefenseRole[]),
  V3_H3: Object.freeze(["L3", "R3"] satisfies readonly DefenseRole[]),
  H3_H2: Object.freeze(["R3", "R2"] satisfies readonly DefenseRole[]),
  H2_H1: Object.freeze(["R2", "R1"] satisfies readonly DefenseRole[])
});

export const RESPONSIBILITY_TRANSFER_THRESHOLD_METERS = 0.35;

// SIM-5.3 v0.1 assumption: this is a transparent deterministic hypothesis, not universal 6:0 truth.
// Current responsibility uses threat position, home structure, defender proximity, and small hysteresis.
// Real handball depends on team principles and context; future policies can replace this resolver.
export function resolveSixZeroResponsibility(
  state: HandballState,
  defenders: readonly SixZeroDefender[],
  threat: DefensiveThreatObservation
): ResponsibilityResolution {
  if (threat.type !== "ACTIVE_ATTACK_THREAT") {
    return buildRecoveryResponsibilities(defenders);
  }

  const homeRoles = SIX_ZERO_GAP_RESPONSIBILITIES[threat.activeAttackGapId];
  const candidateRoles = candidateRolesFor(homeRoles);
  const candidates = defenders.filter((defender) => candidateRoles.includes(defender.role));
  const scored = candidates
    .map((defender) => ({
      defender,
      score: responsibilityScore(state, defender, threat.threatPosition, homeRoles)
    }))
    .sort((a, b) => {
      const delta = a.score - b.score;
      if (Math.abs(delta) > 1e-9) {
        return delta;
      }
      return SIX_ZERO_ROLE_ORDER.indexOf(a.defender.role) - SIX_ZERO_ROLE_ORDER.indexOf(b.defender.role);
    });

  const best = scored[0]?.defender ?? null;
  const primary = chooseStablePrimary(state, scored, best);
  if (!primary) {
    return buildRecoveryResponsibilities(defenders);
  }

  const directSupportRoles = SIX_ZERO_ROLE_ADJACENCY[primary.role].filter((role) => hasDefender(defenders, role));
  const secondarySupportRoles = homeRoles.filter((role) => role !== primary.role && !directSupportRoles.includes(role));
  const farSideRoles = SIX_ZERO_ROLE_ORDER.filter(
    (role) => role !== primary.role && !directSupportRoles.includes(role) && !secondarySupportRoles.includes(role)
  );

  return freezeResolution({
    primary,
    directSupportRoles,
    secondarySupportRoles,
    farSideRoles,
    recoverRoles: [],
    responsibilities: defenders.map((defender) => {
      if (defender.role === primary.role) {
        return responsibility(defender, "PRIMARY");
      }
      if (directSupportRoles.includes(defender.role)) {
        return responsibility(defender, "DIRECT_SUPPORT");
      }
      if (secondarySupportRoles.includes(defender.role)) {
        return responsibility(defender, "SECONDARY_SUPPORT");
      }
      return responsibility(defender, "FAR_SIDE");
    })
  });
}

function candidateRolesFor(homeRoles: readonly DefenseRole[]): readonly DefenseRole[] {
  return Object.freeze(
    SIX_ZERO_ROLE_ORDER.filter(
      (role) => homeRoles.includes(role) || homeRoles.some((homeRole) => SIX_ZERO_ROLE_ADJACENCY[homeRole].includes(role))
    )
  );
}

function responsibilityScore(
  state: HandballState,
  defender: SixZeroDefender,
  threatPosition: MeterPoint,
  homeRoles: readonly DefenseRole[]
): number {
  const home = state.defense.homePositions.find((candidate) => candidate.playerId === defender.id);
  const homePosition = home?.position ?? defender.position;
  const structuralPenalty = homeRoles.includes(defender.role) ? 0 : 1.15;
  const homeConnectionPenalty = Math.abs(homePosition.x - threatPosition.x) * 0.08;
  return distanceBetween(defender.position, threatPosition) + structuralPenalty + homeConnectionPenalty;
}

function chooseStablePrimary(
  state: HandballState,
  scored: readonly { defender: SixZeroDefender; score: number }[],
  best: SixZeroDefender | null
): SixZeroDefender | null {
  if (!best) {
    return null;
  }
  const previousPrimaryId = state.defense.lastReaction?.primaryDefenderId ?? null;
  const previous = scored.find((candidate) => candidate.defender.id === previousPrimaryId);
  const bestScore = scored[0]?.score ?? Number.POSITIVE_INFINITY;

  if (previous && previous.score <= bestScore + RESPONSIBILITY_TRANSFER_THRESHOLD_METERS) {
    return previous.defender;
  }

  return best;
}

function buildRecoveryResponsibilities(defenders: readonly SixZeroDefender[]): ResponsibilityResolution {
  return freezeResolution({
    primary: null,
    directSupportRoles: [],
    secondarySupportRoles: [],
    farSideRoles: [],
    recoverRoles: SIX_ZERO_ROLE_ORDER.filter((role) => hasDefender(defenders, role)),
    responsibilities: defenders.map((defender) => responsibility(defender, "RECOVER"))
  });
}

function hasDefender(defenders: readonly SixZeroDefender[], role: DefenseRole): boolean {
  return defenders.some((defender) => defender.role === role);
}

function responsibility(defender: SixZeroDefender, kind: DefensiveResponsibility["kind"]): DefensiveResponsibility {
  return Object.freeze({
    defenderId: defender.id,
    role: defender.role,
    kind
  });
}

function freezeResolution(resolution: ResponsibilityResolution): ResponsibilityResolution {
  return Object.freeze({
    primary: resolution.primary,
    directSupportRoles: Object.freeze([...resolution.directSupportRoles]),
    secondarySupportRoles: Object.freeze([...resolution.secondarySupportRoles]),
    farSideRoles: Object.freeze([...resolution.farSideRoles]),
    recoverRoles: Object.freeze([...resolution.recoverRoles]),
    responsibilities: Object.freeze(resolution.responsibilities.map((item) => Object.freeze({ ...item })))
  });
}
