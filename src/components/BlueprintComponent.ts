import { Item, BlueprintType, ITEM_INFO_RECORD, HammerItemInfo, BlueprintComponentData, assertUnreachable, BuildingMaterial, IEntityType } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { BlueprintComponentArray, BuildingMaterialComponentArray, HealthComponentArray, TribeComponentArray } from "./ComponentArray";
import { createDoor } from "../entities/structures/wooden-door";
import { EMBRASURE_HEALTHS, createEmbrasure } from "../entities/structures/embrasure";
import { createBallista } from "../entities/structures/ballista";
import { createSlingTurret } from "../entities/structures/sling-turret";
import { TUNNEL_HEALTHS, createTunnel } from "../entities/structures/tunnel";
import Board from "../Board";
import { WALL_HEALTHS } from "../entities/structures/wall";

const STRUCTURE_WORK_REQUIRED: Record<BlueprintType, number> = {
   [BlueprintType.woodenDoor]: 3,
   [BlueprintType.stoneDoor]: 3,
   [BlueprintType.woodenEmbrasure]: 5,
   [BlueprintType.stoneEmbrasure]: 5,
   [BlueprintType.woodenTunnel]: 3,
   [BlueprintType.stoneTunnel]: 3,
   [BlueprintType.ballista]: 25,
   [BlueprintType.slingTurret]: 10,
   [BlueprintType.stoneWall]: 5
};

export class BlueprintComponent {
   public readonly buildingType: BlueprintType;
   public workProgress = 0;
   public associatedEntityID: number;

   constructor(shapeType: BlueprintType, associatedEntityID: number) {
      this.buildingType = shapeType;
      this.associatedEntityID = associatedEntityID;
   }
}

const upgradeBuilding = (building: Entity): void => {
   const materialComponent = BuildingMaterialComponentArray.getComponent(building.id);
   if (materialComponent.material < BuildingMaterial.stone) {
      materialComponent.material++;

      let maxHealthArray!: ReadonlyArray<number>;
      switch (building.type) {
         case IEntityType.wall: {
            maxHealthArray = WALL_HEALTHS;
            break;
         }
         case IEntityType.embrasure: {
            maxHealthArray = EMBRASURE_HEALTHS;
            break;
         }
         case IEntityType.tunnel: {
            maxHealthArray = TUNNEL_HEALTHS;
            break;
         }
      }
      
      const healthComponent = HealthComponentArray.getComponent(building.id);
      healthComponent.maxHealth = maxHealthArray[materialComponent.material];
      healthComponent.health = healthComponent.maxHealth;
   }
}

const completeBlueprint = (blueprintEntity: Entity, blueprintComponent: BlueprintComponent): void => {
   const tribeComponent = TribeComponentArray.getComponent(blueprintEntity.id);
   
   blueprintEntity.remove();
   
   switch (blueprintComponent.buildingType) {
      case BlueprintType.woodenDoor: {
         createDoor(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation, BuildingMaterial.wood);
         return;
      }
      case BlueprintType.stoneDoor: {
         if (blueprintComponent.associatedEntityID !== ID_SENTINEL_VALUE) {
            const door = Board.entityRecord[blueprintComponent.associatedEntityID];
            upgradeBuilding(door); 
         } else {
            createDoor(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation, BuildingMaterial.stone);
         }
         return;
      }
      case BlueprintType.stoneWall: {
         if (!Board.entityRecord.hasOwnProperty(blueprintComponent.associatedEntityID)) {
            throw new Error("No associated building");
         }
         
         const wall = Board.entityRecord[blueprintComponent.associatedEntityID];
         upgradeBuilding(wall);
         return;
      }
      case BlueprintType.woodenEmbrasure: {
         createEmbrasure(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation, BuildingMaterial.wood);
         return;
      }
      case BlueprintType.stoneEmbrasure: {
         if (blueprintComponent.associatedEntityID !== ID_SENTINEL_VALUE) {
            const embrasure = Board.entityRecord[blueprintComponent.associatedEntityID];
            upgradeBuilding(embrasure);
         } else {
            createEmbrasure(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation, BuildingMaterial.stone);
         }
         return;
      }
      case BlueprintType.ballista: {
         createBallista(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
      case BlueprintType.slingTurret: {
         createSlingTurret(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation);
         return;
      }
      case BlueprintType.woodenTunnel: {
         createTunnel(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation, BuildingMaterial.wood);
         return;
      }
      case BlueprintType.stoneTunnel: {
         if (blueprintComponent.associatedEntityID !== ID_SENTINEL_VALUE) {
            const tunnel = Board.entityRecord[blueprintComponent.associatedEntityID];
            upgradeBuilding(tunnel);
         } else {
            createTunnel(blueprintEntity.position.copy(), tribeComponent.tribe, blueprintEntity.rotation, BuildingMaterial.stone);
         }
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
      blueprintType: blueprintComponent.buildingType,
      buildProgress: blueprintComponent.workProgress / STRUCTURE_WORK_REQUIRED[blueprintComponent.buildingType]
   };
}