import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, TRIBE_INFO_RECORD, TribeType } from "webgl-test-shared";
import Entity from "../../Entity";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, PhysicsComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray, TribesmanComponentArray } from "../../components/ComponentArray";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, addItemToSlot, createNewInventory, pickupItemEntity } from "../../components/InventoryComponent";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { onTribeMemberHurt } from "./tribe-member";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";
import { TribesmanComponent } from "../../components/TribesmanComponent";
import Board from "../../Board";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { tickTribesman } from "./tribesman";
import { PhysicsComponent } from "../../components/PhysicsComponent";
import { TribeComponent } from "../../components/TribeComponent";

export const TRIBE_WORKER_RADIUS = 28;
const INVENTORY_SIZE = 3;
export const TRIBE_WORKER_VISION_RANGE = 300;

export function createTribeWorker(position: Point, tribe: Tribe, hutID: number): Entity {
   const worker = new Entity(position, IEntityType.tribeWorker, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(worker, 0.85, 0, 0, TRIBE_WORKER_RADIUS, 0);
   worker.addHitbox(hitbox);
   
   const tribeInfo = TRIBE_INFO_RECORD[tribe.type];
   PhysicsComponentArray.addComponent(worker, new PhysicsComponent(true));
   HealthComponentArray.addComponent(worker, new HealthComponent(tribeInfo.maxHealthWorker));
   StatusEffectComponentArray.addComponent(worker, new StatusEffectComponent(0));
   TribeComponentArray.addComponent(worker, new TribeComponent(tribe));
   TribeMemberComponentArray.addComponent(worker, new TribeMemberComponent(tribe.type));
   TribesmanComponentArray.addComponent(worker, new TribesmanComponent(hutID));
   AIHelperComponentArray.addComponent(worker, new AIHelperComponent(TRIBE_WORKER_VISION_RANGE));

   const inventoryUseComponent = new InventoryUseComponent();
   InventoryUseComponentArray.addComponent(worker, inventoryUseComponent);

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(worker, inventoryComponent);

   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", INVENTORY_SIZE, 1, true);
   inventoryUseComponent.addInventoryUseInfo(hotbarInventory);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "gloveSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);
   if (tribe.type === TribeType.barbarians) {
      const offhandInventory = createNewInventory(inventoryComponent, "offhand", 1, 1, false);
      inventoryUseComponent.addInventoryUseInfo(offhandInventory);
   }

   // If the tribesman is a frostling, spawn with a bow
   // @Temporary: Remove once tribe rework is done
   if (tribe.type === TribeType.frostlings) {
      addItemToSlot(inventoryComponent, "hotbar", 1, ItemType.wooden_bow, 1);
   }
   
   return worker;
}

export function tickTribeWorker(worker: Entity): void {
   tickTribesman(worker);
}

export function onTribeWorkerCollision(worker: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      pickupItemEntity(worker, collidingEntity);
   }
}

export function onTribeWorkerHurt(worker: Entity, attackingEntity: Entity): void {
   onTribeMemberHurt(worker, attackingEntity);
}

export function onTribeWorkerDeath(worker: Entity): void {
   // Attempt to respawn the tribesman when it is killed
   // Only respawn the tribesman if their hut is alive
   const tribesmanComponent = TribesmanComponentArray.getComponent(worker);
   if (!Board.entityRecord.hasOwnProperty(tribesmanComponent.hutID)) {
      return;
   }
   
   const hut = Board.entityRecord[tribesmanComponent.hutID];
   if (!hut.isRemoved) {
      const tribeComponent = TribeComponentArray.getComponent(worker);
      tribeComponent.tribe!.respawnTribesman(hut);
   }
}

export function onTribeWorkerRemove(worker: Entity): void {
   PhysicsComponentArray.removeComponent(worker);
   HealthComponentArray.removeComponent(worker);
   StatusEffectComponentArray.removeComponent(worker);
   TribeComponentArray.removeComponent(worker);
   TribeMemberComponentArray.removeComponent(worker);
   TribesmanComponentArray.removeComponent(worker);
   InventoryComponentArray.removeComponent(worker);
   InventoryUseComponentArray.removeComponent(worker);
   AIHelperComponentArray.removeComponent(worker);
}