import { ItemType, ToolItemInfo, ToolType } from "webgl-test-shared";
import Item from "./Item";

class ToolItem extends Item implements ToolItemInfo {
   public readonly toolType: ToolType;
   public readonly attackCooldown: number;

   private attackTimer = 0;

   constructor(itemType: ItemType, count: number, itemInfo: ToolItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
      this.attackCooldown = itemInfo.attackCooldown;
   }

   public getAttackDamage(): number {
      return 1;
   }
}

export default ToolItem;