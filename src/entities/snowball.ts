import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../GameObject";

export function createSnowball(position: Point): Entity {
   const snowball = new Entity(position, IEntityType.snowball, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   return snowball;
}