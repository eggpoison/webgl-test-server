import { ITEM_INFO_RECORD, ItemType } from "webgl-test-shared";
import Item, { itemIsStackable } from "../items/generic/Item";
import StackableItem from "../items/generic/StackableItem";
import { createItem } from "../items/item-creation";
import DroppedItem from "../items/DroppedItem";
import Component from "./Component";
import { GameObject } from "../GameObject";

export type ItemSlots = { [itemSlot: number]: Item };

export interface Inventory {
   /** Width of the inventory in item slots */
   width: number;
   /** Height of the inventory in item slots */
   height: number;
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

   public onLoad(): void {
      this.entity.createEvent("enter_collision", (collidingGameObject: GameObject): void => {
         if (collidingGameObject.i === "droppedItem") {
            this.pickupDroppedItem(collidingGameObject);
         }
      });
   }

   /** Creates and stores a new inventory in the component. */
   public createNewInventory(name: string, width: number, height: number): void {
      if (this.inventories.hasOwnProperty(name)) throw new Error(`Tried to create an inventory when an inventory by the name of '${name}' already exists.`);
      
      const inventory: Inventory = {
         width: width,
         height: height,
         itemSlots: {}
      };

      this.inventories[name] = inventory;
      this.inventoryArray.push([name, inventory]);
   }

   public resizeInventory(name: string, width: number, height: number): void {
      if (!this.inventories.hasOwnProperty(name)) throw new Error(`Could not find an inventory by the name of '${name}'.`);

      this.inventories[name].width = width;
      this.inventories[name].height = height;
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

   /**
    * Attempts to pick up an item and add it to the inventory
    * @param droppedItem The item entit to attempt to pick up
    * @returns Whether the item was picked up or not
    */
   private pickupDroppedItem(droppedItem: DroppedItem): void {
      // Don't pick up dropped items which are on pickup cooldown
      if (!droppedItem.canBePickedUp(this.entity.id)) return;

      for (const [inventoryName, _inventory] of this.inventoryArray) {
         const amountPickedUp = this.addItemToInventory(inventoryName, droppedItem.item);

         droppedItem.item.count -= amountPickedUp;

         // When all of the item stack is picked up, don't attempt to add to any other inventories.
         if (droppedItem.item.count === 0) {
            break;
         }
      }

      // If all of the item was added, destroy it
      if (droppedItem.item.count === 0) {
         droppedItem.remove();
      }
   }

   /**
    * Adds as much of an item as possible to any/all available inventories.
    * @returns The number of items added.
    */
   public addItem(item: Item): number {
      let amountAdded = 0;

      for (const [inventoryName, _inventory] of this.inventoryArray) {
         amountAdded += this.addItemToInventory(inventoryName, item);

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
      
      for (let i = 1; i <= inventory.width * inventory.height; i++) {
         // If the slot is empty then add the rest of the item
         if (!inventory.itemSlots.hasOwnProperty(i)) {
            let addAmount: number;
            if (itemIsStackable) {
               addAmount = Math.min((item as StackableItem).stackSize, remainingAmountToAdd);
            } else {
               addAmount = 1;
            }

            inventory.itemSlots[i] = createItem(item.type, addAmount);

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
   public addItemToSlot(inventoryName: string, itemSlot: number, itemType: ItemType, amount: number): number {
      const inventory = this.getInventory(inventoryName);

      let amountAdded: number;

      if (inventory.itemSlots.hasOwnProperty(itemSlot)) {
         const item = this.getItem(inventoryName, itemSlot)!;

         if (item.type !== itemType) {
            // Items are of different types, so none can be added
            return 0;
         }

         if (itemIsStackable(itemType)) {
            // If the item is stackable, add as many as the stack size of the item would allow

            const stackSize = (ITEM_INFO_RECORD[itemType] as StackableItem).stackSize;
            
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

   public removeItemFromInventory(inventoryName: string, itemSlot: number): void {
      const inventory = this.getInventory(inventoryName);

      delete inventory.itemSlots[itemSlot];
   }
}

export default InventoryComponent;