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

/**
 * HM-MATCH-1.3B Part I: "the board and baseFormation must never
 * disagree." Since `DefenceUnitSlot.courtSlot` is deliberately
 * formation-agnostic (1-6, same numbering under every formation --
 * see types.ts's own doc), dragging a player between slots never
 * changes which formation is drawn; `defencePlan.baseFormation` is
 * ALWAYS the single source of truth the board renders from (via
 * `defenceLayout(baseFormation)`), so there is structurally nothing
 * for a player-assignment drag to disagree with. This function is the
 * honest foundation Part I asks for: it validates/normalizes a
 * formation string against the recognized set, the same fallback
 * `defenceLayout` itself already uses -- a pure identity check, not a
 * spatial-clustering inference, because slot-to-slot dragging (Part I:
 * "since dragging is slot-to-slot rather than free x/y, this can stay
 * simple") never produces an unrecognized shape to infer FROM.
 */
export function inferDefenceFormation(baseFormation: string): DefenceFormationOption {
  return (DEFENCE_FORMATION_OPTIONS as readonly string[]).includes(baseFormation) ? (baseFormation as DefenceFormationOption) : "6-0";
}

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

/**
 * HM-COURT-GRID-0.3.1 Part C/F/O: the ONE scene the real Tactics board
 * now renders, for both ANFALL and FÖRSVAR -- FULL_COURT (the same
 * viewport /editor/court-grid uses) with NO FIELD-native board objects.
 * `buildAttackScene`/`buildDefenceScene` above (FIELD's own "attack-6"/
 * "defence-N" formation markers -- the red-triangle/blue-dot shapes
 * Part F asked to remove) are left in place, still exercised by their
 * own existing tests, but are no longer called from the live board:
 * this app's OWN CourtChip overlay (StartingUnitEditor.tsx, positioned
 * via the canonical grid) is the sole player-representation layer now,
 * exactly matching the pattern the calibration editor already
 * established (createInitialScene({courtView:"FULL_COURT", objects:[]})).
 * A single frozen instance -- the scene never varies by formation or
 * phase, since it carries no player markers of its own.
 */
export const FULL_COURT_SCENE = createInitialScene({ courtView: "FULL_COURT", objects: [] });
