import { ItemType } from "webgl-test-shared";
import Entity from "./Entity";
import { createItemEntity } from "./entities/item-entity";

/**
 * @param itemSpawnRange Ideally should be a bit larger than the entity's size.
 */
export function createItemsOverEntity(entity: Entity, itemType: ItemType, amount: number, itemSpawnRange: number): void {
   for (let i = 0; i < amount; i++) {
      const magnitude = Math.random() * itemSpawnRange;
      const direction = 2 * Math.PI * Math.random();

      const position = entity.position.copy();
      position.x += magnitude * Math.sin(direction);
      position.y += magnitude * Math.cos(direction);

      createItemEntity(position, itemType, 1);
   }
}