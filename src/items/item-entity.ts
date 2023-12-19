import { ItemType, Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../GameObject";
import { ItemComponentArray } from "../components/ComponentArray";

export function createItemEntity(position: Point, itemType: ItemType, amount: number): Entity {
   const itemEntity = new Entity(position, IEntityType.itemEntity);
   ItemComponentArray.addComponent(itemEntity, {
      type: itemType,
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