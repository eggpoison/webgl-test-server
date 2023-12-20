import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";

export function createCactus(position: Point): Entity {
   const cactus = new Entity(position, IEntityType.cactus);
   return cactus;
}