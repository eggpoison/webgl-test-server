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

   public abstract getAttackDamage(): number;

   public use?(entity: Entity): void;

   public consumeItem(inventoryComponent: InventoryComponent, amount: number): void {
      for (const [itemSlot, item] of Object.entries(inventoryComponent.getInventory()) as unknown as ReadonlyArray<[number, Item]>) {
         if (item.id === this.id) {
            inventoryComponent.consumeItem(itemSlot, amount);
            break;
         }
      }
   }
}

export default Item;