import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, ItemType, Point, TRIBE_INFO_RECORD, TribeType } from "webgl-test-shared";
import Entity from "../../Entity";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, TribeComponentArray, TribeMemberComponentArray, TribesmanComponentArray } from "../../components/ComponentArray";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, addItemToSlot, createNewInventory, pickupItemEntity } from "../../components/InventoryComponent";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { onTribeMemberHurt } from "./tribe-member";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";
import { TribesmanComponent } from "../../components/TribesmanComponent";
import Board from "../../Board";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { tickTribesman } from "./tribesman";
import { PhysicsComponent, PhysicsComponentArray } from "../../components/PhysicsComponent";
import { TribeComponent } from "../../components/TribeComponent";

export const TRIBE_WARRIOR_RADIUS = 32;
const INVENTORY_SIZE = 3;
export const TRIBE_WARRIOR_VISION_RANGE = 560;

export function createTribeWarrior(position: Point, tribe: Tribe, hutID: number): Entity {
   const warrior = new Entity(position, IEntityType.tribeWarrior, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(warrior, 1.25, 0, 0, HitboxCollisionTypeConst.soft, TRIBE_WARRIOR_RADIUS);
   warrior.addHitbox(hitbox);
   
   const tribeInfo = TRIBE_INFO_RECORD[tribe.type];
   PhysicsComponentArray.addComponent(warrior, new PhysicsComponent(true, false));
   HealthComponentArray.addComponent(warrior, new HealthComponent(tribeInfo.maxHealthPlayer));
   StatusEffectComponentArray.addComponent(warrior, new StatusEffectComponent(0));
   TribeComponentArray.addComponent(warrior, new TribeComponent(tribe));
   TribeMemberComponentArray.addComponent(warrior, new TribeMemberComponent(tribe.type));
   TribesmanComponentArray.addComponent(warrior, new TribesmanComponent(hutID));
   AIHelperComponentArray.addComponent(warrior, new AIHelperComponent(TRIBE_WARRIOR_VISION_RANGE));

   const inventoryUseComponent = new InventoryUseComponent();
   InventoryUseComponentArray.addComponent(warrior, inventoryUseComponent);

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(warrior, inventoryComponent);

   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", INVENTORY_SIZE, 1, true);
   inventoryUseComponent.addInventoryUseInfo(hotbarInventory);
   const offhandInventory = createNewInventory(inventoryComponent, "offhand", 1, 1, false);
   inventoryUseComponent.addInventoryUseInfo(offhandInventory);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "gloveSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);

   // @Temporary
   // addItemToSlot(inventoryComponent, "hotbar", 1, ItemType.stone_battleaxe, 1);
   addItemToSlot(inventoryComponent, "hotbar", 1, ItemType.wooden_hammer, 1);

   // If the tribesman is a frostling, spawn with a bow
   // @Temporary: Remove once tribe rework is done
   if (tribe.type === TribeType.frostlings) {
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
   const tribesmanComponent = TribesmanComponentArray.getComponent(warrior.id);
   if (!Board.entityRecord.hasOwnProperty(tribesmanComponent.hutID)) {
      return;
   }
   
   const hut = Board.entityRecord[tribesmanComponent.hutID];
   const tribeComponent = TribeComponentArray.getComponent(warrior.id);
   tribeComponent.tribe.respawnTribesman(hut);
}

export function onTribeWarriorRemove(warrior: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(warrior.id);
   tribeComponent.tribe.registerTribeMemberDeath(warrior);

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