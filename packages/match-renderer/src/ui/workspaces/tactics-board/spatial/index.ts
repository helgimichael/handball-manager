export type {
  AnchorAttachmentRef,
  AnchorCapability,
  AnchorPoint,
  AnchorTargetKind,
  AnchorTargetRef,
  AnchoredConstraint,
  CompositeConstraint,
  PointConstraint,
  RelativeConstraint,
} from "./AnchorPoint.ts";
export { anchorPointFromMeterPoint, createFreeAnchorPoint } from "./AnchorPoint.ts";
export type { AnchorProvider, AnchorProviderContext, AnchorTarget } from "./AnchorProvider.ts";
export { EmptyAnchorProvider } from "./AnchorProvider.ts";
export { default as BoardObjectAnchorProvider } from "./BoardObjectAnchorProvider.ts";
export type { ConstraintResolverContext, ResolvedAnchorPoint } from "./ConstraintResolver.ts";
export {
  ConstraintResolver,
  defaultConstraintResolver,
  resolveDrawingGeometry,
  resolveLegacyDrawingGeometry,
} from "./ConstraintResolver.ts";
export type {
  AnchorPointPath,
  AnchorPointPathSegment,
  DependencyEntityKind,
  DependentEntityRef,
  SpatialDependencyEntry,
} from "./DependencyGraph.ts";
export { anchorTargetRefKey, default as DependencyGraph } from "./DependencyGraph.ts";
export type { SpatialEngineContext } from "./SpatialEngine.ts";
export { default, defaultSpatialEngine } from "./SpatialEngine.ts";
export type { DrawingEndpointSnapCandidate, DrawingEndpointSnapRole, SnapEngineContext } from "./SnapEngine.ts";
export { DEFAULT_PLAYER_ENDPOINT_SNAP_TOLERANCE_METERS, default as SnapEngine } from "./SnapEngine.ts";
