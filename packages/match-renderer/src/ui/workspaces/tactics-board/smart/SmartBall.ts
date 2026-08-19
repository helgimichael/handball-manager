import type { BoardObject } from "../scene/BoardObject.ts";
import type { AnchorPoint } from "../spatial/AnchorPoint.ts";
import type { MeterPoint } from "../geometry/CourtTransform.ts";

export const SMART_BALL_VISUAL_OFFSET_METERS: MeterPoint = Object.freeze({ x: 0.32, y: -0.32 });

export type SmartBallPlacement = {
  position: MeterPoint;
  anchorPoint?: AnchorPoint;
};

export function isSmartBall(object: BoardObject): boolean {
  return object.type === "BALL";
}

export function getSmartBallRenderPosition(position: MeterPoint, anchorPoint?: AnchorPoint): MeterPoint {
  if (!anchorPoint?.constraint) {
    return position;
  }
  return {
    x: position.x + SMART_BALL_VISUAL_OFFSET_METERS.x,
    y: position.y + SMART_BALL_VISUAL_OFFSET_METERS.y,
  };
}
