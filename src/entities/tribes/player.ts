import { AttackPacket, CRAFTING_RECIPES, ItemType, Point, TribeType, canCraftRecipe } from "webgl-test-shared";
import Entity, { IEntityType } from "../../GameObject";
import { attackEntity, calculateAttackTarget, calculateRadialAttackTargets, useItem } from "./tribe-member";
import Tribe from "../../Tribe";
import { InventoryComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { addItemToSlot, consumeItem, consumeItemTypeFromInventory, getInventory, getItem } from "../../components/InventoryComponent";
import Item, { getItemStackSize, itemIsStackable } from "../../items/Item";
import Board from "../../Board";
import { addItemEntityPlayerPickupCooldown, createItemEntity } from "../../items/item-entity";

/** How far away from the entity the attack is done */
const ATTACK_OFFSET = 50;
/** Max distance from the attack position that the attack will be registered from */
const ATTACK_RADIUS = 50;

const ITEM_THROW_FORCE = 100;
const ITEM_THROW_OFFSET = 32;
const THROWN_ITEM_PICKUP_COOLDOWN = 1;

export function createPlayer(position: Point, tribe: Tribe | null): Entity {
   const player = new Entity(position, IEntityType.player);
   TribeComponentArray.addComponent(player, {
      tribeType: TribeType.plainspeople,
      tribe: tribe
   });
   return player;
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
   if (!Board.entities.hasOwnProperty(entityID)) {
      return;
   }

   const inventoryComponent = InventoryComponentArray.getComponent(player);
   
   // Don't pick up the item if there is already a held item
   if (getInventory(inventoryComponent, "heldItemSlot").itemSlots.hasOwnProperty(1)) {
      return;
   }

   const targetInventoryComponent = InventoryComponentArray.getComponent(Board.entities[entityID]);

   const pickedUpItem = getItem(targetInventoryComponent, inventoryName, itemSlot);
   if (pickedUpItem === null) return;

   // Hold the item
   addItemToSlot(inventoryComponent, "heldItemSlot", 1, pickedUpItem.type, amount);

   // Remove the item from its previous inventory
   consumeItem(targetInventoryComponent, inventoryName, itemSlot, amount);
}

export function processItemReleasePacket(player: Entity, entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
   if (!Board.entities.hasOwnProperty(entityID)) {
      return;
   }

   const inventoryComponent = InventoryComponentArray.getComponent(player);

   // Don't release an item if there is no held item
   const heldItemInventory = getInventory(inventoryComponent, "heldItemSlot");
   if (!heldItemInventory.itemSlots.hasOwnProperty(1)) return;

   const targetInventoryComponent = InventoryComponentArray.getComponent(Board.entities[entityID]);

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