import { COLLISION_BITS, IEntityType, Point, BlueprintType, assertUnreachable } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, HealthComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { BlueprintComponent } from "../components/BlueprintComponent";
import { TribeComponent } from "../components/TribeComponent";
import Tribe from "../Tribe";
import { addBallistaHitboxes } from "./structures/ballista";
import { addSlingTurretHitboxes } from "./structures/sling-turret";
import { addDoorHitboxes } from "./structures/door";
import { addEmbrasureHitboxes } from "./structures/embrasure";
import { addTunnelHitboxes } from "./structures/tunnel";
import { addWallHitboxes } from "./structures/wall";
import { addFloorSpikesHitboxes, addWallSpikesHitboxes } from "./structures/spikes";

// @Incomplete: Remove if the associated entity is removed

export function createBlueprintEntity(position: Point, rotation: number, blueprintType: BlueprintType, associatedEntityID: number, tribe: Tribe): Entity {
   const blueprintEntity = new Entity(position, IEntityType.blueprintEntity, COLLISION_BITS.none, 0);
   blueprintEntity.rotation = rotation;

   switch (blueprintType) {
      case BlueprintType.woodenTunnel:
      case BlueprintType.stoneTunnel:
      case BlueprintType.stoneTunnelUpgrade: {
         addTunnelHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.woodenEmbrasure:
      case BlueprintType.stoneEmbrasure:
      case BlueprintType.stoneEmbrasureUpgrade: {
         addEmbrasureHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.woodenDoor:
      case BlueprintType.stoneDoor:
      case BlueprintType.stoneDoorUpgrade: {
         addDoorHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.ballista: {
         addBallistaHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.slingTurret: {
         addSlingTurretHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.stoneWall: {
         addWallHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.stoneFloorSpikes: {
         addFloorSpikesHitboxes(blueprintEntity);
         break;
      }
      case BlueprintType.stoneWallSpikes: {
         addWallSpikesHitboxes(blueprintEntity);
         break;
      }
      default: {
         assertUnreachable(blueprintType);
      }
   }

   HealthComponentArray.addComponent(blueprintEntity, new HealthComponent(5));
   BlueprintComponentArray.addComponent(blueprintEntity, new BlueprintComponent(blueprintType, associatedEntityID));
   TribeComponentArray.addComponent(blueprintEntity, new TribeComponent(tribe));

   return blueprintEntity;
}

export function onBlueprintEntityRemove(blueprintEntity: Entity): void {
   HealthComponentArray.removeComponent(blueprintEntity);
   BlueprintComponentArray.removeComponent(blueprintEntity);
   TribeComponentArray.removeComponent(blueprintEntity);
}