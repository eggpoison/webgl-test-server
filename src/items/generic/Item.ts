import { ItemType, BaseItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import InventoryComponent from "../../entity-components/InventoryComponent";

let nextAvailableID = 0;
const getUniqueID = (): number => {
   return nextAvailableID++;
}

abstract class Item implements BaseItemInfo {
   /** Unique identifier for the item */
   public readonly id: number;

   public readonly type: ItemType;
   public count: number;

   constructor(itemType: ItemType, count: number, itemInfo: BaseItemInfo) {
      this.id = getUniqueID();

      this.type = itemType;
      this.count = count;
   }

   public tick?(): void;

   public use?(entity: Entity, inventoryName: string): void;

   public consumeItem(inventoryComponent: InventoryComponent, inventoryName: string, amount: number): void {
      const itemSlots = inventoryComponent.getInventory(inventoryName).itemSlots;
      
      for (const [itemSlot, item] of Object.entries(itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
         if (item.id === this.id) {
            inventoryComponent.consumeItem(inventoryName, itemSlot, amount);
            break;
         }
      }
   }
}

export default Item;