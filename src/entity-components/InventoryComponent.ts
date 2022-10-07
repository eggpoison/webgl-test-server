import Item from "../items/Item";
import ItemEntity from "../items/ItemEntity";
import Component from "./Component";

type Inventory = { [itemSlot: number]: Item | null };

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
         inventory[i] = null;
      }
      return inventory;
   }

   /**
    * Attempts to pick up an item and add it to the inventory
    * @param item The item to attempt to pick up
    * @returns Whether the item was picked up or not
    */
   public pickupItemEntity(itemEntity: ItemEntity): void {
      const availableSlot = this.findFirstAvailableSlot();
      if (availableSlot === null) return;

      this.addItemToSlot(itemEntity.item, availableSlot);
      itemEntity.destroy();
   }

   private findFirstAvailableSlot(): number | null {
      for (let i = 1; i <= this.inventorySize; i++) {
         if (this.inventory[i] !== null) return i;
      }

      return null;
   }

   /** Adds an item to a slot. Overrides any item previously there */
   private addItemToSlot(item: Item, slotNum: number): void {
      this.inventory[slotNum] = item;
   }
}

export default InventoryComponent;