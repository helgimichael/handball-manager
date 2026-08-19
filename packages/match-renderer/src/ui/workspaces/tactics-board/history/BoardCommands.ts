import type { MeterPoint } from "../geometry/CourtTransform.ts";
import type { AnchorPoint } from "../spatial/AnchorPoint.ts";
import type { AreaGeometry, AreaObject } from "../area/AreaObject.ts";
import { createAreaObject } from "../area/AreaObject.ts";
import type { DrawingGeometry, DrawingGeometryInput, DrawingObject, DrawingSemantic } from "../drawing/DrawingObject.ts";
import { createDrawingObject } from "../drawing/DrawingObject.ts";
import { createPlayerAction, type CreatePlayerActionInput } from "../actions/PlayerAction.ts";
import type { PlayerAction } from "../actions/PlayerActionTypes.ts";
import { createPlayerState, type CreatePlayerStateInput } from "../states/PlayerState.ts";
import type { PlayerState } from "../states/PlayerStateTypes.ts";
import type { BoardObject, BoardObjectType, ConeColor, FormationLayerId } from "../scene/BoardObject.ts";
import {
  addArea,
  addDrawing,
  addPlayerAction,
  addPlayerState,
  addObject,
  movePlayerActionScreenAnchor,
  moveObject,
  removeArea,
  removeDrawing,
  removeObject,
  removePlayerAction,
  removePlayerState,
  removePlayerStateByPlayerAndType,
  selectArea,
  selectDrawing,
  selectObject,
  setAreas,
  setDrawings,
  setObjectRotation,
  setObjects,
  setPlayerActions,
  setPlayerStates,
  type TacticsBoardScene,
} from "../scene/TacticsBoardScene.ts";
import type { BoardCommand, BoardContext, CommandMetadata, CommandOrigin } from "./BoardCommand.ts";
import { createCommandMetadata } from "./BoardCommand.ts";

type SelectionSnapshot = {
  selectedObjectId: string | null;
  selectedDrawingId: string | null;
  selectedAreaId: string | null;
};

function getSelection(scene: TacticsBoardScene): SelectionSnapshot {
  return {
    selectedObjectId: scene.selectedObjectId,
    selectedDrawingId: scene.drawings.find((drawing) => drawing.selected)?.id ?? null,
    selectedAreaId: scene.areas.find((area) => area.selected)?.id ?? null,
  };
}

function restoreSelection(scene: TacticsBoardScene, selection: SelectionSnapshot): TacticsBoardScene {
  if (selection.selectedObjectId) {
    return selectObject(scene, selection.selectedObjectId);
  }
  if (selection.selectedDrawingId) {
    return selectDrawing(scene, selection.selectedDrawingId);
  }
  if (selection.selectedAreaId) {
    return selectArea(scene, selection.selectedAreaId);
  }
  return selectArea(selectDrawing(selectObject(scene, null), null), null);
}

function insertAt<T>(items: readonly T[], item: T, index: number): readonly T[] {
  const safeIndex = Math.min(items.length, Math.max(0, index));
  return [...items.slice(0, safeIndex), item, ...items.slice(safeIndex)];
}

function replaceDrawingGeometry(
  scene: TacticsBoardScene,
  drawingId: string,
  geometry: DrawingGeometry,
): TacticsBoardScene {
  const drawings = scene.drawings.map((drawing) =>
    drawing.id === drawingId ? { ...drawing, geometry } : drawing,
  );
  return setDrawings(scene, drawings);
}

function replaceAreaGeometry(scene: TacticsBoardScene, areaId: string, geometry: AreaGeometry): TacticsBoardScene {
  const areas = scene.areas.map((area) => (area.id === areaId ? { ...area, geometry } : area));
  return setAreas(scene, areas);
}

abstract class BaseCommand implements BoardCommand {
  readonly metadata: CommandMetadata;

  protected constructor(label: string, origin: CommandOrigin = "USER") {
    this.metadata = createCommandMetadata(label, origin);
  }

  abstract execute(context: BoardContext): void;
  abstract undo(context: BoardContext): void;

  redo(context: BoardContext): void {
    this.execute(context);
  }
}

