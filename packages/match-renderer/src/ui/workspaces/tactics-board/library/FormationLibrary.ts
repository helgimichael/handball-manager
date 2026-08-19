import { createBoardObject, type BoardObject, type BoardObjectType } from "../scene/BoardObject.ts";

export type FormationCategory = "Defence" | "Attack";

export type FormationDefinition = {
  id: string;
  title: string;
  category: FormationCategory;
  objects: readonly Omit<BoardObject, "id">[];
};

function player(type: BoardObjectType, x: number, y: number, rotation = 180): Omit<BoardObject, "id"> {
  return {
    type,
    position: { x, y },
    rotation,
  };
}

export const FORMATIONS: readonly FormationDefinition[] = Object.freeze([
  {
    id: "defence-6-0",
    title: "6:0",
    category: "Defence",
    objects: Object.freeze([
      player("GOALKEEPER", 9.888641, 0.517817, 180),
      player("DEFENDER", 2.004454, 2.054565, 180),
      player("DEFENDER", 4.654789, 5.595768, 180),
      player("DEFENDER", 8.44098, 6.998886, 180),
      player("DEFENDER", 11.514476, 6.909801, 180),
      player("DEFENDER", 15.189308, 5.796214, 180),
      player("DEFENDER", 17.906459, 1.965479, 180),
    ]),
  },
  {
    id: "defence-5-1",
    title: "5:1",
    category: "Defence",
    objects: Object.freeze([
      player("GOALKEEPER", 9.977729, 0.562361, 180),
      player("DEFENDER", 2.227171, 2.054565, 180),
      player("DEFENDER", 5.256124, 5.75167, 180),
      player("DEFENDER", 9.977729, 6.508909, 180),
      player("DEFENDER", 14.899777, 5.595768, 180),
      player("DEFENDER", 17.839643, 2.054565, 180),
      player("DEFENDER", 10, 9.047883, 180),
    ]),
  },
  {
    id: "defence-3-2-1",
    title: "3:2:1",
    category: "Defence",
    objects: Object.freeze([
      player("GOALKEEPER", 9.977729, 0.517817, 180),
      player("DEFENDER", 2.605791, 2.87862, 180),
      player("DEFENDER", 9.977729, 6.464365, 180),
      player("DEFENDER", 17.238307, 2.767261, 180),
      player("DEFENDER", 5.72383, 8.001114, 180),
      player("DEFENDER", 14.320713, 8.112472, 180),
      player("DEFENDER", 9.977729, 9.159243, 180),
    ]),
  },
  {
    id: "defence-3-3",
    title: "3:3",
    category: "Defence",
    objects: Object.freeze([
      player("GOALKEEPER", 9.977729, 0.562361, 180),
      player("DEFENDER", 3.296214, 3.702673, 180),
      player("DEFENDER", 9.977729, 6.486637, 180),
      player("DEFENDER", 16.904231, 3.65813, 180),
      player("DEFENDER", 4.565701, 8.179287, 180),
      player("DEFENDER", 9.955456, 9.003341, 180),
      player("DEFENDER", 15.211581, 8.223831, 180),
    ]),
  },
  {
    id: "defence-4-2",
    title: "4:2",
    category: "Defence",
    objects: Object.freeze([
      player("GOALKEEPER", 9.977729, 0.629176, 180),
      player("DEFENDER", 3.073496, 3.435412, 180),
      player("DEFENDER", 7.371937, 6.375279, 180),
      player("DEFENDER", 12.672606, 6.486637, 180),
      player("DEFENDER", 17.060133, 3.41314, 180),
      player("DEFENDER", 7.349666, 9.270601, 180),
      player("DEFENDER", 12.47216, 9.315144, 180),
    ]),
  },
  {
    id: "attack-6",
    title: "6 attackers",
    category: "Attack",
    objects: Object.freeze([
      player("BALL", 9.755011, 11.542316, 0),
      player("ATTACKER", 0.601336, 0.562361, 139.685879),
      player("ATTACKER", 0.935412, 9.292875, 47.386048),
      player("ATTACKER", 9.08686, 11.854121, 0),
      player("ATTACKER", 10.801781, 6.687082, 254.931566),
      player("ATTACKER", 19.220488, 8.379733, 307.874995),
      player("ATTACKER", 19.398663, 0.540089, 226.636613),
    ]),
  },
  {
    id: "attack-7",
    title: "7 attackers",
    category: "Attack",
    objects: Object.freeze([
      player("BALL", 9.08686, 11.876391, 0),
      player("ATTACKER", 0.668151, 0.54009, 139.085592),
      player("ATTACKER", 0.890869, 9.248331, 51.881732),
      player("ATTACKER", 8.596881, 12.076837, 0.498204),
      player("ATTACKER", 10.868597, 6.664811, 223.363384),
      player("ATTACKER", 3.452116, 4.281737, 175.914367),
      player("ATTACKER", 19.242761, 8.157015, 310.364549),
      player("ATTACKER", 19.376393, 0.606904, 235.17554),
    ]),
  },
  {
    id: "attack-empty-left-wing",
    title: "5 attackers",
    category: "Attack",
    objects: Object.freeze([
      player("ATTACKER", 0.801781, 0.584633, 145),
      player("ATTACKER", 1.069042, 8.86971, 48.460171),
      player("ATTACKER", 9.242761, 11.83185, 359.409352),
      player("ATTACKER", 19.242761, 8.312918, 310.502775),
      player("ATTACKER", 19.420936, 0.606905, 222.825289),
      player("BALL", 9.710467, 11.609133, 0),
    ]),
  },
  {
    id: "attack-7-vs-6",
    title: "5:0",
    category: "Defence",
    objects: Object.freeze([
      player("DEFENDER", 2.293986, 2.232739, 0),
      player("DEFENDER", 4.81069, 5.417595, 0),
      player("DEFENDER", 9.955456, 6.731625, 0),
      player("DEFENDER", 15.055678, 5.439866, 0),
      player("DEFENDER", 17.839643, 1.564588, 0),
    ]),
  },
]);

export function createFormationObjects(formation: FormationDefinition, idPrefix = formation.id): BoardObject[] {
  return formation.objects.map((object, index) =>
    createBoardObject({
      id: `${idPrefix}-${index + 1}`,
      type: object.type,
      position: object.position,
      rotation: object.rotation,
    }),
  );
}
