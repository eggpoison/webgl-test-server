import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../GameObject";

export function createSnowball(position: Point): Entity {
   const snowball = new Entity(position, IEntityType.snowball);
   return snowball;
}