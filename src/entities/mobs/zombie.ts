import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";

export function createZombie(position: Point): Entity {
   const zombie = new Entity(position, IEntityType.zombie, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   return zombie;
}