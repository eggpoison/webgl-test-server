import { Item, BlueprintBuildingType, ITEM_INFO_RECORD, HammerItemInfo, BlueprintComponentData, assertUnreachable } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, TribeComponentArray } from "./ComponentArray";
import { createWoodenDoor } from "../entities/structures/wooden-door";
import { createWoodenEmbrasure } from "../entities/structures/wooden-embrasure";
import { createBallista } from "../entities/structures/ballista";
import { createSlingTurret } from "../entities/structures/sling-turret";
import { createWoodenTunnel } from "../entities/structures/wooden-tunnel";
import Board from "../Board";
import { upgradeWall } from "../entities/structures/wall";

const STRUCTURE_WORK_REQUIRED: Record<BlueprintBuildingType, number> = {
   [BlueprintBuildingType.woodenDoor]: 3,
   [BlueprintBuildingType.embrasure]: 5,
   [BlueprintBuildingType.tunnel]: 3,
   [BlueprintBuildingType.ballista]: 25,
   [BlueprintBuildingType.slingTurret]: 10,
   [BlueprintBuildingType.stoneWallUpgrade]: 5
};

export class BlueprintComponent {
   public readonly buildingType: BlueprintBuildingType;
   public workProgress = 0;
   public associatedEntityID: number;

   constructor(shapeType: BlueprintBuildingType, associatedEntityID: number) {
      this.buildingType = shapeType;
      this.associatedEntityID = associatedEntityID;
   }
}

const completeBlueprint = (blueprintEntity: Entity, blueprintComponent: BlueprintComponent): void => {
   const tribeComponent = TribeComponentArray.getComponent(blueprintEntity.id);
   
   blueprintEntity.remove();
   
   switch (blueprintComponent.buildingType) {
      case BlueprintBuildingType.woodenDoor: {
         createWoodenDoor(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
      case BlueprintBuildingType.stoneWallUpgrade: {
         if (!Board.entityRecord.hasOwnProperty(blueprintComponent.associatedEntityID)) {
            throw new Error("No associated wall");
         }
         
         const wall = Board.entityRecord[blueprintComponent.associatedEntityID];
         upgradeWall(wall);
         return;
      }
      case BlueprintBuildingType.embrasure: {
         createWoodenEmbrasure(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
      case BlueprintBuildingType.ballista: {
         createBallista(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
      case BlueprintBuildingType.slingTurret: {
         createSlingTurret(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
      case BlueprintBuildingType.tunnel: {
         createWoodenTunnel(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
   }
   assertUnreachable(blueprintComponent.buildingType);
}

export function doBlueprintWork(blueprintEntity: Entity, hammerItem: Item): void {
   const blueprintComponent = BlueprintComponentArray.getComponent(blueprintEntity.id);
   
   const hammerItemInfo = ITEM_INFO_RECORD[hammerItem.type] as HammerItemInfo;
   // @Temporary
   // blueprintComponent.workProgress += hammerItemInfo.workAmount * 99;
   blueprintComponent.workProgress += hammerItemInfo.workAmount;
   if (blueprintComponent.workProgress >= STRUCTURE_WORK_REQUIRED[blueprintComponent.buildingType]) {
      // Construct the building
      completeBlueprint(blueprintEntity, blueprintComponent);
   }
}

export function serialiseBlueprintComponent(blueprintEntity: Entity): BlueprintComponentData {
   const blueprintComponent = BlueprintComponentArray.getComponent(blueprintEntity.id);
   return {
      buildingType: blueprintComponent.buildingType,
      buildProgress: blueprintComponent.workProgress / STRUCTURE_WORK_REQUIRED[blueprintComponent.buildingType]
   };
}