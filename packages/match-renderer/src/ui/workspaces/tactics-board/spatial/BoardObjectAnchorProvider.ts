import { BOARD_OBJECT_DEFINITIONS } from "../boardObjectDefinitions.ts";
import type { BoardObject } from "../scene/BoardObject.ts";
import type { AnchorAttachmentRef } from "./AnchorPoint.ts";
import type { AnchorProvider, AnchorProviderContext, AnchorTarget } from "./AnchorProvider.ts";

function isPlayerObject(object: BoardObject): boolean {
  return object.type === "ATTACKER" || object.type === "DEFENDER" || object.type === "GOALKEEPER";
}

export default class BoardObjectAnchorProvider implements AnchorProvider {
  getAnchorTargets(context: AnchorProviderContext): readonly AnchorTarget[] {
    return context.scene.objects.filter(isPlayerObject).map((object) => ({
      id: object.id,
      ref: { kind: "BOARD_OBJECT", objectId: object.id },
      position: object.position,
      capabilities: ["CENTER", "BOUNDARY", "LEFT", "RIGHT", "TOP", "BOTTOM"],
      radiusMeters: BOARD_OBJECT_DEFINITIONS[object.type].physicalSizeMeters / 2,
    }));
  }

  resolveAttachment(target: AnchorTarget, attachment: AnchorAttachmentRef) {
    if (attachment.kind === "CAPABILITY" && attachment.capability === "CENTER") {
      return target.position;
    }
    if (attachment.kind === "BOUNDARY") {
      return {
        x: target.position.x + attachment.localOffset.x,
        y: target.position.y + attachment.localOffset.y,
      };
    }
    if (attachment.kind === "LOCAL_OFFSET") {
      return {
        x: target.position.x + attachment.offset.x,
        y: target.position.y + attachment.offset.y,
      };
    }
    return null;
  }
}
