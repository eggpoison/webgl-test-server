import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../../GameObject";

export function createZombie(position: Point): Entity {
   const zombie = new Entity(position, IEntityType.zombie);
   return zombie;
}