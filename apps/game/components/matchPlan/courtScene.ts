// HM-TACTICS-1.1: builds MasterCourt scenes from HM-TACTICS-1.0's own
// starting-unit data -- unlike the old static Taktik page (which drew a
// hardcoded formation disconnected from any real selection), this
// reflects the ACTUAL current attack/defence formation choice. Reuses
// FIELD's own canonical formation coordinate library verbatim (Part A:
// "do not rewrite the court renderer unnecessarily") -- this file only
// picks which named formation to draw and how many objects, it invents
// no new coordinates.
import { createBoardObject, type BoardObject } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/BoardObject.ts";
import { createInitialScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import { FORMATIONS } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/library/FormationLibrary.ts";
import type { AttackFormation } from "@/lib/matchPlan/types";

/** Curated, reusable subset of FIELD's own named defence formations -- exactly the ones with a full 6-defender + goalkeeper layout. */
export const DEFENCE_FORMATION_OPTIONS = ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const;
export type DefenceFormationOption = (typeof DEFENCE_FORMATION_OPTIONS)[number];

export function buildAttackScene(formation: AttackFormation) {
  const objects: BoardObject[] = [];
  if (formation === "NORMAL") {
    const attack = FORMATIONS.find((f) => f.id === "attack-6")!;
    attack.objects
      .filter((o) => o.type === "ATTACKER")
      .forEach((o, i) => objects.push(createBoardObject({ id: `attack-${i}`, type: "ATTACKER", position: o.position, rotation: o.rotation })));
    const defenceForGk = FORMATIONS.find((f) => f.id === "defence-6-0")!;
    const gk = defenceForGk.objects.find((o) => o.type === "GOALKEEPER")!;
    objects.push(createBoardObject({ id: "attack-gk", type: "GOALKEEPER", position: gk.position, rotation: gk.rotation }));
  } else {
    // SEVEN_V_SIX: FIELD's own "attack-7" formation is exactly 7 ATTACKER positions, no goalkeeper -- the correct shape for an extra-attacker lineup.
    const attack7 = FORMATIONS.find((f) => f.id === "attack-7")!;
    attack7.objects
      .filter((o) => o.type === "ATTACKER")
      .forEach((o, i) => objects.push(createBoardObject({ id: `attack7-${i}`, type: "ATTACKER", position: o.position, rotation: o.rotation })));
  }
  // HM-MATCH-1.2 Part D: this workspace only ever shows ONE half's worth
  // of formation content (all objects sit within the near-goal ~12m of a
  // 40m-long court) -- rendering it inside FULL_COURT's 20x40 view left
  // roughly 70% of the board empty, which is the confirmed root cause of
  // the "tiny, scattered players" complaint. HALF_COURT's 20x20 view
  // fits this content properly.
  return createInitialScene({ courtView: "HALF_COURT", objects });
}

export function buildDefenceScene(baseFormation: string) {
  const formation = FORMATIONS.find((f) => f.id === `defence-${baseFormation}`) ?? FORMATIONS.find((f) => f.id === "defence-6-0")!;
  const objects = formation.objects.map((o, i) => createBoardObject({ id: `defence-${i}`, type: o.type, position: o.position, rotation: o.rotation }));
  return createInitialScene({ courtView: "HALF_COURT", objects });
}
