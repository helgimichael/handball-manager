/**
 * Board Scene layer -- object identity, type and position only. Never a
 * handball role (V9, M6, H2, ...) -- roles/formations are a future layer
 * built on top of this, not part of Geometry v0.1.
 *
 * Extension seam for future path-based entities (passningslinjer,
 * löpvägar): BoardObject models a single POINT in space. A future
 * tactical line/path is a different data shape (an ordered sequence of
 * points, not one position) and does not belong here -- the intended
 * design is a separate BoardPath (or similar) type, kept out of this
 * union rather than shoehorned into BoardObject's position field. This
 * module is not yet a discriminated union because there is only one kind
 * today; when a second kind is added, `type` here stays the object-role
 * discriminant and a new top-level `kind: "POINT"` (vs `"PATH"` on the
 * new type) is the natural place to distinguish them.
 */

import type { AnchorPoint } from "../spatial/AnchorPoint.ts";

export type BoardObjectType = "ATTACKER" | "DEFENDER" | "GOALKEEPER" | "BALL" | "CONE";
export type ConeColor = "ORANGE" | "YELLOW";
export type FormationLayerId = "DEFENCE" | "ATTACK";

const BOARD_OBJECT_TYPES: readonly BoardObjectType[] = [
  "ATTACKER",
  "DEFENDER",
  "GOALKEEPER",
  "BALL",
  "CONE",
];

export function isBoardObjectType(value: unknown): value is BoardObjectType {
  return typeof value === "string" && (BOARD_OBJECT_TYPES as readonly string[]).includes(value);
}

export type BoardObjectPosition = { x: number; y: number };

// Positions are always in METERS -- the same coordinate space as
// HandballCourtGeometry, never pixels. See CourtTransform.ts for the only
// place pixel math is allowed to happen (the pointer-input boundary).
export type BoardObject = {
  id: string;
  type: BoardObjectType;
  position: BoardObjectPosition;
  rotation: number;
  anchorPoint?: AnchorPoint;
  label?: string;
  coneColor?: ConeColor;
  formationLayer?: FormationLayerId;
};

export type CreateBoardObjectInput = {
  id: string;
  type: BoardObjectType;
  position: BoardObjectPosition;
  rotation?: number;
  anchorPoint?: AnchorPoint;
  label?: string;
  coneColor?: ConeColor;
  formationLayer?: FormationLayerId;
};

export function createBoardObject(input: CreateBoardObjectInput): BoardObject {
  if (!isBoardObjectType(input.type)) {
    throw new Error(`Unknown BoardObjectType: ${String(input.type)}.`);
  }

  const object: BoardObject = {
    id: input.id,
    type: input.type,
    position: Object.freeze({ x: input.position.x, y: input.position.y }),
    rotation: input.rotation ?? 0,
    ...(input.anchorPoint !== undefined ? { anchorPoint: input.anchorPoint } : {}),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.coneColor !== undefined ? { coneColor: input.coneColor } : {}),
    ...(input.formationLayer !== undefined ? { formationLayer: input.formationLayer } : {}),
  };

  return Object.freeze(object);
}
