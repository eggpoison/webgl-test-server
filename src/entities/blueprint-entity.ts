import { COLLISION_BITS, IEntityType, Point, BlueprintBuildingType } from "webgl-test-shared";
import Entity from "../Entity";
import { BlueprintComponentArray, HealthComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { BlueprintComponent } from "../components/BlueprintComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import { TribeComponent } from "../components/TribeComponent";
import Tribe from "../Tribe";

export function createBlueprintEntity(position: Point, buildingType: BlueprintBuildingType, tribe: Tribe | null, rotation: number): Entity {
   const blueprintEntity = new Entity(position, IEntityType.blueprintEntity, COLLISION_BITS.none, 0);
   blueprintEntity.rotation = rotation;

   // @Incomplete: Hitbox shape
   // @Hack: mass
   blueprintEntity.addHitbox(new CircularHitbox(blueprintEntity, Number.EPSILON, 0, 0, 10, 0));

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