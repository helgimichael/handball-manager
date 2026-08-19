import type { DrawingGeometry } from "../drawing/DrawingObject.ts";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";
import type { AnchorPoint, AnchorTargetRef, PointConstraint } from "./AnchorPoint.ts";

export type DependencyEntityKind =
  | "DRAWING"
  | "AREA"
  | "BOARD_OBJECT"
  | "PLAYER_ACTION"
  | "FORMATION"
  | "TEMPLATE"
  | "AI_STRUCTURE"
  | "CUSTOM";

export type DependentEntityRef =
  | { kind: "DRAWING"; drawingId: string }
  | { kind: "AREA"; areaId: string }
  | { kind: "BOARD_OBJECT"; objectId: string }
  | { kind: "PLAYER_ACTION"; actionId: string }
  | { kind: "FORMATION"; formationId: string }
  | { kind: "TEMPLATE"; templateId: string }
  | { kind: "AI_STRUCTURE"; structureId: string }
  | { kind: "CUSTOM"; entityId: string; entityKind?: string };

export type AnchorPointPathSegment = string | number;
export type AnchorPointPath = readonly AnchorPointPathSegment[];

export type SpatialDependencyEntry = {
  target: AnchorTargetRef;
  dependent: DependentEntityRef;
  anchorPointPath: AnchorPointPath;
  constraintKind: PointConstraint["kind"];
};

export function anchorTargetRefKey(ref: AnchorTargetRef): string {
  if (ref.kind === "BOARD_OBJECT") {
    return `${ref.kind}:${ref.objectId}`;
  }
  if (ref.kind === "COURT_FEATURE") {
    return `${ref.kind}:${ref.featureId}`;
  }
  return `${ref.kind}:${ref.entityId}`;
}

function cloneAnchorTargetRef(ref: AnchorTargetRef): AnchorTargetRef {
  return Object.freeze({ ...ref });
}

function cloneDependentEntityRef(ref: DependentEntityRef): DependentEntityRef {
  return Object.freeze({ ...ref });
}

function cloneDependencyEntry(entry: SpatialDependencyEntry): SpatialDependencyEntry {
  return Object.freeze({
    target: cloneAnchorTargetRef(entry.target),
    dependent: cloneDependentEntityRef(entry.dependent),
    anchorPointPath: Object.freeze([...entry.anchorPointPath]),
    constraintKind: entry.constraintKind,
  });
}

function targetFromConstraint(constraint: PointConstraint | undefined): AnchorTargetRef | null {
  if (!constraint || constraint.kind === "COMPOSITE") {
    return null;
  }
  return constraint.target;
}

function collectAnchorPointDependency(
  entries: SpatialDependencyEntry[],
  point: AnchorPoint,
  dependent: DependentEntityRef,
  anchorPointPath: AnchorPointPath,
): void {
  const target = targetFromConstraint(point.constraint);
  if (!target || !point.constraint) {
    return;
  }
  entries.push({
    target,
    dependent,
    anchorPointPath,
    constraintKind: point.constraint.kind,
  });
}

function collectDrawingGeometryDependencies(
  entries: SpatialDependencyEntry[],
  geometry: DrawingGeometry,
  dependent: DependentEntityRef,
): void {
  if (geometry.kind === "POINT") {
    collectAnchorPointDependency(entries, geometry.point, dependent, ["geometry", "point"]);
    return;
  }
  if (geometry.kind === "LINE") {
    collectAnchorPointDependency(entries, geometry.start, dependent, ["geometry", "start"]);
    collectAnchorPointDependency(entries, geometry.end, dependent, ["geometry", "end"]);
    return;
  }
  geometry.points.forEach((point, index) => {
    collectAnchorPointDependency(entries, point, dependent, ["geometry", "points", index]);
  });
}

export default class DependencyGraph {
  private readonly dependentsByTarget: ReadonlyMap<string, readonly SpatialDependencyEntry[]>;
  readonly entries: readonly SpatialDependencyEntry[];

  private constructor(entries: readonly SpatialDependencyEntry[]) {
    const frozenEntries = Object.freeze(entries.map(cloneDependencyEntry));
    const byTarget = new Map<string, SpatialDependencyEntry[]>();

    for (const entry of frozenEntries) {
      const key = anchorTargetRefKey(entry.target);
      const targetEntries = byTarget.get(key);
      if (targetEntries) {
        targetEntries.push(entry);
      } else {
        byTarget.set(key, [entry]);
      }
    }

    this.entries = frozenEntries;
    this.dependentsByTarget = Object.freeze(
      new Map(Array.from(byTarget.entries()).map(([key, value]) => [key, Object.freeze([...value])])),
    );
  }

  static empty(): DependencyGraph {
    return new DependencyGraph([]);
  }

  static fromScene(scene: TacticsBoardScene): DependencyGraph {
    const entries: SpatialDependencyEntry[] = [];

    for (const drawing of scene.drawings) {
      collectDrawingGeometryDependencies(entries, drawing.geometry, {
        kind: "DRAWING",
        drawingId: drawing.id,
      });
    }

    for (const action of scene.playerActions) {
      collectAnchorPointDependency(entries, action.playerAnchor, { kind: "PLAYER_ACTION", actionId: action.id }, ["playerAnchor"]);
      collectAnchorPointDependency(entries, action.screenAnchor, { kind: "PLAYER_ACTION", actionId: action.id }, ["screenAnchor"]);
    }

    return new DependencyGraph(entries);
  }

  getDependents(target: AnchorTargetRef): readonly SpatialDependencyEntry[] {
    return this.dependentsByTarget.get(anchorTargetRefKey(target)) ?? [];
  }

  hasDependents(target: AnchorTargetRef): boolean {
    return this.getDependents(target).length > 0;
  }

  getAllDependencies(): readonly SpatialDependencyEntry[] {
    return this.entries;
  }
}
