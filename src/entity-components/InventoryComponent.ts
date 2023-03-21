import { ItemType } from "webgl-test-shared";
import Player from "../entities/Player";
import Item from "../items/generic/Item";
import StackableItem from "../items/generic/StackableItem";
import { createItem } from "../items/item-creation";
import ItemEntity from "../items/ItemEntity";
import Component from "./Component";

type Inventory = { [itemSlot: number]: Item };

class InventoryComponent extends Component {
   private readonly inventorySize: number;
   /** Inventory. Index begins at 1 */
   private readonly inventory: Inventory = this.createInventory();

   constructor(inventorySize: number) {
      super();

      this.inventorySize = inventorySize;
   }

   private createInventory(): Inventory {
      const inventory: Inventory = {};
      for (let i = 1; i <= this.inventorySize; i++) {
         delete inventory[i];
      }
      return inventory;
   }

   public tick(): void {
      const nearbyItemEntities = this.getNearbyItemEntities();
      const collidingItemEntities = this.getCollidingItemEntities(nearbyItemEntities);

      // Attempt to pick up all colliding item entities
      for (const itemEntity of collidingItemEntities) {
         this.pickupItemEntity(itemEntity);
      }
   }

   public getInventory(): Inventory {
      return this.inventory;
   }

   public getItem(itemSlot: number): Item | null {
      if (this.inventory.hasOwnProperty(itemSlot)) {
         return this.inventory[itemSlot];
      } else {
         return null;
      }
   }

   public setItem(itemSlot: number, item: Item | null): void {
      if (item !== null) {
         this.inventory[itemSlot] = item;
      } else {
         delete this.inventory[itemSlot];
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

      const amountAdded = this.addItem(itemEntity.item);

      this.entity.callEvents("item_pickup", itemEntity);
      
      // If all of the item was added, destroy the item entity
      if (amountAdded === itemEntity.item.count) {
         itemEntity.destroy();
      } else {
         // Otherwise subtract the amount of items added from the item entity
         itemEntity.item.count -= amountAdded;
      }
   }

   /**
    * Adds an item to the inventory
    * @returns The number of items added to the inventory
    */
   public addItem(item: Item): number {
      let remainingAmountToAdd = item.count;
      let amountAdded = 0;

      const itemIsStackable = item.hasOwnProperty("stackSize");

      if (itemIsStackable) {
         // If there is already an item of the same type in the inventory, add it there
         for (const [itemSlot, currentItem] of Object.entries(this.inventory) as unknown as ReadonlyArray<[number, Item]>) {
               // If the item is of the same type, add it
            if (currentItem.type === item.type) {
               const maxAddAmount = Math.min((item as StackableItem).stackSize - currentItem.count, remainingAmountToAdd);
               this.inventory[itemSlot].count += maxAddAmount;
               remainingAmountToAdd -= maxAddAmount;
               amountAdded += maxAddAmount;

               if (remainingAmountToAdd === 0) return amountAdded;
            }
         }
      }
      
      for (let i = 1; i <= this.inventorySize; i++) {
         // If the slot is empty then add the rest of the item
         if (!this.inventory.hasOwnProperty(i)) {
            this.inventory[i] = createItem(item.type, remainingAmountToAdd);
            amountAdded = item.count;
            break;
         }

         // If the slot contains an item of the same type, add as much of the item as possible
         if (this.inventory[i].type === item.type) {
            if (!itemIsStackable) {
               // If the item can't be stacked then nothing can be added to the slot
               continue;
            } else {
               const maxAddAmount = Math.min((item as StackableItem).stackSize - item.count, remainingAmountToAdd);
               this.inventory[i].count += maxAddAmount;
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

   public consumeItemType(itemType: ItemType, amount: number): void {
      let remainingAmountToConsume = amount;
      for (const [itemSlot, item] of Object.entries(this.inventory) as unknown as ReadonlyArray<[number, Item]>) {
         if (item.type !== itemType) continue;

         const amountConsumed = Math.min(remainingAmountToConsume, item.count);
         item.count -= amountConsumed;
         remainingAmountToConsume -= amountConsumed;
         if (item.count === 0) {
            delete this.inventory[itemSlot];
         }
      }
   }

   public consumeItem(itemSlot: number, amount: number): void {
      const item = this.inventory[itemSlot];
      if (typeof item === "undefined") return;

      item.count -= amount;
      if (item.count <= 0) {
         delete this.inventory[itemSlot];
      }
   }
}

export default InventoryComponent;