export class CreateObjectCommand extends BaseCommand {
  private beforeSelection: SelectionSnapshot | null = null;

  constructor(
    private readonly objectId: string,
    private readonly type: BoardObjectType,
    private readonly position: MeterPoint,
    private readonly options: { coneColor?: ConeColor; anchorPoint?: AnchorPoint } = {},
    origin?: CommandOrigin,
  ) {
    super("Create object", origin);
  }

  execute(context: BoardContext): void {
    if (!this.beforeSelection) {
      this.beforeSelection = getSelection(context.getScene());
    }
    context.setScene((current) => addObject(current, this.type, this.position, this.options, () => this.objectId));
  }

  undo(context: BoardContext): void {
    const selection = this.beforeSelection;
    context.setScene((current) => {
      const withoutObject = removeObject(current, this.objectId);
      return selection ? restoreSelection(withoutObject, selection) : withoutObject;
    });
  }
}

export class MoveObjectCommand extends BaseCommand {
  constructor(
    private readonly objectId: string,
    private readonly from: MeterPoint,
    private readonly to: MeterPoint,
    private readonly fromAnchorPoint?: AnchorPoint,
    private readonly toAnchorPoint?: AnchorPoint,
    origin?: CommandOrigin,
  ) {
    super("Move object", origin);
  }

  execute(context: BoardContext): void {
    context.setScene((current) => moveObject(current, this.objectId, this.to, { anchorPoint: this.toAnchorPoint }));
  }

  undo(context: BoardContext): void {
    context.setScene((current) => moveObject(current, this.objectId, this.from, { anchorPoint: this.fromAnchorPoint }));
  }
}

export class RotateObjectCommand extends BaseCommand {
  constructor(
    private readonly objectId: string,
    private readonly from: number,
    private readonly to: number,
    origin?: CommandOrigin,
  ) {
    super("Rotate object", origin);
  }

  execute(context: BoardContext): void {
    context.setScene((current) => setObjectRotation(current, this.objectId, this.to));
  }

  undo(context: BoardContext): void {
    context.setScene((current) => setObjectRotation(current, this.objectId, this.from));
  }
}

export class DeleteObjectCommand extends BaseCommand {
  private deletedObject: BoardObject | null = null;
  private deletedIndex = -1;
  private beforeSelection: SelectionSnapshot | null = null;
  private referencedDrawings: readonly DrawingObject[] = [];
  private referencedAreas: readonly AreaObject[] = [];
  private removedPlayerActions: readonly PlayerAction[] = [];
  private removedPlayerStates: readonly PlayerState[] = [];

  constructor(private readonly objectId: string, origin?: CommandOrigin) {
    super("Delete object", origin);
  }

  execute(context: BoardContext): void {
    const scene = context.getScene();
    if (!this.deletedObject) {
      this.deletedIndex = scene.objects.findIndex((object) => object.id === this.objectId);
      this.deletedObject = scene.objects[this.deletedIndex] ?? null;
      this.beforeSelection = getSelection(scene);
      this.referencedDrawings = scene.drawings.filter((drawing) => drawing.reference?.objectId === this.objectId);
      this.referencedAreas = scene.areas.filter((area) => area.reference?.objectId === this.objectId);
      this.removedPlayerActions = scene.playerActions.filter((action) => action.playerId === this.objectId);
      this.removedPlayerStates = scene.playerStates.filter((state) => state.playerId === this.objectId);
    }
    context.setScene((current) => removeObject(current, this.objectId));
  }

