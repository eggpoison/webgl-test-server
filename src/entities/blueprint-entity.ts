import { COLLISION_BITS, IEntityType, Point, BlueprintBuildingType, assertUnreachable } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, HealthComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { BlueprintComponent } from "../components/BlueprintComponent";
import { TribeComponent } from "../components/TribeComponent";
import Tribe from "../Tribe";
import { addBallistaHitboxes } from "./structures/ballista";
import { addSlingTurretHitboxes } from "./structures/sling-turret";
import { addWoodenDoorHitboxes } from "./structures/wooden-door";
import { addWoodenEmbrasureHitboxes } from "./structures/wooden-embrasure";
import { addWoodenTunnelHitboxes } from "./structures/wooden-tunnel";
import { addWallHitboxes } from "./structures/wall";

// @Incomplete: Remove if the associated entity is removed

export function createBlueprintEntity(position: Point, buildingType: BlueprintBuildingType, associatedEntityID: number, tribe: Tribe, rotation: number): Entity {
   const blueprintEntity = new Entity(position, IEntityType.blueprintEntity, COLLISION_BITS.none, 0);
   blueprintEntity.rotation = rotation;

   switch (buildingType) {
      case BlueprintBuildingType.tunnel: {
         addWoodenTunnelHitboxes(blueprintEntity);
         break;
      }
      case BlueprintBuildingType.embrasure: {
         addWoodenEmbrasureHitboxes(blueprintEntity);
         break;
      }
      case BlueprintBuildingType.woodenDoor: {
         addWoodenDoorHitboxes(blueprintEntity);
         break;
      }
      case BlueprintBuildingType.ballista: {
         addBallistaHitboxes(blueprintEntity);
         break;
      }
      case BlueprintBuildingType.slingTurret: {
         addSlingTurretHitboxes(blueprintEntity);
         break;
      }
      case BlueprintBuildingType.stoneWallUpgrade: {
         addWallHitboxes(blueprintEntity);
         break;
      }
      default: {
         assertUnreachable(buildingType);
      }
   }

   HealthComponentArray.addComponent(blueprintEntity, new HealthComponent(5));
   BlueprintComponentArray.addComponent(blueprintEntity, new BlueprintComponent(buildingType, associatedEntityID));
   TribeComponentArray.addComponent(blueprintEntity, new TribeComponent(tribe));

   return blueprintEntity;
}

export function onBlueprintEntityRemove(blueprintEntity: Entity): void {
   HealthComponentArray.removeComponent(blueprintEntity);
   BlueprintComponentArray.removeComponent(blueprintEntity);
   TribeComponentArray.removeComponent(blueprintEntity);
}