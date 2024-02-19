import { HammerItemType, Item, ItemType, BlueprintBuildingType } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, TribeComponentArray } from "./ComponentArray";
import { createWoodenDoor } from "../entities/structures/wooden-door";
import { createWoodenEmbrasure } from "../entities/structures/wooden-embrasure";
import { createBallista } from "../entities/structures/ballista";
import { createSlingTurret } from "../entities/structures/sling-turret";

const STRUCTURE_WORK_REQUIRED: Record<BlueprintBuildingType, number> = {
   [BlueprintBuildingType.door]: 3,
   [BlueprintBuildingType.embrasure]: 5,
   [BlueprintBuildingType.ballista]: 25,
   [BlueprintBuildingType.slingTurret]: 10
};

const HAMMER_WORK_AMOUNTS: Record<HammerItemType, number> = {
   [ItemType.wooden_hammer]: 1
};

export class BlueprintComponent {
   public readonly buildingType: BlueprintBuildingType;
   public workProgress = 0;

   constructor(shapeType: BlueprintBuildingType) {
      this.buildingType = shapeType;
   }
}

const constructBlueprint = (blueprintEntity: Entity, blueprintComponent: BlueprintComponent): void => {
   const tribeComponent = TribeComponentArray.getComponent(blueprintEntity);
   
   blueprintEntity.remove();
   
   switch (blueprintComponent.buildingType) {
      case BlueprintBuildingType.door: {
         createWoodenDoor(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         break;
      }
      case BlueprintBuildingType.embrasure: {
         createWoodenEmbrasure(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         break;
      }
      case BlueprintBuildingType.ballista: {
         createBallista(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         break;
      }
      case BlueprintBuildingType.slingTurret: {
         createSlingTurret(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         break;
      }
   }
}

export function doBlueprintWork(blueprintEntity: Entity, hammerItem: Item): void {
   const blueprintComponent = BlueprintComponentArray.getComponent(blueprintEntity);
   
   blueprintComponent.workProgress += HAMMER_WORK_AMOUNTS[hammerItem.type as HammerItemType];
   if (blueprintComponent.workProgress >= STRUCTURE_WORK_REQUIRED[blueprintComponent.buildingType]) {
      // Construct the building
      constructBlueprint(blueprintEntity, blueprintComponent);
   }
}

export function getBlueprintProgress(blueprintComponent: BlueprintComponent): number {
   return blueprintComponent.workProgress / STRUCTURE_WORK_REQUIRED[blueprintComponent.buildingType];
}