  undo(context: BoardContext): void {
    if (!this.deletedObject || !this.beforeSelection) {
      return;
    }
    context.setScene((current) => {
      const objects = insertAt(current.objects, this.deletedObject as BoardObject, this.deletedIndex);
      const referencedDrawingIds = new Set(this.referencedDrawings.map((drawing) => drawing.id));
      const referencedAreaIds = new Set(this.referencedAreas.map((area) => area.id));
      const drawings = current.drawings.map((drawing) =>
        referencedDrawingIds.has(drawing.id)
          ? (this.referencedDrawings.find((candidate) => candidate.id === drawing.id) ?? drawing)
          : drawing,
      );
      const areas = current.areas.map((area) =>
        referencedAreaIds.has(area.id)
          ? (this.referencedAreas.find((candidate) => candidate.id === area.id) ?? area)
          : area,
      );
      const restoredActions = setPlayerActions(
        setAreas(setDrawings(setObjects(current, objects), drawings), areas),
        [...current.playerActions, ...this.removedPlayerActions],
      );
      const restoredStates = setPlayerStates(restoredActions, [...current.playerStates, ...this.removedPlayerStates]);
      return restoreSelection(restoredStates, this.beforeSelection as SelectionSnapshot);
    });
  }
}

export class CreateDrawingCommand extends BaseCommand {
  private readonly drawing: DrawingObject;
  private beforeSelection: SelectionSnapshot | null = null;

  constructor(drawingId: string, geometry: DrawingGeometryInput, semantic: DrawingSemantic, origin?: CommandOrigin) {
    super("Create drawing", origin);
    this.drawing = createDrawingObject({ id: drawingId, geometry, semantic, selected: true });
  }

  execute(context: BoardContext): void {
    if (!this.beforeSelection) {
      this.beforeSelection = getSelection(context.getScene());
    }
    context.setScene((current) => addDrawing(current, this.drawing.geometry, this.drawing.semantic, () => this.drawing.id));
  }

  undo(context: BoardContext): void {
    const selection = this.beforeSelection;
    context.setScene((current) => {
      const withoutDrawing = removeDrawing(current, this.drawing.id);
      return selection ? restoreSelection(withoutDrawing, selection) : withoutDrawing;
    });
  }
}

export class DeleteDrawingCommand extends BaseCommand {
  private drawing: DrawingObject | null = null;
  private drawingIndex = -1;
  private beforeSelection: SelectionSnapshot | null = null;

  constructor(private readonly drawingId: string, origin?: CommandOrigin) {
    super("Delete drawing", origin);
  }

  execute(context: BoardContext): void {
    const scene = context.getScene();
    if (!this.drawing) {
      this.drawingIndex = scene.drawings.findIndex((drawing) => drawing.id === this.drawingId);
      this.drawing = scene.drawings[this.drawingIndex] ?? null;
      this.beforeSelection = getSelection(scene);
    }
    context.setScene((current) => removeDrawing(current, this.drawingId));
  }

  undo(context: BoardContext): void {
    if (!this.drawing || !this.beforeSelection) {
      return;
    }
    context.setScene((current) => {
      const drawings = insertAt(current.drawings, this.drawing as DrawingObject, this.drawingIndex);
      return restoreSelection(setDrawings(current, drawings), this.beforeSelection as SelectionSnapshot);
    });
  }
}

export class UpdateDrawingGeometryCommand extends BaseCommand {
  constructor(
    private readonly drawingId: string,
    private readonly from: DrawingGeometry,
    private readonly to: DrawingGeometry,
    label = "Update drawing",
    origin?: CommandOrigin,
  ) {
    super(label, origin);
  }

  execute(context: BoardContext): void {
    context.setScene((current) => replaceDrawingGeometry(current, this.drawingId, this.to));
  }

  undo(context: BoardContext): void {
    context.setScene((current) => replaceDrawingGeometry(current, this.drawingId, this.from));
  }
}

export class CreateAreaCommand extends BaseCommand {
  private readonly area: AreaObject;
  private beforeSelection: SelectionSnapshot | null = null;

  constructor(areaId: string, geometry: AreaGeometry, origin?: CommandOrigin) {
    super("Create area", origin);
    this.area = createAreaObject({ id: areaId, geometry, selected: true });
  }

  execute(context: BoardContext): void {
    if (!this.beforeSelection) {
      this.beforeSelection = getSelection(context.getScene());
    }
    context.setScene((current) => addArea(current, this.area.geometry, () => this.area.id));
  }

  undo(context: BoardContext): void {
    const selection = this.beforeSelection;
    context.setScene((current) => {
      const withoutArea = removeArea(current, this.area.id);
      return selection ? restoreSelection(withoutArea, selection) : withoutArea;
    });
  }
}

