import type { MeterPoint } from "../geometry/CourtTransform.ts";
import type { DrawingGeometry, ResolvedDrawingGeometry } from "../drawing/DrawingObject.ts";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";
import type { AnchorPoint, AnchorTargetRef } from "./AnchorPoint.ts";
import type { AnchorProvider, AnchorProviderContext, AnchorTarget } from "./AnchorProvider.ts";
import BoardObjectAnchorProvider from "./BoardObjectAnchorProvider.ts";

export type ConstraintResolverContext = {
  scene: TacticsBoardScene;
  anchorProvider?: AnchorProvider;
};

export type ResolvedAnchorPoint = {
  position: MeterPoint;
  resolved: boolean;
  target?: AnchorTarget;
};

function targetMatches(target: AnchorTarget, ref: AnchorTargetRef): boolean {
  if (target.ref.kind !== ref.kind) {
    return false;
  }
  if (target.ref.kind === "BOARD_OBJECT" && ref.kind === "BOARD_OBJECT") {
    return target.ref.objectId === ref.objectId;
  }
  if (target.ref.kind === "COURT_FEATURE" && ref.kind === "COURT_FEATURE") {
    return target.ref.featureId === ref.featureId;
  }
  if (target.ref.kind === "CUSTOM" && ref.kind === "CUSTOM") {
    return target.ref.entityId === ref.entityId;
  }
  return false;
}

export class ConstraintResolver {
  private readonly defaultAnchorProvider: AnchorProvider;

  constructor(anchorProvider: AnchorProvider = new BoardObjectAnchorProvider()) {
    this.defaultAnchorProvider = anchorProvider;
  }

  resolveAnchorPoint(point: AnchorPoint, context?: ConstraintResolverContext): ResolvedAnchorPoint {
    const constraint = point.constraint;
    if (!constraint || constraint.kind === "COMPOSITE") {
      return { position: point.fallbackPosition, resolved: !constraint };
    }
    if (!context) {
      return { position: point.fallbackPosition, resolved: false };
    }

    const anchorProvider = context.anchorProvider ?? this.defaultAnchorProvider;
    const providerContext: AnchorProviderContext = { scene: context.scene };
    const target = anchorProvider.getAnchorTargets(providerContext).find((candidate) =>
      targetMatches(candidate, constraint.target),
    );
    if (!target) {
      return { position: point.fallbackPosition, resolved: false };
    }

    const attachmentPosition = anchorProvider.resolveAttachment(target, constraint.attachment, providerContext);
    if (!attachmentPosition) {
      return { position: point.fallbackPosition, resolved: false, target };
    }

    if (constraint.kind === "RELATIVE") {
      return {
        position: {
          x: attachmentPosition.x + constraint.offset.x,
          y: attachmentPosition.y + constraint.offset.y,
        },
        resolved: true,
        target,
      };
    }

    return { position: attachmentPosition, resolved: true, target };
  }

  resolveDrawingGeometry(geometry: DrawingGeometry, context?: ConstraintResolverContext): ResolvedDrawingGeometry {
    if (geometry.kind === "POINT") {
      return { kind: "POINT", point: this.resolveAnchorPoint(geometry.point, context).position };
    }
    if (geometry.kind === "LINE") {
      return {
        kind: "LINE",
        start: this.resolveAnchorPoint(geometry.start, context).position,
        end: this.resolveAnchorPoint(geometry.end, context).position,
      };
    }
    return {
      kind: geometry.kind,
      points: geometry.points.map((point) => this.resolveAnchorPoint(point, context).position),
    };
  }

  resolveLegacyDrawingGeometry(geometry: DrawingGeometry, context?: ConstraintResolverContext): ResolvedDrawingGeometry {
    return this.resolveDrawingGeometry(geometry, context);
  }
}

export function resolveDrawingGeometry(
  geometry: DrawingGeometry,
  context?: ConstraintResolverContext,
): ResolvedDrawingGeometry {
  return defaultConstraintResolver.resolveDrawingGeometry(geometry, context);
}

export function resolveLegacyDrawingGeometry(
  geometry: DrawingGeometry,
  context?: ConstraintResolverContext,
): ResolvedDrawingGeometry {
  return defaultConstraintResolver.resolveLegacyDrawingGeometry(geometry, context);
}

export const defaultConstraintResolver = new ConstraintResolver();
