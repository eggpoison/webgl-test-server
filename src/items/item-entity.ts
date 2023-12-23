import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SETTINGS } from "webgl-test-shared";
import Entity from "../GameObject";
import { ItemComponentArray } from "../components/ComponentArray";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

const TICKS_TO_DESPAWN = 300 * SETTINGS.TPS;

export function createItemEntity(position: Point, itemType: ItemType, amount: number): Entity {
   const itemEntity = new Entity(position, IEntityType.itemEntity, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(itemEntity, 0, 0, SETTINGS.ITEM_SIZE, SETTINGS.ITEM_SIZE);
   itemEntity.addHitbox(hitbox);

   ItemComponentArray.addComponent(itemEntity, {
      itemType: itemType,
      amount: amount,
      entityPickupCooldowns: {}
   });

   itemEntity.rotation = 2 * Math.PI * Math.random();

   return itemEntity;
}

export function tickItemEntity(itemEntity: Entity): void {
   // Despawn old items
   if (itemEntity.ageTicks >= TICKS_TO_DESPAWN) {
      itemEntity.remove();
   }
}

export function addItemEntityPlayerPickupCooldown(itemEntity: Entity, entityID: number, cooldownDuration: number): void {
   const itemComponent = ItemComponentArray.getComponent(itemEntity);
   itemComponent.entityPickupCooldowns[entityID] = cooldownDuration;
}

export function itemEntityCanBePickedUp(itemEntity: Entity, entityID: number): boolean {
   const itemComponent = ItemComponentArray.getComponent(itemEntity);
   return !itemComponent.entityPickupCooldowns.hasOwnProperty(entityID);
}