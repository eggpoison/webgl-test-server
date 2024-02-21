import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../Entity";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { HealthComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";

export const WORKBENCH_SIZE = 80;

export function createWorkbench(position: Point): Entity {
   const workbench = new Entity(position, IEntityType.workbench, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(workbench, 1.6, 0, 0, WORKBENCH_SIZE, WORKBENCH_SIZE, 0);
   workbench.addHitbox(hitbox);

   HealthComponentArray.addComponent(workbench, new HealthComponent(15));

   return workbench;
}

export function onWorkbenchRemove(workbench: Entity): void {
   HealthComponentArray.removeComponent(workbench);
}