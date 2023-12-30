import { AttackPacket, BowItemInfo, COLLISION_BITS, CRAFTING_RECIPES, DEFAULT_COLLISION_MASK, FoodItemInfo, IEntityType, ITEM_INFO_RECORD, ItemRequirements, ItemType, Point, SETTINGS, SpearItemInfo, TRIBE_INFO_RECORD, TechID, TechInfo, TribeMemberAction, TribeType, getItemStackSize, getTechByID, hasEnoughItems, itemIsStackable } from "webgl-test-shared";
import Entity from "../../Entity";
import { attackEntity, calculateAttackTarget, calculateRadialAttackTargets, onTribeMemberHurt, pickupItemEntity, tickTribeMember, tribeMemberCanPickUpItem, useItem } from "./tribe-member";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, PlayerComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray } from "../../components/ComponentArray";
import { InventoryComponent, addItem, addItemToSlot, consumeItem, consumeItemTypeFromInventory, createNewInventory, dropInventory, getInventory, getItem } from "../../components/InventoryComponent";
import Board from "../../Board";
import { addItemEntityPlayerPickupCooldown, createItemEntity, itemEntityCanBePickedUp } from "../item-entity";
import { HealthComponent } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { SERVER } from "../../server";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";
import { PlayerComponent } from "../../components/PlayerComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { createItem } from "../../Item";

/** How far away from the entity the attack is done */
const ATTACK_OFFSET = 50;
/** Max distance from the attack position that the attack will be registered from */
const ATTACK_RADIUS = 50;

const ITEM_THROW_FORCE = 100;
const ITEM_THROW_OFFSET = 32;
const THROWN_ITEM_PICKUP_COOLDOWN = 1;

const VACUUM_RANGE = 85;
const VACUUM_STRENGTH = 25;

