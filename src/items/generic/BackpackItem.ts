import { BackpackItemInfo, ItemType } from "webgl-test-shared";
import Item from "./Item";

class BackpackItem extends Item implements BackpackItemInfo {
   public numExtraItemSlots: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: BackpackItemInfo) {
      super(itemType, count, itemInfo);

      this.numExtraItemSlots = itemInfo.numExtraItemSlots;
   }
}

export default BackpackItem;