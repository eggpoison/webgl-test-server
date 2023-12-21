import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../GameObject";

export function createTombstone(position: Point): Entity {
   const tombstone = new Entity(position, IEntityType.tombstone, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   return tombstone;
}