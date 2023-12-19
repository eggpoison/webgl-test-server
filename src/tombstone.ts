import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "./GameObject";

export function createTombstone(position: Point): Entity {
   const tombstone = new Entity(position, IEntityType.tombstone);
   return tombstone;
}