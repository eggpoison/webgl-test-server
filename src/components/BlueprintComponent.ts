import { HammerItemType, Item, ItemType, StructureShapeType } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, TribeComponentArray } from "./ComponentArray";
import { createWoodenDoor } from "../entities/structures/wooden-door";
import { createWoodenEmbrasure } from "../entities/structures/wooden-embrasure";

const STRUCTURE_WORK_REQUIRED: Record<StructureShapeType, number> = {
   [StructureShapeType.door]: 3,
   [StructureShapeType.embrasure]: 5
};

const HAMMER_WORK_AMOUNTS: Record<HammerItemType, number> = {
   [ItemType.wooden_hammer]: 1
};

export class BlueprintComponent {
   public readonly shapeType: StructureShapeType;
   public workProgress = 0;

   constructor(shapeType: StructureShapeType) {
      this.shapeType = shapeType;
   }
}

const constructBlueprint = (blueprintEntity: Entity, blueprintComponent: BlueprintComponent): void => {
   const tribeComponent = TribeComponentArray.getComponent(blueprintEntity);
   
   blueprintEntity.remove();
   
   switch (blueprintComponent.shapeType) {
      case StructureShapeType.door: {
         createWoodenDoor(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         break;
      }
      case StructureShapeType.embrasure: {
         createWoodenEmbrasure(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
      }
   }
}

export function doBlueprintWork(blueprintEntity: Entity, hammerItem: Item): void {
   const blueprintComponent = BlueprintComponentArray.getComponent(blueprintEntity);
   
   blueprintComponent.workProgress += HAMMER_WORK_AMOUNTS[hammerItem.type as HammerItemType];
   if (blueprintComponent.workProgress >= STRUCTURE_WORK_REQUIRED[blueprintComponent.shapeType]) {
      // Construct the building
      constructBlueprint(blueprintEntity, blueprintComponent);
   }
}

export function getBlueprintProgress(blueprintComponent: BlueprintComponent): number {
   return blueprintComponent.workProgress / STRUCTURE_WORK_REQUIRED[blueprintComponent.shapeType];
}