import { AttackPacket, CRAFTING_RECIPES, IEntityType, ItemType, Point, SETTINGS, TRIBE_INFO_RECORD, TribeType, canCraftRecipe } from "webgl-test-shared";
import Entity from "../../GameObject";
import { attackEntity, calculateAttackTarget, calculateRadialAttackTargets, pickupItemEntity, tribeMemberCanPickUpItem, useItem } from "./tribe-member";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { InventoryComponent, addItemToSlot, consumeItem, consumeItemTypeFromInventory, createNewInventory, getInventory, getItem } from "../../components/InventoryComponent";
import { getItemStackSize, itemIsStackable } from "../../items/Item";
import Board from "../../Board";
import { addItemEntityPlayerPickupCooldown, createItemEntity, itemEntityCanBePickedUp } from "../../items/item-entity";
import { HealthComponent } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { SERVER } from "../../server";

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
   const player = new Entity(position, IEntityType.player);

   const hitbox = new CircularHitbox(player, 0, 0, 32);
   player.addHitbox(hitbox);

   const tribeInfo = TRIBE_INFO_RECORD[tribeType];
   HealthComponentArray.addComponent(player, new HealthComponent(tribeInfo.maxHealthPlayer));

   TribeComponentArray.addComponent(player, {
      tribeType: TribeType.plainspeople,
      tribe: tribe
   });

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(player, inventoryComponent);
   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
   createNewInventory(inventoryComponent, "craftingOutputSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "heldItemSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);

   InventoryUseComponentArray.addComponent(player, new InventoryUseComponent(hotbarInventory));

   return player;
}

export function tickPlayer(player: Entity): void {
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
   if (canCraftRecipe([hotbarInventory.itemSlots, backpackInventory.itemSlots], craftingRecipe)) {
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
      attackEntity(player, target, attackPacket.itemSlot);
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