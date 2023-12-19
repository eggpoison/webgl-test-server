import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../../GameObject";

export function createFurnace(position: Point): Entity {
   const furnace = new Entity(position, IEntityType.furnace);
   return furnace;
}