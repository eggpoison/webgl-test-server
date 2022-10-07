import { ItemID, ItemInfo, ITEM_INFO_RECORD } from "webgl-test-shared";

class Item {
   public readonly itemID: ItemID;
   public count: number;

   public readonly itemInfo: ItemInfo;

   constructor(itemID: ItemID, count: number) {
      this.itemID = itemID;
      this.count = count;

      this.itemInfo = ITEM_INFO_RECORD[itemID];
   }
}

export default Item;