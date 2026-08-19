import type { CanonicalBoardObjectType } from "./boardObjectVisuals";

export type CanonicalFormationCategory = "Defence" | "Attack";

export type CanonicalFormationObject = {
  type: CanonicalBoardObjectType;
  position: { x: number; y: number };
  rotation: number;
};

export type CanonicalFormationDefinition = {
  id: string;
  title: string;
  category: CanonicalFormationCategory;
  objects: readonly CanonicalFormationObject[];
};

function object(type: CanonicalBoardObjectType, x: number, y: number, rotation = 180): CanonicalFormationObject {
  return Object.freeze({ type, position: Object.freeze({ x, y }), rotation });
}

export const CANONICAL_FIELD_FORMATIONS: readonly CanonicalFormationDefinition[] = Object.freeze([
  {
    id: "defence-6-0",
    title: "6:0",
    category: "Defence",
    objects: Object.freeze([
      object("GOALKEEPER", 9.888641, 0.517817, 180),
      object("DEFENDER", 2.004454, 2.054565, 180),
      object("DEFENDER", 4.654789, 5.595768, 180),
      object("DEFENDER", 8.44098, 6.998886, 180),
      object("DEFENDER", 11.514476, 6.909801, 180),
      object("DEFENDER", 15.189308, 5.796214, 180),
      object("DEFENDER", 17.906459, 1.965479, 180)
    ])
  },
  {
    id: "defence-5-1",
    title: "5:1",
    category: "Defence",
    objects: Object.freeze([
      object("GOALKEEPER", 9.977729, 0.562361, 180),
      object("DEFENDER", 2.227171, 2.054565, 180),
      object("DEFENDER", 5.256124, 5.75167, 180),
      object("DEFENDER", 9.977729, 6.508909, 180),
      object("DEFENDER", 14.899777, 5.595768, 180),
      object("DEFENDER", 17.839643, 2.054565, 180),
      object("DEFENDER", 10, 9.047883, 180)
    ])
  },
  {
    id: "defence-3-2-1",
    title: "3:2:1",
    category: "Defence",
    objects: Object.freeze([
      object("GOALKEEPER", 9.977729, 0.517817, 180),
      object("DEFENDER", 2.605791, 2.87862, 180),
      object("DEFENDER", 9.977729, 6.464365, 180),
      object("DEFENDER", 17.238307, 2.767261, 180),
      object("DEFENDER", 5.72383, 8.001114, 180),
      object("DEFENDER", 14.320713, 8.112472, 180),
      object("DEFENDER", 9.977729, 9.159243, 180)
    ])
  },
  {
    id: "defence-3-3",
    title: "3:3",
    category: "Defence",
    objects: Object.freeze([
      object("GOALKEEPER", 9.977729, 0.562361, 180),
      object("DEFENDER", 3.296214, 3.702673, 180),
      object("DEFENDER", 9.977729, 6.486637, 180),
      object("DEFENDER", 16.904231, 3.65813, 180),
      object("DEFENDER", 4.565701, 8.179287, 180),
      object("DEFENDER", 9.955456, 9.003341, 180),
      object("DEFENDER", 15.211581, 8.223831, 180)
    ])
  },
  {
    id: "defence-4-2",
    title: "4:2",
    category: "Defence",
    objects: Object.freeze([
      object("GOALKEEPER", 9.977729, 0.629176, 180),
      object("DEFENDER", 3.073496, 3.435412, 180),
      object("DEFENDER", 7.371937, 6.375279, 180),
      object("DEFENDER", 12.672606, 6.486637, 180),
      object("DEFENDER", 17.060133, 3.41314, 180),
      object("DEFENDER", 7.349666, 9.270601, 180),
      object("DEFENDER", 12.47216, 9.315144, 180)
    ])
  },
  {
    id: "attack-6",
    title: "6 attackers",
    category: "Attack",
    objects: Object.freeze([
      object("BALL", 9.755011, 11.542316, 0),
      object("ATTACKER", 0.601336, 0.562361, 139.685879),
      object("ATTACKER", 0.935412, 9.292875, 47.386048),
      object("ATTACKER", 9.08686, 11.854121, 0),
      object("ATTACKER", 10.801781, 6.687082, 254.931566),
      object("ATTACKER", 19.220488, 8.379733, 307.874995),
      object("ATTACKER", 19.398663, 0.540089, 226.636613)
    ])
  },
  {
    id: "attack-7",
    title: "7 attackers",
    category: "Attack",
    objects: Object.freeze([
      object("BALL", 9.08686, 11.876391, 0),
      object("ATTACKER", 0.668151, 0.54009, 139.085592),
      object("ATTACKER", 0.890869, 9.248331, 51.881732),
      object("ATTACKER", 8.596881, 12.076837, 0.498204),
      object("ATTACKER", 10.868597, 6.664811, 223.363384),
      object("ATTACKER", 3.452116, 4.281737, 175.914367),
      object("ATTACKER", 19.242761, 8.157015, 310.364549),
      object("ATTACKER", 19.376393, 0.606904, 235.17554)
    ])
  },
  {
    id: "attack-empty-left-wing",
    title: "5 attackers",
    category: "Attack",
    objects: Object.freeze([
      object("ATTACKER", 0.801781, 0.584633, 145),
      object("ATTACKER", 1.069042, 8.86971, 48.460171),
      object("ATTACKER", 9.242761, 11.83185, 359.409352),
      object("ATTACKER", 19.242761, 8.312918, 310.502775),
      object("ATTACKER", 19.420936, 0.606905, 222.825289),
      object("BALL", 9.710467, 11.609133, 0)
    ])
  },
  {
    id: "attack-7-vs-6",
    title: "5:0",
    category: "Defence",
    objects: Object.freeze([
      object("DEFENDER", 2.293986, 2.232739, 0),
      object("DEFENDER", 4.81069, 5.417595, 0),
      object("DEFENDER", 9.955456, 6.731625, 0),
      object("DEFENDER", 15.055678, 5.439866, 0),
      object("DEFENDER", 17.839643, 1.564588, 0)
    ])
  }
]);

export const CANONICAL_DEFENSE_FORMATIONS = CANONICAL_FIELD_FORMATIONS.filter(
  (formation) => formation.category === "Defence"
);

export const CANONICAL_ATTACK_FORMATIONS = CANONICAL_FIELD_FORMATIONS.filter(
  (formation) => formation.category === "Attack"
);

export function getCanonicalFormation(id: string): CanonicalFormationDefinition | null {
  return CANONICAL_FIELD_FORMATIONS.find((formation) => formation.id === id) ?? null;
}
