import { ItemType, ItemInfo, ITEM_INFO_RECORD } from "webgl-test-shared";

let nextAvailableID = 0;
const getUniqueID = (): number => {
   return nextAvailableID++;
}

class Item {
   /** Unique identifier for the item */
   public readonly id: number;

   public readonly itemType: ItemType;
   public count: number;

   public readonly itemInfo: ItemInfo;

   constructor(itemType: ItemType, count: number) {
      this.id = getUniqueID();

      this.itemType = itemType;
      this.count = count;

      this.itemInfo = ITEM_INFO_RECORD[itemType];
   }
}

export default Item;