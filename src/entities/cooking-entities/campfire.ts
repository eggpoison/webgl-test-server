import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";

export const CAMPFIRE_SIZE = 104;

export function createCampfire(position: Point): Entity {
   const campfire = new Entity(position, IEntityType.campfire, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(campfire, 0, 0, CAMPFIRE_SIZE / 2);
   campfire.addHitbox(hitbox);

   return campfire;
}