export function createPlayer(position: Point, tribeType: TribeType, tribe: Tribe | null): Entity {
   const player = new Entity(position, IEntityType.player, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(player, 0, 0, 32);
   player.addHitbox(hitbox);

   const tribeInfo = TRIBE_INFO_RECORD[tribeType];
   HealthComponentArray.addComponent(player, new HealthComponent(tribeInfo.maxHealthPlayer));
   StatusEffectComponentArray.addComponent(player, new StatusEffectComponent());

   TribeComponentArray.addComponent(player, {
      tribeType: TribeType.plainspeople,
      tribe: tribe
   });
   TribeMemberComponentArray.addComponent(player, new TribeMemberComponent(tribeType));
   PlayerComponentArray.addComponent(player, new PlayerComponent());

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(player, inventoryComponent);
   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
   createNewInventory(inventoryComponent, "craftingOutputSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "heldItemSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);

   // @Temporary
   addItem(inventoryComponent, createItem(ItemType.tribe_totem, 1));

   InventoryUseComponentArray.addComponent(player, new InventoryUseComponent(hotbarInventory));

   return player;
}

export function tickPlayer(player: Entity): void {
   tickTribeMember(player);
   
   // Vacuum nearby items to the player
   // @Incomplete: Don't vacuum items which the player doesn't have the inventory space for
   const minChunkX = Math.max(Math.floor((player.position.x - VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor((player.position.x + VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor((player.position.y - VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor((player.position.y + VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const itemEntity of chunk.entities) {
            if (itemEntity.type !== IEntityType.itemEntity || !itemEntityCanBePickedUp(itemEntity, player.id)) {
               continue;
            }

            const itemComponent = ItemComponentArray.getComponent(itemEntity);
            if (!tribeMemberCanPickUpItem(player, itemComponent.itemType)) {
               continue;
            }
            
            const distance = player.position.calculateDistanceBetween(itemEntity.position);
            if (distance <= VACUUM_RANGE) {
               const vacuumDirection = itemEntity.position.calculateAngleBetween(player.position);
               itemEntity.velocity.x += VACUUM_STRENGTH * Math.sin(vacuumDirection);
               itemEntity.velocity.y += VACUUM_STRENGTH * Math.cos(vacuumDirection);
            }
         }
      }
   }
}

export function onPlayerCollision(player: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      const wasPickedUp = pickupItemEntity(player, collidingEntity);
      if (wasPickedUp) {
         SERVER.registerPlayerDroppedItemPickup(player);
      }
   }
}

export function onPlayerHurt(player: Entity, collidingEntity: Entity): void {
   onTribeMemberHurt(player, collidingEntity);
}

export function onPlayerDeath(player: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   
   dropInventory(player, inventoryComponent, "hotbar", 38);
   dropInventory(player, inventoryComponent, "armourSlot", 38);
   dropInventory(player, inventoryComponent, "backpackSlot", 38);
}

export function onPlayerRemove(player: Entity): void {
   HealthComponentArray.removeComponent(player);
   StatusEffectComponentArray.removeComponent(player);
   TribeComponentArray.removeComponent(player);
   TribeMemberComponentArray.removeComponent(player);
   PlayerComponentArray.removeComponent(player);
   InventoryComponentArray.removeComponent(player);
}

export function processPlayerCraftingPacket(player: Entity, recipeIndex: number): void {
   if (recipeIndex < 0 || recipeIndex >= CRAFTING_RECIPES.length) {
      return;
   }
   
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const craftingRecipe = CRAFTING_RECIPES[recipeIndex];
   
   // Don't craft past items' stack size
   const craftingOutputInventory = getInventory(inventoryComponent, "craftingOutputSlot");
   if (craftingOutputInventory.itemSlots.hasOwnProperty(1)) {
      const craftingOutputItem = craftingOutputInventory.itemSlots[1];
      if ((craftingOutputItem.type !== craftingRecipe.product || !itemIsStackable(craftingOutputItem.type) || craftingOutputItem.count + craftingRecipe.yield > getItemStackSize(craftingOutputItem))) {
         return;
      }
   }
   
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   const backpackInventory = getInventory(inventoryComponent, "backpack");

   // @Speed: Garbage collection
   if (hasEnoughItems([hotbarInventory.itemSlots, backpackInventory.itemSlots], craftingRecipe.ingredients)) {
      // Consume ingredients
      for (const [ingredientType, ingredientCount] of Object.entries(craftingRecipe.ingredients).map(entry => [Number(entry[0]), entry[1]]) as ReadonlyArray<[ItemType, number]>) {
         // Prioritise consuming ingredients from the backpack inventory first
         const amountConsumedFromBackpackInventory = consumeItemTypeFromInventory(inventoryComponent, "backpack", ingredientType, ingredientCount);

         // Consume the rest from the hotbar
         const remainingAmountToConsume = ingredientCount - amountConsumedFromBackpackInventory;
         consumeItemTypeFromInventory(inventoryComponent, "hotbar", ingredientType, remainingAmountToConsume);
      }

      // Add product to held item
      addItemToSlot(inventoryComponent, "craftingOutputSlot", 1, craftingRecipe.product, craftingRecipe.yield);
   }
}

export function processItemPickupPacket(player: Entity, entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
   if (!Board.entityRecord.hasOwnProperty(entityID)) {
      return;
   }

   const inventoryComponent = InventoryComponentArray.getComponent(player);
   
   // Don't pick up the item if there is already a held item
   if (getInventory(inventoryComponent, "heldItemSlot").itemSlots.hasOwnProperty(1)) {
      return;
   }

   const targetInventoryComponent = InventoryComponentArray.getComponent(Board.entityRecord[entityID]);

   const pickedUpItem = getItem(targetInventoryComponent, inventoryName, itemSlot);
   if (pickedUpItem === null) return;

   // Hold the item
   addItemToSlot(inventoryComponent, "heldItemSlot", 1, pickedUpItem.type, amount);

   // Remove the item from its previous inventory
   consumeItem(targetInventoryComponent, inventoryName, itemSlot, amount);
}

export function processItemReleasePacket(player: Entity, entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
   if (!Board.entityRecord.hasOwnProperty(entityID)) {
      return;
   }

   const inventoryComponent = InventoryComponentArray.getComponent(player);

   // Don't release an item if there is no held item
   const heldItemInventory = getInventory(inventoryComponent, "heldItemSlot");
   if (!heldItemInventory.itemSlots.hasOwnProperty(1)) return;

   const targetInventoryComponent = InventoryComponentArray.getComponent(Board.entityRecord[entityID]);

   const heldItem = heldItemInventory.itemSlots[1];
   
   // Add the item to the inventory
   const amountAdded = addItemToSlot(targetInventoryComponent, inventoryName, itemSlot, heldItem.type, amount);

   // If all of the item was added, clear the held item
   consumeItemTypeFromInventory(inventoryComponent, "heldItemSlot", heldItem.type, amountAdded);
}

export function processItemUsePacket(player: Entity, itemSlot: number): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);

   const item = getItem(inventoryComponent, "hotbar", itemSlot);
   if (item !== null)  {
      useItem(player, item, itemSlot);
   }
}

export function processPlayerAttackPacket(player: Entity, attackPacket: AttackPacket): void {
   // Find the attack target
   const attackTargets = calculateRadialAttackTargets(player, ATTACK_OFFSET, ATTACK_RADIUS);
   const target = calculateAttackTarget(player, attackTargets);

   // Register the hit
   if (target !== null) {
      attackEntity(player, target, attackPacket.itemSlot, "hotbar");
   }
}

export function throwItem(player: Entity, inventoryName: string, itemSlot: number, dropAmount: number, throwDirection: number): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventory = getInventory(inventoryComponent, inventoryName);
   if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
      return;
   }
   
   const itemType = inventory.itemSlots[itemSlot].type;
   const amountRemoved = consumeItem(inventoryComponent, inventoryName, itemSlot, dropAmount);

   const dropPosition = player.position.copy();
   dropPosition.x += ITEM_THROW_OFFSET * Math.sin(throwDirection);
   dropPosition.y += ITEM_THROW_OFFSET * Math.cos(throwDirection);

   // Create the item entity
   const itemEntity = createItemEntity(dropPosition, itemType, amountRemoved);

   // Add a pickup cooldown so the item isn't picked up immediately
   addItemEntityPlayerPickupCooldown(itemEntity, player.id, THROWN_ITEM_PICKUP_COOLDOWN);

   // Throw the dropped item away from the player
   itemEntity.velocity.x += ITEM_THROW_FORCE * Math.sin(throwDirection);
   itemEntity.velocity.y += ITEM_THROW_FORCE * Math.cos(throwDirection);
}

export function startEating(player: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);
   
   // Reset the food timer so that the food isn't immediately eaten
   const foodItem = getItem(inventoryComponent, "hotbar", inventoryUseComponent.selectedItemSlot);
   if (foodItem !== null) {
      const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
      inventoryUseComponent.foodEatingTimer = itemInfo.eatTime;
   }
   
   inventoryUseComponent.currentAction = TribeMemberAction.eat;
}

export function startChargingBow(player: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);

   // Reset the cooldown so the bow doesn't fire immediately
   const bow = getItem(inventoryComponent, "hotbar", inventoryUseComponent.selectedItemSlot);
   if (bow !== null) {
      const itemInfo = ITEM_INFO_RECORD[bow.type] as BowItemInfo;
      inventoryUseComponent.bowCooldownTicks = itemInfo.shotCooldownTicks;
      inventoryUseComponent.lastBowChargeTicks = Board.ticks;
   }
   
   inventoryUseComponent.currentAction = TribeMemberAction.chargeBow;
}

