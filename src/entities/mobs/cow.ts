import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../../GameObject";

export function createCow(position: Point): Entity {
   const cow = new Entity(position, IEntityType.cow);
   return cow;
}