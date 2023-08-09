import { ArmourItemInfo, ItemType } from "webgl-test-shared";
import Item from "./Item";

class ArmourItem extends Item implements ArmourItemInfo {
   public readonly defence: number;

   constructor(itemType: ItemType, count: number, itemInfo: ArmourItemInfo) {
      super(itemType, count);

      this.defence = itemInfo.defence;
   }
}

export default ArmourItem;