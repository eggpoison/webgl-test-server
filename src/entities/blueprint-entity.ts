import { COLLISION_BITS, IEntityType, Point, BlueprintType, assertUnreachable } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, HealthComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { BlueprintComponent } from "../components/BlueprintComponent";
import { TribeComponent } from "../components/TribeComponent";
import Tribe from "../Tribe";
import { createBallistaHitboxes } from "./structures/ballista";
import { createSlingTurretHitboxes } from "./structures/sling-turret";
import { createDoorHitboxes } from "./structures/door";
import { createEmbrasureHitboxes } from "./structures/embrasure";
import { createTunnelHitboxes } from "./structures/tunnel";
import { createWallHitboxes } from "./structures/wall";
import CircularHitbox from "../hitboxes/CircularHitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { createFloorSpikesHitboxes, createWallSpikesHitboxes } from "./structures/spikes";

// @Incomplete: Remove if the associated entity is removed

const getBlueprintEntityHitboxes = (blueprintEntity: Entity, blueprintType: BlueprintType): ReadonlyArray<CircularHitbox | RectangularHitbox> => {
   switch (blueprintType) {
      case BlueprintType.woodenTunnel:
      case BlueprintType.stoneTunnel:
      case BlueprintType.stoneTunnelUpgrade: return createTunnelHitboxes(blueprintEntity);
      case BlueprintType.woodenEmbrasure:
      case BlueprintType.stoneEmbrasure:
      case BlueprintType.stoneEmbrasureUpgrade: return createEmbrasureHitboxes(blueprintEntity);
      case BlueprintType.woodenDoor:
      case BlueprintType.stoneDoor:
      case BlueprintType.stoneDoorUpgrade: return createDoorHitboxes(blueprintEntity);
      case BlueprintType.ballista: return createBallistaHitboxes(blueprintEntity);
      case BlueprintType.slingTurret: return createSlingTurretHitboxes(blueprintEntity);
      case BlueprintType.stoneWall: return createWallHitboxes(blueprintEntity.position.x, blueprintEntity.position.y, blueprintEntity.getNextHitboxLocalID(), blueprintEntity.rotation);
      case BlueprintType.stoneFloorSpikes: return createFloorSpikesHitboxes(blueprintEntity);
      case BlueprintType.stoneWallSpikes: return createWallSpikesHitboxes(blueprintEntity);
      default: {
         assertUnreachable(blueprintType);
      }
   }
}

export function createBlueprintEntity(position: Point, rotation: number, blueprintType: BlueprintType, associatedEntityID: number, tribe: Tribe): Entity {
   const blueprintEntity = new Entity(position, IEntityType.blueprintEntity, COLLISION_BITS.none, 0);
   blueprintEntity.rotation = rotation;

   const hitboxes = getBlueprintEntityHitboxes(blueprintEntity, blueprintType);
   for (let i = 0; i < hitboxes.length; i++) {
      blueprintEntity.addHitbox(hitboxes[i]);
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