import { ItemType } from "webgl-test-shared";
import Entity from "./Entity";
import { createItemEntity } from "./entities/item-entity";

const ITEM_SPAWN_RANGE = 40;

export function createItemsOverEntity(entity: Entity, itemType: ItemType, amount: number): void {
   for (let i = 0; i < amount; i++) {
      const magnitude = Math.random() * ITEM_SPAWN_RANGE;
      const direction = 2 * Math.PI * Math.random();

      const position = entity.position.copy();
      position.x += magnitude * Math.sin(direction);
      position.y += magnitude * Math.cos(direction);

      createItemEntity(position, itemType, 1);
   }
}