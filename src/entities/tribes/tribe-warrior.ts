import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, TRIBE_INFO_RECORD, TribeType } from "webgl-test-shared";
import Entity from "../../Entity";
import Tribe from "../../Tribe";
import { AIHelperComponentArray, HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, PhysicsComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray, TribesmanComponentArray } from "../../components/ComponentArray";
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
import { PhysicsComponent } from "../../components/PhysicsComponent";

export const TRIBE_WARRIOR_RADIUS = 32;
const INVENTORY_SIZE = 3;
export const TRIBE_WARRIOR_VISION_RANGE = 360;

export function createTribeWarrior(position: Point, tribeType: TribeType, tribe: Tribe, hutID: number): Entity {
   const warrior = new Entity(position, IEntityType.tribeWarrior, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(warrior, 1.25, 0, 0, TRIBE_WARRIOR_RADIUS, 0);
   warrior.addHitbox(hitbox);
   
   const tribeInfo = TRIBE_INFO_RECORD[tribeType];
   PhysicsComponentArray.addComponent(warrior, new PhysicsComponent(true));
   HealthComponentArray.addComponent(warrior, new HealthComponent(tribeInfo.maxHealthPlayer));
   StatusEffectComponentArray.addComponent(warrior, new StatusEffectComponent(0));
   TribeComponentArray.addComponent(warrior, {
      tribeType: tribeType,
      tribe: tribe
   });
   TribeMemberComponentArray.addComponent(warrior, new TribeMemberComponent(tribeType));
   TribesmanComponentArray.addComponent(warrior, new TribesmanComponent(hutID));
   AIHelperComponentArray.addComponent(warrior, new AIHelperComponent(TRIBE_WARRIOR_VISION_RANGE));

   const inventoryUseComponent = new InventoryUseComponent();
   InventoryUseComponentArray.addComponent(warrior, inventoryUseComponent);

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(warrior, inventoryComponent);

   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", INVENTORY_SIZE, 1, true);
   inventoryUseComponent.addInventoryUseInfo(hotbarInventory);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "gloveSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);
   if (tribe.tribeType === TribeType.barbarians) {
      const offhandInventory = createNewInventory(inventoryComponent, "offhand", 1, 1, false);
      inventoryUseComponent.addInventoryUseInfo(offhandInventory);
   }

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
   PhysicsComponentArray.removeComponent(warrior);
   HealthComponentArray.removeComponent(warrior);
   StatusEffectComponentArray.removeComponent(warrior);
   TribeComponentArray.removeComponent(warrior);
   TribeMemberComponentArray.removeComponent(warrior);
   TribesmanComponentArray.removeComponent(warrior);
   InventoryComponentArray.removeComponent(warrior);
   InventoryUseComponentArray.removeComponent(warrior);
   AIHelperComponentArray.removeComponent(warrior);
}