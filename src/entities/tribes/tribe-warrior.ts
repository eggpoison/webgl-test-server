import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, TRIBE_INFO_RECORD, TribeType } from "webgl-test-shared";
import Entity from "../../Entity";
import Tribe from "../../Tribe";
import { AIHelperComponentArray, HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray, TribesmanComponentArray } from "../../components/ComponentArray";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, addItemToSlot, createNewInventory, pickupItemEntity } from "../../components/InventoryComponent";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { onTribeMemberHurt } from "./tribe-member";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";
import { TribesmanComponent } from "../../components/TribesmanComponent";
import Board from "../../Board";
import { AIHelperComponent } from "../../components/AIHelperComponent";
import { tickTribesman } from "./tribesman";

export const TRIBE_WARRIOR_RADIUS = 32;
const INVENTORY_SIZE = 3;
export const TRIBE_WARRIOR_VISION_RANGE = 360;

export function createTribeWarrior(position: Point, tribeType: TribeType, tribe: Tribe, hutID: number): Entity {
   const warrior = new Entity(position, IEntityType.tribeWarrior, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(warrior, 0, 0, TRIBE_WARRIOR_RADIUS);
   warrior.addHitbox(hitbox);
   
   const tribeInfo = TRIBE_INFO_RECORD[tribeType];
   HealthComponentArray.addComponent(warrior, new HealthComponent(tribeInfo.maxHealthPlayer));
   StatusEffectComponentArray.addComponent(warrior, new StatusEffectComponent());

   TribeComponentArray.addComponent(warrior, {
      tribeType: tribeType,
      tribe: tribe
   });
   TribeMemberComponentArray.addComponent(warrior, new TribeMemberComponent(tribeType));
   TribesmanComponentArray.addComponent(warrior, new TribesmanComponent(hutID));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(warrior, inventoryComponent);
   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", INVENTORY_SIZE, 1, true);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);

   InventoryUseComponentArray.addComponent(warrior, new InventoryUseComponent(hotbarInventory));
   AIHelperComponentArray.addComponent(warrior, new AIHelperComponent(TRIBE_WARRIOR_VISION_RANGE));

   // If the tribesman is a frostling, spawn with a bow
   // @Temporary: Remove once tribe rework is done
   if (tribeType === TribeType.frostlings) {
      addItemToSlot(inventoryComponent, "hotbar", 1, ItemType.wooden_bow, 1);
   }
   
   return warrior;
}

export function tickTribeWarrior(warrior: Entity): void {
   tickTribesman(warrior);
}

export function onTribeWarriorCollision(warrior: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      pickupItemEntity(warrior, collidingEntity);
   }
}

export function onTribeWarriorHurt(warrior: Entity, attackingEntity: Entity): void {
   onTribeMemberHurt(warrior, attackingEntity);
}

export function onTribeWarriorDeath(warrior: Entity): void {
   // Attempt to respawn the tribesman when it is killed
   // Only respawn the tribesman if their hut is alive
   const tribesmanComponent = TribesmanComponentArray.getComponent(warrior);
   if (!Board.entityRecord.hasOwnProperty(tribesmanComponent.hutID)) {
      return;
   }
   
   const hut = Board.entityRecord[tribesmanComponent.hutID];
   if (!hut.isRemoved) {
      const tribeComponent = TribeComponentArray.getComponent(warrior);
      tribeComponent.tribe!.respawnTribesman(hut);
   }
}

export function onTribeWarriorRemove(warrior: Entity): void {
   HealthComponentArray.removeComponent(warrior);
   StatusEffectComponentArray.removeComponent(warrior);
   TribeComponentArray.removeComponent(warrior);
   TribeMemberComponentArray.removeComponent(warrior);
   TribesmanComponentArray.removeComponent(warrior);
   InventoryComponentArray.removeComponent(warrior);
   InventoryUseComponentArray.removeComponent(warrior);
   AIHelperComponentArray.removeComponent(warrior);
}