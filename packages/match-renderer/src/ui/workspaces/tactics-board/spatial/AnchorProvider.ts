import type { MeterPoint } from "../geometry/CourtTransform.ts";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";
import type { AnchorAttachmentRef, AnchorCapability, AnchorTargetRef } from "./AnchorPoint.ts";

export type AnchorTarget = {
  id: string;
  ref: AnchorTargetRef;
  position: MeterPoint;
  capabilities: readonly AnchorCapability[];
  radiusMeters?: number;
};

export type AnchorProviderContext = {
  scene: TacticsBoardScene;
};

export interface AnchorProvider {
  getAnchorTargets(context: AnchorProviderContext): readonly AnchorTarget[];
  resolveAttachment(
    target: AnchorTarget,
    attachment: AnchorAttachmentRef,
    context: AnchorProviderContext,
  ): MeterPoint | null;
}

export class EmptyAnchorProvider implements AnchorProvider {
  getAnchorTargets(): readonly AnchorTarget[] {
    return [];
  }

  resolveAttachment(): MeterPoint | null {
    return null;
  }
}
