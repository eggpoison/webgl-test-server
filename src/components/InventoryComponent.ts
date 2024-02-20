import { ITEM_INFO_RECORD, InventoryData, Item, ItemData, ItemSlotsData, ItemType, StackableItemInfo, itemIsStackable } from "webgl-test-shared";
import Entity from "../Entity";
import { createItemEntity, itemEntityCanBePickedUp } from "../entities/item-entity";
import { InventoryComponentArray, ItemComponentArray } from "./ComponentArray";
import { createItem } from "../Item";

export type ItemSlots = { [itemSlot: number]: Item };

export interface Inventory {
   /** Width of the inventory in item slots */
   width: number;
   /** Height of the inventory in item slots */
   height: number;
   /** The items contained by the inventory. */
   readonly itemSlots: ItemSlots;
   /** Whether the inventory allows dropped items to be put into it */
   readonly acceptsPickedUpItems: boolean;
   readonly name: string;
}

export function serialiseItem(item: Item): ItemData {
   return {
      type: item.type,
      count: item.count,
      id: item.id
   };
}

export function serializeInventoryData(inventory: Inventory): InventoryData {
   const itemSlots: ItemSlotsData = {};
   for (const [itemSlot, item] of Object.entries(inventory.itemSlots)) {
      itemSlots[Number(itemSlot)] = serialiseItem(item);
   }
   
   const inventoryData: InventoryData = {
      width: inventory.width,
      height: inventory.height,
      itemSlots: itemSlots,
      inventoryName: inventory.name
   };
   
   return inventoryData;
}

export class InventoryComponent {
   /** Stores a record of all inventories associated with the inventory component. */
   public readonly inventories: Record<string, Inventory> = {};
   /**
    * Stores all inventories associated with the inventory component in the order of when they were added.
    * Note: the order the inventories were added affects which inventory picked up items are added to.
    */
   public readonly inventoryArray = new Array<[name: string, inventory: Inventory]>();
}

/** Creates and stores a new inventory in the component. */
export function createNewInventory(inventoryComponent: InventoryComponent, name: string, width: number, height: number, acceptsPickedUpItems: boolean): Inventory {
   if (inventoryComponent.inventories.hasOwnProperty(name)) throw new Error(`Tried to create an inventory when an inventory by the name of '${name}' already exists.`);
   
   const inventory: Inventory = {
      width: width,
      height: height,
      itemSlots: {},
      acceptsPickedUpItems: acceptsPickedUpItems,
      name: name
   };

   inventoryComponent.inventories[name] = inventory;
   inventoryComponent.inventoryArray.push([name, inventory]);

   return inventory;
}

export function resizeInventory(inventoryComponent: InventoryComponent, name: string, width: number, height: number): void {
   if (!inventoryComponent.inventories.hasOwnProperty(name)) throw new Error(`Could not find an inventory by the name of '${name}'.`);

   inventoryComponent.inventories[name].width = width;
   inventoryComponent.inventories[name].height = height;
}

export function getInventory(inventoryComponent: InventoryComponent, name: string): Inventory {
   if (!inventoryComponent.inventories.hasOwnProperty(name)) {
      throw new Error(`Could not find an inventory by the name of '${name}'.`);
   }
   
   return inventoryComponent.inventories[name];
}

export function getItemFromInventory(inventory: Inventory, itemSlot: number): Item | null {
   return inventory.itemSlots[itemSlot];
}

export function inventoryHasItemInSlot(inventory: Inventory, itemSlot: number): boolean {
   return inventory.itemSlots.hasOwnProperty(itemSlot);
}

export function getItem(inventoryComponent: InventoryComponent, inventoryName: string, itemSlot: number): Item | null {
   const inventory = getInventory(inventoryComponent, inventoryName);
   if (inventoryHasItemInSlot(inventory, itemSlot)) {
      return getItemFromInventory(inventory, itemSlot);
   }
   return null;
}

export function setItem(inventoryComponent: InventoryComponent, inventoryName: string, itemSlot: number, item: Item | null): void {
   const inventory = getInventory(inventoryComponent, inventoryName);

   if (item !== null) {
      inventory.itemSlots[itemSlot] = item;
   } else {
      delete inventory.itemSlots[itemSlot];
   }
}