export class CreatePlayerActionCommand extends BaseCommand {
  private readonly action: PlayerAction;

  constructor(actionId: string, input: Omit<CreatePlayerActionInput, "id">, origin?: CommandOrigin) {
    super("Create player action", origin);
    this.action = createPlayerAction({ ...input, id: actionId });
  }

  execute(context: BoardContext): void {
    context.setScene((current) =>
      addPlayerAction(
        current,
        {
          type: this.action.type,
          playerId: this.action.playerId,
          playerPosition: this.action.playerAnchor.fallbackPosition,
          screenPosition: this.action.screenAnchor.fallbackPosition,
          style: this.action.style,
        },
        () => this.action.id,
      ),
    );
  }

  undo(context: BoardContext): void {
    context.setScene((current) => removePlayerAction(current, this.action.id));
  }
}

export class MovePlayerActionScreenAnchorCommand extends BaseCommand {
  constructor(
    private readonly actionId: string,
    private readonly from: MeterPoint,
    private readonly to: MeterPoint,
    origin?: CommandOrigin,
  ) {
    super("Move player action", origin);
  }

  execute(context: BoardContext): void {
    context.setScene((current) => movePlayerActionScreenAnchor(current, this.actionId, this.to));
  }

  undo(context: BoardContext): void {
    context.setScene((current) => movePlayerActionScreenAnchor(current, this.actionId, this.from));
  }
}

export class TogglePlayerStateCommand extends BaseCommand {
  private readonly state: PlayerState;
  private wasActive: boolean | null = null;

  constructor(stateId: string, input: Omit<CreatePlayerStateInput, "id">, origin?: CommandOrigin) {
    super("Toggle player state", origin);
    this.state = createPlayerState({ ...input, id: stateId });
  }

  execute(context: BoardContext): void {
    const scene = context.getScene();
    if (this.wasActive === null) {
      this.wasActive = scene.playerStates.some(
        (state) => state.playerId === this.state.playerId && state.type === this.state.type,
      );
    }
    context.setScene((current) =>
      this.wasActive
        ? removePlayerStateByPlayerAndType(current, this.state.playerId, this.state.type)
        : addPlayerState(
            current,
            {
              type: this.state.type,
              playerId: this.state.playerId,
              style: this.state.style,
            },
            () => this.state.id,
          ),
    );
  }

  undo(context: BoardContext): void {
    if (this.wasActive === null) {
      return;
    }
    context.setScene((current) =>
      this.wasActive
        ? addPlayerState(
            current,
            {
              type: this.state.type,
              playerId: this.state.playerId,
              style: this.state.style,
            },
            () => this.state.id,
          )
        : removePlayerState(current, this.state.id),
    );
  }
}

export class DeleteAreaCommand extends BaseCommand {
  private area: AreaObject | null = null;
  private areaIndex = -1;
  private beforeSelection: SelectionSnapshot | null = null;

  constructor(private readonly areaId: string, origin?: CommandOrigin) {
    super("Delete area", origin);
  }

  execute(context: BoardContext): void {
    const scene = context.getScene();
    if (!this.area) {
      this.areaIndex = scene.areas.findIndex((area) => area.id === this.areaId);
      this.area = scene.areas[this.areaIndex] ?? null;
      this.beforeSelection = getSelection(scene);
    }
    context.setScene((current) => removeArea(current, this.areaId));
  }

  undo(context: BoardContext): void {
    if (!this.area || !this.beforeSelection) {
      return;
    }
    context.setScene((current) => {
      const areas = insertAt(current.areas, this.area as AreaObject, this.areaIndex);
      return restoreSelection(setAreas(current, areas), this.beforeSelection as SelectionSnapshot);
    });
  }
}

export class UpdateAreaGeometryCommand extends BaseCommand {
  constructor(
    private readonly areaId: string,
    private readonly from: AreaGeometry,
    private readonly to: AreaGeometry,
    label = "Update area",
    origin?: CommandOrigin,
  ) {
    super(label, origin);
  }

