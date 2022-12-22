import { ItemType, WeaponItemInfo } from "webgl-test-shared";
import ToolItem from "./ToolItem";

class WeaponItem extends ToolItem implements WeaponItemInfo {
   public readonly damage: number;

   constructor(itemType: ItemType, count: number, itemInfo: WeaponItemInfo) {
      super(itemType, count, itemInfo);

      this.damage = itemInfo.damage;
   }
}

export default WeaponItem;