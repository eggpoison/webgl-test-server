import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";

export const CAMPFIRE_SIZE = 104;

export function createCampfire(position: Point): Entity {
   const campfire = new Entity(position, IEntityType.campfire);

   const hitbox = new CircularHitbox(campfire, 0, 0, CAMPFIRE_SIZE / 2);
   campfire.addHitbox(hitbox);

   return campfire;
}