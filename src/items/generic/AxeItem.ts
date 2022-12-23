import { AxeItemInfo, ItemType } from "webgl-test-shared";
import ToolItem from "./ToolItem";

class AxeItem extends ToolItem implements AxeItemInfo {
   public readonly toolType: "axe";
   public readonly damage: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: AxeItemInfo) {
      super(itemType, count, itemInfo)

      this.toolType = itemInfo.toolType;
      this.damage = itemInfo.damage;
   }

   public getAttackDamage(): number {
      return this.damage;
   }
}

export default AxeItem;