import { ItemType, ToolItemInfo } from "webgl-test-shared";
import Item from "./Item";

class ToolItem extends Item implements ToolItemInfo {
   public readonly toolType: "weapon";
   public readonly useTime: number;

   constructor(itemType: ItemType, count: number, itemInfo: ToolItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
      this.useTime = itemInfo.useTime;
   }
}

export default ToolItem;