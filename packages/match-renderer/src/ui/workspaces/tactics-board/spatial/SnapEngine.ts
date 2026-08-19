import type { MeterPoint } from "../geometry/CourtTransform.ts";
import type { AnchorProvider, AnchorProviderContext, AnchorTarget } from "./AnchorProvider.ts";
import type DependencyGraph from "./DependencyGraph.ts";
import type { AnchoredConstraint } from "./AnchorPoint.ts";

export const DEFAULT_PLAYER_ENDPOINT_SNAP_TOLERANCE_METERS = 0.85;
const DEFAULT_BOUNDARY_DIRECTION: MeterPoint = Object.freeze({ x: 0, y: -1 });

export type DrawingEndpointSnapRole = "START" | "END";

export type SnapEngineContext = AnchorProviderContext & {
  dependencyGraph: DependencyGraph;
};

export type DrawingEndpointSnapCandidate = {
  target: AnchorTarget;
  distanceMeters: number;
  snappedPosition: MeterPoint;
  constraint: AnchoredConstraint;
};

export default class SnapEngine {
  constructor(
    private readonly anchorProvider: AnchorProvider,
    private readonly playerEndpointToleranceMeters = DEFAULT_PLAYER_ENDPOINT_SNAP_TOLERANCE_METERS,
  ) {}

  findDrawingEndpointCandidate(
    point: MeterPoint,
    role: DrawingEndpointSnapRole,
    context: SnapEngineContext,
  ): DrawingEndpointSnapCandidate | null {
    let best: DrawingEndpointSnapCandidate | null = null;

    for (const target of this.anchorProvider.getAnchorTargets(context)) {
      if (target.ref.kind !== "BOARD_OBJECT" || !target.capabilities.includes("CENTER")) {
        continue;
      }
      const distanceMeters = Math.hypot(point.x - target.position.x, point.y - target.position.y);
      const tolerance = this.playerEndpointToleranceMeters + (target.radiusMeters ?? 0);
      if (distanceMeters > tolerance || (best && distanceMeters >= best.distanceMeters)) {
        continue;
      }
      const attachment = buildAttachment(point, role, target);
      best = {
        target,
        distanceMeters,
        snappedPosition: resolveSnapPosition(target, attachment),
        constraint: {
          kind: "ANCHORED",
          target: target.ref,
          attachment,
        },
      };
    }

    return best;
  }
}

function buildAttachment(point: MeterPoint, role: DrawingEndpointSnapRole, target: AnchorTarget): AnchoredConstraint["attachment"] {
  if (role === "START") {
    return { kind: "CAPABILITY", capability: "CENTER" };
  }
  const radiusMeters = target.radiusMeters ?? 0;
  const dx = point.x - target.position.x;
  const dy = point.y - target.position.y;
  const distance = Math.hypot(dx, dy);
  const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : DEFAULT_BOUNDARY_DIRECTION;
  return {
    kind: "BOUNDARY",
    localOffset: {
      x: direction.x * radiusMeters,
      y: direction.y * radiusMeters,
    },
  };
}

function resolveSnapPosition(target: AnchorTarget, attachment: AnchoredConstraint["attachment"]): MeterPoint {
  if (attachment.kind === "BOUNDARY") {
    return {
      x: target.position.x + attachment.localOffset.x,
      y: target.position.y + attachment.localOffset.y,
    };
  }
  return target.position;
}