  execute(context: BoardContext): void {
    context.setScene((current) => replaceAreaGeometry(current, this.areaId, this.to));
  }

  undo(context: BoardContext): void {
    context.setScene((current) => replaceAreaGeometry(current, this.areaId, this.from));
  }
}

export class PlaceFormationCommand extends BaseCommand {
  private beforeSelection: SelectionSnapshot | null = null;
  private beforeActiveFormationId: string | null = null;
  private removedObjects: Array<{ object: BoardObject; index: number }> | null = null;

  constructor(
    private readonly formationId: string,
    private readonly layer: FormationLayerId,
    private readonly objects: readonly BoardObject[],
    origin?: CommandOrigin,
  ) {
    super("Place formation", origin);
  }

  execute(context: BoardContext): void {
    const scene = context.getScene();
    if (!this.removedObjects) {
      this.beforeSelection = getSelection(scene);
      this.beforeActiveFormationId = context.getActiveFormationId();
      this.removedObjects = scene.objects
        .map((object, index) => ({ object, index }))
        .filter((entry) => entry.object.formationLayer === this.layer);
    }
    context.setActiveFormationId(this.formationId);
    context.setScene((current) =>
      setObjects(
        current,
        [
          ...current.objects.filter((object) => object.formationLayer !== this.layer),
          ...this.objects,
        ],
        null,
      ),
    );
  }

  undo(context: BoardContext): void {
    if (!this.removedObjects || !this.beforeSelection) {
      return;
    }
    context.setActiveFormationId(this.beforeActiveFormationId);
    context.setScene((current) => {
      const insertedIds = new Set(this.objects.map((object) => object.id));
      let objects: readonly BoardObject[] = current.objects.filter((object) => !insertedIds.has(object.id));
      for (const entry of this.removedObjects as Array<{ object: BoardObject; index: number }>) {
        objects = insertAt(objects, entry.object, entry.index);
      }
      return restoreSelection(setObjects(current, objects), this.beforeSelection as SelectionSnapshot);
    });
  }
}

export class ClearBoardCommand extends BaseCommand {
  private beforeScene: {
    objects: readonly BoardObject[];
    drawings: readonly DrawingObject[];
    areas: readonly AreaObject[];
    playerActions: readonly PlayerAction[];
    playerStates: readonly PlayerState[];
    selection: SelectionSnapshot;
    activeFormationId: string | null;
    pathDraftAnchors: readonly MeterPoint[] | null;
  } | null = null;

  constructor(origin?: CommandOrigin) {
    super("Clear board", origin);
  }

  execute(context: BoardContext): void {
    const scene = context.getScene();
    if (!this.beforeScene) {
      this.beforeScene = {
        objects: scene.objects,
        drawings: scene.drawings,
        areas: scene.areas,
        playerActions: scene.playerActions,
        playerStates: scene.playerStates,
        selection: getSelection(scene),
        activeFormationId: context.getActiveFormationId(),
        pathDraftAnchors: context.getPathDraftAnchors(),
      };
    }
    context.setActiveFormationId(null);
    context.setPathDraftAnchors(null);
    context.setScene((current) =>
      setPlayerStates(setPlayerActions(setAreas(setDrawings(setObjects(current, [], null), []), []), []), []),
    );
  }

  undo(context: BoardContext): void {
    if (!this.beforeScene) {
      return;
    }
    context.setActiveFormationId(this.beforeScene.activeFormationId);
    context.setPathDraftAnchors(this.beforeScene.pathDraftAnchors);
    context.setScene((current) => {
      const withObjects = setObjects(current, this.beforeScene?.objects ?? [], null);
      const withDrawings = setDrawings(withObjects, this.beforeScene?.drawings ?? []);
      const withAreas = setAreas(withDrawings, this.beforeScene?.areas ?? []);
      const withPlayerActions = setPlayerActions(withAreas, this.beforeScene?.playerActions ?? []);
      const withPlayerStates = setPlayerStates(withPlayerActions, this.beforeScene?.playerStates ?? []);
      return restoreSelection(withPlayerStates, (this.beforeScene as NonNullable<typeof this.beforeScene>).selection);
    });
  }
}
