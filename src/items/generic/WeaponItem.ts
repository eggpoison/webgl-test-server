import { ItemType, WeaponItemInfo } from "webgl-test-shared";
import ToolItem from "./ToolItem";

class WeaponItem extends ToolItem implements WeaponItemInfo {
   public readonly toolType: "weapon";
   public readonly damage: number;

   constructor(itemType: ItemType, count: number, itemInfo: WeaponItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
      this.damage = itemInfo.damage;
   }

   public getAttackDamage(): number {
      return this.damage;
   }
}

export default WeaponItem;