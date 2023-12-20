import { IEntityType, Point } from "webgl-test-shared";
import Entity from "./GameObject";

export function createTombstone(position: Point): Entity {
   const tombstone = new Entity(position, IEntityType.tombstone);
   return tombstone;
}