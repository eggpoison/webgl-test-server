import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SettingsConst } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { ItemComponentArray } from "../components/ComponentArray";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { ItemComponent } from "../components/ItemComponent";
import { PhysicsComponent, PhysicsComponentArray } from "../components/PhysicsComponent";
import { addFleshSword, removeFleshSword } from "../flesh-sword-ai";

const TICKS_TO_DESPAWN = 300 * SettingsConst.TPS;

export function createItemEntity(position: Point, itemType: ItemType, amount: number, throwingEntityID: number = ID_SENTINEL_VALUE): Entity {
   const itemEntity = new Entity(position, IEntityType.itemEntity, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   itemEntity.rotation = 2 * Math.PI * Math.random();

   const hitbox = new RectangularHitbox(itemEntity, 0.1, 0, 0, SettingsConst.ITEM_SIZE, SettingsConst.ITEM_SIZE);
   itemEntity.addHitbox(hitbox);

   PhysicsComponentArray.addComponent(itemEntity, new PhysicsComponent(true));
   const itemComponent: ItemComponent = {
      itemType: itemType,
      amount: amount,
      entityPickupCooldowns: {}
   };
   ItemComponentArray.addComponent(itemEntity, itemComponent);

   if (throwingEntityID !== ID_SENTINEL_VALUE) {
      // Add a pickup cooldown so the item isn't picked up immediately
      itemComponent.entityPickupCooldowns[throwingEntityID] = 1
   }

   if (itemComponent.itemType === ItemType.flesh_sword) {
      addFleshSword(itemEntity);
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

export function onItemEntityRemove(itemEntity: Entity): void {
   // Remove flesh sword item entities
   const itemComponent = ItemComponentArray.getComponent(itemEntity);
   if (itemComponent.itemType === ItemType.flesh_sword) {
      removeFleshSword(itemEntity);
   }
   
   PhysicsComponentArray.removeComponent(itemEntity);
   ItemComponentArray.removeComponent(itemEntity);
}