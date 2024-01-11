import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SETTINGS } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { ItemComponentArray } from "../components/ComponentArray";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { ItemComponent } from "../components/ItemComponent";

const TICKS_TO_DESPAWN = 300 * SETTINGS.TPS;

export function createItemEntity(position: Point, itemType: ItemType, amount: number, throwingEntityID: number = ID_SENTINEL_VALUE): Entity {
   const itemEntity = new Entity(position, IEntityType.itemEntity, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(itemEntity, 0.1, 0, 0, SETTINGS.ITEM_SIZE, SETTINGS.ITEM_SIZE, 0);
   itemEntity.addHitbox(hitbox);

   const itemComponent: ItemComponent = {
      itemType: itemType,
      amount: amount,
      entityPickupCooldowns: {}
   };
   ItemComponentArray.addComponent(itemEntity, itemComponent);

   itemEntity.rotation = 2 * Math.PI * Math.random();

   if (throwingEntityID !== ID_SENTINEL_VALUE) {
      // Add a pickup cooldown so the item isn't picked up immediately
      itemComponent.entityPickupCooldowns[throwingEntityID] = 1
   }

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