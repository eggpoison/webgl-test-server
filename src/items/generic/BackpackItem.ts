import { BackpackItemInfo, ItemType } from "webgl-test-shared";
import Item from "./Item";

class BackpackItem extends Item implements BackpackItemInfo {
   public inventoryWidth: number;
   public inventoryHeight: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: BackpackItemInfo) {
      super(itemType, count, itemInfo);

      this.inventoryWidth = itemInfo.inventoryWidth;
      this.inventoryHeight = itemInfo.inventoryHeight;
   }
}

export default BackpackItem;