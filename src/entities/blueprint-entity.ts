import { COLLISION_BITS, IEntityType, Point, BlueprintBuildingType } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, HealthComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { BlueprintComponent } from "../components/BlueprintComponent";
import { TribeComponent } from "../components/TribeComponent";
import Tribe from "../Tribe";
import { addBallistaHitboxes } from "./structures/ballista";
import { addSlingTurretHitboxes } from "./structures/sling-turret";

export function createBlueprintEntity(position: Point, buildingType: BlueprintBuildingType, tribe: Tribe | null, rotation: number): Entity {
   const blueprintEntity = new Entity(position, IEntityType.blueprintEntity, COLLISION_BITS.none, 0);
   blueprintEntity.rotation = rotation;

   switch (buildingType) {
      case BlueprintBuildingType.ballista: {
         addBallistaHitboxes(blueprintEntity);
         break;
      }
      case BlueprintBuildingType.slingTurret: {
         addSlingTurretHitboxes(blueprintEntity);
         break;
      }
   }

   HealthComponentArray.addComponent(blueprintEntity, new HealthComponent(5));
   BlueprintComponentArray.addComponent(blueprintEntity, new BlueprintComponent(buildingType));
   TribeComponentArray.addComponent(blueprintEntity, new TribeComponent(tribe));

   return blueprintEntity;
}

export function onBlueprintEntityRemove(blueprintEntity: Entity): void {
   HealthComponentArray.removeComponent(blueprintEntity);
   BlueprintComponentArray.removeComponent(blueprintEntity);
   TribeComponentArray.removeComponent(blueprintEntity);
}