/**
 * Attempts to pick up an item and add it to the inventory
 * @param itemEntity The dropped item to attempt to pick up
 * @returns Whether some non-zero amount of the item was picked up or not
 */
export function pickupItemEntity(entity: Entity, itemEntity: Entity): boolean {
   // Don't pick up dropped items which are on pickup cooldown
   if (!itemEntityCanBePickedUp(itemEntity, entity.id)) return false;
   
   const inventoryComponent = InventoryComponentArray.getComponent(entity);
   const itemComponent = ItemComponentArray.getComponent(itemEntity);

   for (const [inventoryName, inventory] of inventoryComponent.inventoryArray) {
      if (!inventory.acceptsPickedUpItems) {
         continue;
      }

      
      const amountPickedUp = addItemToInventory(inventoryComponent, inventoryName, itemComponent.itemType, itemComponent.amount);
      itemComponent.amount -= amountPickedUp;

      // When all of the item stack is picked up, don't attempt to add to any other inventories.
      if (itemComponent.amount === 0) {
         break;
      }
   }

   // If all of the item was added, destroy it
   if (itemComponent.amount === 0) {
      itemEntity.remove();
      return true;
   }

   return false;
}

/**
 * Adds as much of an item as possible to any/all available inventories.
 * @returns The number of items added.
 */
export function addItem(inventoryComponent: InventoryComponent, item: Item): number {
   let amountAdded = 0;

   for (const [inventoryName, _inventory] of inventoryComponent.inventoryArray) {
      if (!_inventory.acceptsPickedUpItems) {
         continue;
      }
      
      amountAdded += addItemToInventory(inventoryComponent, inventoryName, item.type, item.count);

      if (amountAdded === item.count) {
         break;
      }
   }

   return amountAdded;
}

/**
 * Adds as much of an item as possible to a specific inventory.
 * @returns The number of items added to the inventory
 */
export function addItemToInventory(inventoryComponent: InventoryComponent, inventoryName: string, itemType: ItemType, itemAmount: number): number {
   let remainingAmountToAdd = itemAmount;
   let amountAdded = 0;

   const isStackable = itemIsStackable(itemType);
   const inventory = getInventory(inventoryComponent, inventoryName);

   if (isStackable) {
      const stackSize = (ITEM_INFO_RECORD[itemType] as StackableItemInfo).stackSize;
      
      // If there is already an item of the same type in the inventory, add it there
      for (const [itemSlot, currentItem] of Object.entries(inventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
         // If the item is of the same type, add it
         if (currentItem.type === itemType) {
            const maxAddAmount = Math.min(stackSize - currentItem.count, remainingAmountToAdd);
            inventory.itemSlots[itemSlot].count += maxAddAmount;
            remainingAmountToAdd -= maxAddAmount;
            amountAdded += maxAddAmount;

            if (remainingAmountToAdd === 0) return amountAdded;
         }
      }
   }
   
   for (let i = 1; i <= inventory.width * inventory.height; i++) {
      // If the slot is empty then add the rest of the item
      if (!inventory.itemSlots.hasOwnProperty(i)) {
         let addAmount: number;
         if (isStackable) {
            const stackSize = (ITEM_INFO_RECORD[itemType] as StackableItemInfo).stackSize;
            addAmount = Math.min(stackSize, remainingAmountToAdd);
         } else {
            addAmount = 1;
         }

         inventory.itemSlots[i] = createItem(itemType, addAmount);

         amountAdded += addAmount;
         remainingAmountToAdd -= addAmount;
         if (remainingAmountToAdd === 0) {
            break;
         }
      }
   }

   return amountAdded;
}

/**
 * Attempts to add a certain amount of an item to a specific item slot in an inventory.
 * @param inventoryName The name of the inventory to add the item to.
 * @param itemType The type of the item.
 * @param amount The amount of item to attempt to add.
 * @returns The number of items added to the item slot.
 */
export function addItemToSlot(inventoryComponent: InventoryComponent, inventoryName: string, itemSlot: number, itemType: ItemType, amount: number): number {
   const inventory = getInventory(inventoryComponent, inventoryName);
   
   if (itemSlot < 1 || itemSlot > inventory.width * inventory.height) {
      console.warn("Added item to out-of-bounds slot!");
   }

   let amountAdded: number;

   if (inventory.itemSlots.hasOwnProperty(itemSlot)) {
      const item = getItem(inventoryComponent, inventoryName, itemSlot)!;

      if (item.type !== itemType) {
         // Items are of different types, so none can be added
         return 0;
      }

      // If the item is stackable, add as many as the stack size of the item would allow
      if (itemIsStackable(itemType)) {
         const stackSize = (ITEM_INFO_RECORD[itemType] as StackableItemInfo).stackSize;
         
         amountAdded = Math.min(amount, stackSize - item.count);
         item.count += amountAdded;
      } else {
         // Unstackable items cannot be stacked (crazy right), so no more can be added
         return 0;
      }
   } else {
      amountAdded = amount;
      inventory.itemSlots[itemSlot] = createItem(itemType, amount);
   }

   return amountAdded;
}

/**
 * Attempts to consume a certain amount of an item type from an inventory.
 * @returns The number of items consumed from the inventory.
*/
export function consumeItemTypeFromInventory(inventoryComponent: InventoryComponent, inventoryName: string, itemType: ItemType, amount: number): number {
   const inventory = getInventory(inventoryComponent, inventoryName);
   
   let remainingAmountToConsume = amount;
   let totalAmountConsumed = 0;
   for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
      if (!inventory.itemSlots.hasOwnProperty(itemSlot)) continue;

      const item = inventory.itemSlots[itemSlot];
      if (item.type !== itemType) continue;

      const amountConsumed = Math.min(remainingAmountToConsume, item.count);

      item.count -= amountConsumed;
      remainingAmountToConsume -= amountConsumed;
      totalAmountConsumed += amountConsumed;

      if (item.count === 0) {
         delete inventory.itemSlots[itemSlot];
      }
   }

   return totalAmountConsumed;
}

