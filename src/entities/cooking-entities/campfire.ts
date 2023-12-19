import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../../GameObject";

export function createCampfire(position: Point): Entity {
   const campfire = new Entity(position, IEntityType.campfire);
   return campfire;
}