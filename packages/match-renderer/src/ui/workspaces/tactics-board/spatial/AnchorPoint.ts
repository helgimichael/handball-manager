import type { MeterPoint } from "../geometry/CourtTransform.ts";

export type AnchorTargetKind = "BOARD_OBJECT" | "COURT_FEATURE" | "CUSTOM";

export type AnchorTargetRef =
  | { kind: "BOARD_OBJECT"; objectId: string }
  | { kind: "COURT_FEATURE"; featureId: string }
  | { kind: "CUSTOM"; entityId: string };

export type AnchorCapability =
  | "CENTER"
  | "BOUNDARY"
  | "LEFT"
  | "RIGHT"
  | "TOP"
  | "BOTTOM"
  | "LEFT_POST"
  | "RIGHT_POST";

export type AnchorAttachmentRef =
  | { kind: "CAPABILITY"; capability: AnchorCapability }
  | { kind: "BOUNDARY"; localOffset: MeterPoint }
  | { kind: "LOCAL_OFFSET"; offset: MeterPoint }
  | { kind: "NAMED"; name: string };

export type AnchoredConstraint = {
  kind: "ANCHORED";
  target: AnchorTargetRef;
  attachment: AnchorAttachmentRef;
};

export type RelativeConstraint = {
  kind: "RELATIVE";
  target: AnchorTargetRef;
  attachment: AnchorAttachmentRef;
  offset: MeterPoint;
};

export type CompositeConstraint = {
  kind: "COMPOSITE";
  compositeId: string;
  role: string;
};

export type PointConstraint = AnchoredConstraint | RelativeConstraint | CompositeConstraint;

// AnchorPoint describes how a point exists. Without a constraint it is a
// plain free point; fallbackPosition is still mandatory so broken imports,
// deleted anchors, and future collaboration conflicts always have a safe
// world-coordinate recovery path.
export type AnchorPoint = {
  fallbackPosition: MeterPoint;
  constraint?: PointConstraint;
};

export function createFreeAnchorPoint(position: MeterPoint): AnchorPoint {
  return Object.freeze({
    fallbackPosition: Object.freeze({ x: position.x, y: position.y }),
  });
}

export function anchorPointFromMeterPoint(position: MeterPoint): AnchorPoint {
  return createFreeAnchorPoint(position);
}
