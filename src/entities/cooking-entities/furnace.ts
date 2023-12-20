import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";

export const FURNACE_SIZE = 80;

export function createFurnace(position: Point): Entity {
   const furnace = new Entity(position, IEntityType.furnace);

   const hitbox = new RectangularHitbox(furnace, 0, 0, FURNACE_SIZE, FURNACE_SIZE);
   furnace.addHitbox(hitbox);

   return furnace;
}