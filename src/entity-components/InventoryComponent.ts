import { ItemType } from "webgl-test-shared";
import Player from "../entities/Player";
import Item from "../items/generic/Item";
import StackableItem from "../items/generic/StackableItem";
import { createItem } from "../items/item-creation";
import ItemEntity from "../items/ItemEntity";
import Component from "./Component";

export type ItemSlots = { [itemSlot: number]: Item };

export interface Inventory {
   /** Number of item slots the inventory contains. */
   size: number;
   /** The items contained by the inventory. */
   readonly itemSlots: ItemSlots;
}

class InventoryComponent extends Component {
   /**
    * Stores a record of all inventories associated with the inventory component.
    */
   private readonly inventories: Record<string, Inventory> = {};

   /**
    * Stores all inventories associated with the inventory component in the order of when they were added.
    * Note: the order the inventories were added affects which inventory picked up items are added to.
    */
   private readonly inventoryArray = new Array<[name: string, inventory: Inventory]>();

   /** Creates and stores a new inventory in the component. */
   public createNewInventory(name: string, inventorySize: number): void {
      if (this.inventories.hasOwnProperty(name)) throw new Error(`Tried to create an inventory when an inventory by the name of '${name}' already exists.`);
      
      const inventory: Inventory = {
         size: inventorySize,
         itemSlots: {}
      };

      this.inventories[name] = inventory;
      this.inventoryArray.push([name, inventory]);
   }

   public resizeInventory(name: string, newSize: number): void {
      if (!this.inventories.hasOwnProperty(name)) throw new Error(`Could not find an inventory by the name of '${name}'.`);

      this.inventories[name].size = newSize;
   }

   public tick(): void {
      const nearbyItemEntities = this.getNearbyItemEntities();
      const collidingItemEntities = this.getCollidingItemEntities(nearbyItemEntities);

      // Attempt to pick up all colliding item entities
      for (const itemEntity of collidingItemEntities) {
         this.pickupItemEntity(itemEntity);
      }
   }

   public getInventory(name: string): Inventory {
      if (!this.inventories.hasOwnProperty(name)) throw new Error(`Could not find an inventory by the name of '${name}'.`);
      
      return this.inventories[name];
   }

   public getItem(inventoryName: string, itemSlot: number): Item | null {
      const inventory = this.getInventory(inventoryName);
      
      if (inventory.itemSlots.hasOwnProperty(itemSlot)) {
         return inventory.itemSlots[itemSlot];
      } else {
         return null;
      }
   }

   public setItem(inventoryName: string, itemSlot: number, item: Item | null): void {
      const inventory = this.getInventory(inventoryName);

      if (item !== null) {
         inventory.itemSlots[itemSlot] = item;
      } else {
         delete inventory.itemSlots[itemSlot];
      }
   }

   private getNearbyItemEntities(): Set<ItemEntity> {
      const nearbyItemEntities = new Set<ItemEntity>();
      for (const chunk of this.entity.chunks) {
         for (const itemEntity of chunk.getItemEntities()) {
            if (!nearbyItemEntities.has(itemEntity)) {
               nearbyItemEntities.add(itemEntity);
            }
         }
      }
      return nearbyItemEntities;

   }

   private getCollidingItemEntities(nearbyItemEntities: Set<ItemEntity>): Set<ItemEntity> {
      const collidingItemEntities = new Set<ItemEntity>();

      itemLoop: for (const itemEntity of nearbyItemEntities) {
         for (const hitbox of this.entity.hitboxes) {
            if (hitbox.isColliding(itemEntity.hitbox)) {
               collidingItemEntities.add(itemEntity);
               continue itemLoop;
            }
         }
      }

      return collidingItemEntities;
   }

   /**
    * Attempts to pick up an item and add it to the inventory
    * @param itemEntity The item entit to attempt to pick up
    * @returns Whether the item was picked up or not
    */
   private pickupItemEntity(itemEntity: ItemEntity): void {
      // Don't pick up item entities which are on pickup cooldown
      if (!itemEntity.playerCanPickup(this.entity as Player)) return;

      let totalAmountPickedUp = 0;
      for (const [inventoryName, _inventory] of this.inventoryArray) {
         const amountPickedUp = this.addItemToInventory(inventoryName, itemEntity.item);

         totalAmountPickedUp += amountPickedUp
         itemEntity.item.count -= amountPickedUp;

         // When all of the item stack is picked up, don't attempt to add to any other inventories.
         if (itemEntity.item.count === 0) {
            break;
         }
      }

      this.entity.callEvents("item_pickup", itemEntity);
      
      // If all of the item was added, destroy the item entity
      if (totalAmountPickedUp === itemEntity.item.count) {
         itemEntity.destroy();
      }
   }

   /**
    * Adds as much of an item as possible to a specific inventory.
    * @returns The number of items added to the inventory
    */
   public addItemToInventory(inventoryName: string, item: Item): number {
      let remainingAmountToAdd = item.count;
      let amountAdded = 0;

      const itemIsStackable = item.hasOwnProperty("stackSize");

      const inventory = this.getInventory(inventoryName);

      if (itemIsStackable) {
         // If there is already an item of the same type in the inventory, add it there
         for (const [itemSlot, currentItem] of Object.entries(inventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
               // If the item is of the same type, add it
            if (currentItem.type === item.type) {
               const maxAddAmount = Math.min((item as StackableItem).stackSize - currentItem.count, remainingAmountToAdd);
               inventory.itemSlots[itemSlot].count += maxAddAmount;
               remainingAmountToAdd -= maxAddAmount;
               amountAdded += maxAddAmount;

               if (remainingAmountToAdd === 0) return amountAdded;
            }
         }
      }
      
      for (let i = 1; i <= inventory.size; i++) {
         // If the slot is empty then add the rest of the item
         if (!inventory.itemSlots.hasOwnProperty(i)) {
            inventory.itemSlots[i] = createItem(item.type, remainingAmountToAdd);
            amountAdded = item.count;
            break;
         }

         // If the slot contains an item of the same type, add as much of the item as possible
         if (inventory.itemSlots[i].type === item.type) {
            if (!itemIsStackable) {
               // If the item can't be stacked then nothing can be added to the slot
               continue;
            } else {
               const maxAddAmount = Math.min((item as StackableItem).stackSize - item.count, remainingAmountToAdd);
               inventory.itemSlots[i].count += maxAddAmount;
               amountAdded += maxAddAmount;
               remainingAmountToAdd -= maxAddAmount;

               // If there is none of the item left to add, exit
               if (remainingAmountToAdd === 0) {
                  return amountAdded;
               }
            }
         }
      }

      return amountAdded;
   }

   /**
    * Attempts to consume a certain amount of an item type from an inventory.
    * @returns The number of items consumed from the inventory.
   */
   public consumeItemTypeFromInventory(inventoryName: string, itemType: ItemType, amount: number): number {
      const inventory = this.getInventory(inventoryName);
      
      let remainingAmountToConsume = amount;
      let totalAmountConsumed = 0;
      for (const [itemSlot, item] of Object.entries(inventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
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

   public consumeItem(inventoryName: string, itemSlot: number, amount: number): void {
      const inventory = this.getInventory(inventoryName);
      
      const item = inventory.itemSlots[itemSlot];
      if (typeof item === "undefined") return;

      item.count -= amount;
      if (item.count <= 0) {
         delete inventory.itemSlots[itemSlot];
      }
   }
}

export default InventoryComponent;