/**
 * @returns The amount of items consumed
 */
export function consumeItem(inventoryComponent: InventoryComponent, inventoryName: string, itemSlot: number, amount: number): number {
   const inventory = getInventory(inventoryComponent, inventoryName);
   
   const item = inventory.itemSlots[itemSlot];
   if (typeof item === "undefined") return 0;

   item.count -= amount;

   // If all items have been removed, delete that item
   if (item.count <= 0) {
      delete inventory.itemSlots[itemSlot];
      // As the item count is 0 or negative, we add instead of subtract
      return amount + item.count;
   }

   // If there are still items remaining, then the full amount has been consumed
   return amount;
}

export function removeItemFromInventory(inventoryComponent: InventoryComponent, inventoryName: string, itemSlot: number): void {
   const inventory = getInventory(inventoryComponent, inventoryName);

   delete inventory.itemSlots[itemSlot];
}

/**
 * @returns True if the inventory has no item slots available, false if there is at least one
 */
export function inventoryIsFull(inventoryComponent: InventoryComponent, inventoryName: string): boolean {
   const inventory = getInventory(inventoryComponent, inventoryName);

   for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
      if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
         return false;
      }
   }

   return true;
}

export function dropInventory(entity: Entity, inventoryComponent: InventoryComponent, inventoryName: string, dropRange: number): void {
   const inventory = getInventory(inventoryComponent, inventoryName);
   for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
      if (inventory.itemSlots.hasOwnProperty(itemSlot)) {
         const position = entity.position.copy();

         const spawnOffsetMagnitude = dropRange * Math.random();
         const spawnOffsetDirection = 2 * Math.PI * Math.random();
         position.x += spawnOffsetMagnitude * Math.sin(spawnOffsetDirection);
         position.y += spawnOffsetMagnitude * Math.cos(spawnOffsetDirection);
         
         const item = inventory.itemSlots[itemSlot];
         createItemEntity(position, item.type, item.count);
      }
   }
}

export function findInventoryContainingItem(inventoryComponent: InventoryComponent, item: Item): Inventory | null {
   for (const [_inventoryName, inventory] of inventoryComponent.inventoryArray) {
      for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
         if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
            continue;
         }

         const currentItem = inventory.itemSlots[itemSlot];
         if (currentItem === item) {
            return inventory;
         }
      }
   }

   return null;
}

/** Returns 0 if there are no occupied slots. */
export function getFirstOccupiedItemSlotInInventory(inventory: Inventory): number {
   for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
      if (inventory.itemSlots.hasOwnProperty(itemSlot)) {
         return itemSlot;
      }
   }
   
   return 0;
}