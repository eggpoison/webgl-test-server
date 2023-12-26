import { ItemType, BaseItemInfo, ITEM_INFO_RECORD, StackableItemInfo } from "webgl-test-shared";

let nextAvailableID = 0;
const getUniqueID = (): number => {
   return nextAvailableID++;
}

class Item implements BaseItemInfo {
   /** Unique identifier for the item */
   public readonly id: number;

   public readonly type: ItemType;
   public count: number;

   constructor(itemType: ItemType, count: number) {
      this.id = getUniqueID();

      this.type = itemType;
      this.count = count;
   }
}

export default Item;

/**
 * Checks whether a given item type is able to be stacked.
 * @param itemType The type of item to check.
 * @returns Whether the item type is able to be stacked.
 */
export function itemIsStackable(itemType: ItemType): boolean {
   return ITEM_INFO_RECORD[itemType].hasOwnProperty("stackSize");
}

export function getItemStackSize(item: Item): number {
   return (ITEM_INFO_RECORD[item.type] as StackableItemInfo).stackSize;
}