export function startChargingSpear(player: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);

   // Reset the cooldown so the bow doesn't fire immediately
   const spear = getItem(inventoryComponent, "hotbar", inventoryUseComponent.selectedItemSlot);
   if (spear !== null) {
      inventoryUseComponent.lastSpearChargeTicks = Board.ticks;
   }
   
   inventoryUseComponent.currentAction = TribeMemberAction.chargeSpear;
}

const itemIsNeededInTech = (tech: TechInfo, itemProgress: ItemRequirements, itemType: ItemType): boolean => {
   // If the item isn't present in the item requirements then it isn't needed
   if (!tech.researchItemRequirements.hasOwnProperty(itemType)) {
      return false;
   }
   
   const amountNeeded = tech.researchItemRequirements[itemType]!;
   const amountCommitted = itemProgress.hasOwnProperty(itemType) ? itemProgress[itemType]! : 0;

   return amountCommitted < amountNeeded;
}

const hasMetTechItemRequirements = (tech: TechInfo, itemProgress: ItemRequirements): boolean => {
   for (const [itemType, itemAmount] of Object.entries(tech.researchItemRequirements)) {
      if (!itemProgress.hasOwnProperty(itemType)) {
         return false;
      }

      if (itemAmount !== itemProgress[itemType as unknown as ItemType]) {
         return false;
      }
   }

   return true;
}

export function processTechUnlock(player: Entity, techID: TechID): void {
   const tech = getTechByID(techID);
   
   const tribeComponent = TribeComponentArray.getComponent(player);
   if (tribeComponent.tribe === null) {
      console.warn("Cannot research a tech without a tribe.");
      return;
   }
   const inventoryComponent = InventoryComponentArray.getComponent(player);

   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   
   // Consume any available items
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      const itemProgress = tribeComponent.tribe.techUnlockProgress[techID] || {};
      if (itemIsNeededInTech(tech, itemProgress, item.type)) {
         const amountNeeded = tech.researchItemRequirements[item.type]!;
         const amountCommitted = itemProgress.hasOwnProperty(item.type) ? itemProgress[item.type]! : 0;

         const amountToAdd = Math.min(item.count, amountNeeded - amountCommitted);

         item.count -= amountToAdd;
         if (item.count === 0) {
            delete hotbarInventory.itemSlots[itemSlot];
         }

         if (tribeComponent.tribe.techUnlockProgress.hasOwnProperty(techID)) {
            tribeComponent.tribe.techUnlockProgress[techID]![item.type] = amountCommitted + amountToAdd;
         } else {
            tribeComponent.tribe.techUnlockProgress[techID] = {
               [item.type]: amountCommitted + amountToAdd
            };
         }
      }
   }

   if (hasMetTechItemRequirements(tech, tribeComponent.tribe.techUnlockProgress[techID] || {})) {
      tribeComponent.tribe.unlockTech(techID);
   }
}