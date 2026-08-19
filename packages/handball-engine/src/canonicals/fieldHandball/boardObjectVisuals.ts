export type CanonicalBoardObjectType = "ATTACKER" | "DEFENDER" | "GOALKEEPER" | "BALL" | "CONE";
export type CanonicalBoardObjectShapeKind = "triangle" | "circle" | "square" | "cone";

export type CanonicalBoardObjectVisual = {
  shape: CanonicalBoardObjectShapeKind;
  stroke: string;
  fill: string;
  glowColor: string;
  strokeWidth: number;
  physicalSizeMeters: number;
  supportsRotation: boolean;
};

const NEON_RED = "#FF1A3C";
const NEON_BLUE = "#12A9FF";
const NEON_YELLOW = "#FFDA00";
const CONE_ORANGE = "#FF8A1C";

export const CANONICAL_BOARD_OBJECT_VISUALS: Record<CanonicalBoardObjectType, CanonicalBoardObjectVisual> =
  Object.freeze({
    ATTACKER: {
      shape: "triangle",
      stroke: NEON_RED,
      fill: `color-mix(in srgb, ${NEON_RED} 80%, black 12%)`,
      glowColor: NEON_RED,
      strokeWidth: 0.08,
      physicalSizeMeters: 0.7,
      supportsRotation: true
    },
    DEFENDER: {
      shape: "circle",
      stroke: NEON_BLUE,
      fill: `color-mix(in srgb, ${NEON_BLUE} 80%, black 12%)`,
      glowColor: NEON_BLUE,
      strokeWidth: 0.08,
      physicalSizeMeters: 0.5,
      supportsRotation: true
    },
    GOALKEEPER: {
      shape: "square",
      stroke: NEON_YELLOW,
      fill: `color-mix(in srgb, ${NEON_YELLOW} 80%, black 12%)`,
      glowColor: NEON_YELLOW,
      strokeWidth: 0.08,
      physicalSizeMeters: 0.5,
      supportsRotation: true
    },
    BALL: {
      shape: "circle",
      stroke: "var(--ds-color-background)",
      fill: "var(--ds-color-text)",
      glowColor: "var(--ds-color-text)",
      strokeWidth: 0.025,
      physicalSizeMeters: 0.19,
      supportsRotation: false
    },
    CONE: {
      shape: "cone",
      stroke: `color-mix(in srgb, ${CONE_ORANGE} 78%, black 22%)`,
      fill: CONE_ORANGE,
      glowColor: CONE_ORANGE,
      strokeWidth: 0.035,
      physicalSizeMeters: 0.4125,
      supportsRotation: false
    }
  });

export const CANONICAL_SELECTION_RING_SIZE_RATIO = 1.2;

export function buildCanonicalTrianglePoints(centerX: number, centerY: number, sizeMeters: number): string {
  const radius = sizeMeters / 2;
  const points: Array<[number, number]> = [
    [centerX, centerY - radius],
    [centerX + radius * 0.87, centerY + radius * 0.5],
    [centerX - radius * 0.87, centerY + radius * 0.5]
  ];

  return points.map(([x, y]) => `${x},${y}`).join(" ");
}
