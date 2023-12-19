import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../../GameObject";

export function createBarrel(position: Point): Entity {
   const barrel = new Entity(position, IEntityType.barrel);
   return barrel;
}