import { IEntityType, ItemType, Point, SETTINGS } from "webgl-test-shared";
import Entity from "../GameObject";
import { ItemComponentArray } from "../components/ComponentArray";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

export function createItemEntity(position: Point, itemType: ItemType, amount: number): Entity {
   const itemEntity = new Entity(position, IEntityType.itemEntity);

   const hitbox = new RectangularHitbox(itemEntity, 0, 0, SETTINGS.ITEM_SIZE, SETTINGS.ITEM_SIZE);
   itemEntity.addHitbox(hitbox);

   ItemComponentArray.addComponent(itemEntity, {
      itemType: itemType,
      amount: amount,
      entityPickupCooldowns: {}
   });

   return itemEntity;
}

export function addItemEntityPlayerPickupCooldown(itemEntity: Entity, entityID: number, cooldownDuration: number): void {
   const itemComponent = ItemComponentArray.getComponent(itemEntity);
   itemComponent.entityPickupCooldowns[entityID] = cooldownDuration;
}

export function itemEntityCanBePickedUp(itemEntity: Entity, entityID: number): boolean {
   const itemComponent = ItemComponentArray.getComponent(itemEntity);
   return !itemComponent.entityPickupCooldowns.hasOwnProperty(entityID);
}