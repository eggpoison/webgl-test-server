import { EntityType, IEntityType } from "webgl-test-shared";
import Hitbox from "./hitboxes/Hitbox";
import { createWallHitboxes } from "./entities/structures/wall";

// @Cleanup: If it's only the add hitboxes function in this file, move it to a different file and remove this file
export function createBuildingHitboxes(entityType: IEntityType, parentX: number, parentY: number, localID: number, parentRotation: number): ReadonlyArray<Hitbox> {
   switch (entityType) {
      case IEntityType.wall: return createWallHitboxes(parentX, parentY, localID, parentRotation);
   }
   throw new Error("Don't know how to create hitboxes for entity type " + EntityType[entityType]);
}