import { EntityType, IEntityType } from "webgl-test-shared";
import Hitbox from "./hitboxes/Hitbox";

// @Cleanup: If it's only the add hitboxes function in this file, move it to a different file and remove this file
export function createBuildingHitboxes(entityType: IEntityType): ReadonlyArray<Hitbox> {
   switch (entityType) {
      case IEntityType.wall: {
         
      }
   }
   throw new Error("Don't know how to create hitboxes for entity type " + EntityType[entityType]);
}