import type { DrawingGeometry, ResolvedDrawingGeometry } from "../drawing/DrawingObject.ts";
import type { MeterPoint } from "../geometry/CourtTransform.ts";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";
import type { AnchorPoint, AnchorTargetRef } from "./AnchorPoint.ts";
import type { AnchorProvider } from "./AnchorProvider.ts";
import BoardObjectAnchorProvider from "./BoardObjectAnchorProvider.ts";
import { ConstraintResolver, type ResolvedAnchorPoint } from "./ConstraintResolver.ts";
import DependencyGraph, { type SpatialDependencyEntry } from "./DependencyGraph.ts";
import SnapEngine, { type DrawingEndpointSnapCandidate, type DrawingEndpointSnapRole } from "./SnapEngine.ts";

export type SpatialEngineContext = {
  scene: TacticsBoardScene;
};

export default class SpatialEngine {
  readonly anchorProvider: AnchorProvider;
  readonly constraintResolver: ConstraintResolver;
  readonly snapEngine: SnapEngine;
  private dependencyGraph: DependencyGraph = DependencyGraph.empty();
  private dependencyGraphScene: TacticsBoardScene | null = null;

  constructor(anchorProvider: AnchorProvider = new BoardObjectAnchorProvider()) {
    this.anchorProvider = anchorProvider;
    this.constraintResolver = new ConstraintResolver(anchorProvider);
    this.snapEngine = new SnapEngine(anchorProvider);
  }

  resolveAnchorPoint(point: AnchorPoint, context: SpatialEngineContext): ResolvedAnchorPoint {
    return this.constraintResolver.resolveAnchorPoint(point, {
      scene: context.scene,
      anchorProvider: this.anchorProvider,
    });
  }

  resolveDrawingGeometry(geometry: DrawingGeometry, context: SpatialEngineContext): ResolvedDrawingGeometry {
    return this.constraintResolver.resolveDrawingGeometry(geometry, {
      scene: context.scene,
      anchorProvider: this.anchorProvider,
    });
  }

  resolveLegacyDrawingGeometry(geometry: DrawingGeometry, context: SpatialEngineContext): ResolvedDrawingGeometry {
    return this.resolveDrawingGeometry(geometry, context);
  }

  rebuildDependencies(context: SpatialEngineContext): DependencyGraph {
    this.dependencyGraph = DependencyGraph.fromScene(context.scene);
    this.dependencyGraphScene = context.scene;
    return this.dependencyGraph;
  }

  invalidateDependencies(): void {
    this.dependencyGraph = DependencyGraph.empty();
    this.dependencyGraphScene = null;
  }

  getDependencyGraph(context: SpatialEngineContext): DependencyGraph {
    if (this.dependencyGraphScene !== context.scene) {
      return this.rebuildDependencies(context);
    }
    return this.dependencyGraph;
  }

  getDependents(target: AnchorTargetRef, context: SpatialEngineContext): readonly SpatialDependencyEntry[] {
    return this.getDependencyGraph(context).getDependents(target);
  }

  findDrawingEndpointSnapCandidate(
    point: MeterPoint,
    role: DrawingEndpointSnapRole,
    context: SpatialEngineContext,
  ): DrawingEndpointSnapCandidate | null {
    return this.snapEngine.findDrawingEndpointCandidate(point, role, {
      scene: context.scene,
      dependencyGraph: this.getDependencyGraph(context),
    });
  }
}

export const defaultSpatialEngine = new SpatialEngine();
