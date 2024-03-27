import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point } from "webgl-test-shared";
import Entity from "../Entity";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { HealthComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../components/StatusEffectComponent";
import Tribe from "../Tribe";
import { TribeComponent } from "../components/TribeComponent";

export const WORKBENCH_SIZE = 80;

export function createWorkbench(position: Point, rotation: number, tribe: Tribe): Entity {
   const workbench = new Entity(position, IEntityType.workbench, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   workbench.rotation = rotation;

   const hitbox = new RectangularHitbox(workbench, 1.6, 0, 0, HitboxCollisionTypeConst.hard, WORKBENCH_SIZE, WORKBENCH_SIZE);
   workbench.addHitbox(hitbox);

   HealthComponentArray.addComponent(workbench, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(workbench, new StatusEffectComponent(0));
   TribeComponentArray.addComponent(workbench, new TribeComponent(tribe));

   return workbench;
}

export function onWorkbenchJoin(workbench: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(workbench.id);
   tribeComponent.tribe.addBuilding(workbench);
}

export function onWorkbenchRemove(workbench: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(workbench.id);
   tribeComponent.tribe.removeBuilding(workbench);

   HealthComponentArray.removeComponent(workbench);
   StatusEffectComponentArray.removeComponent(workbench);
   TribeComponentArray.removeComponent(workbench);
}