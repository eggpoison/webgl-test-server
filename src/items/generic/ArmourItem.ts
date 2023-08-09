import { ArmourItemInfo, ItemType } from "webgl-test-shared";
import Item from "./Item";

class ArmourItem extends Item implements ArmourItemInfo {
   public readonly armour: number;

   constructor(itemType: ItemType, count: number, itemInfo: ArmourItemInfo) {
      super(itemType, count);

      this.armour = itemInfo.armour;
   }
}

export default ArmourItem;