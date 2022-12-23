import { ItemType, StackableItemInfo } from "webgl-test-shared";
import Item from "./Item";

class StackableItem extends Item implements StackableItemInfo {
   public readonly stackSize: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: StackableItemInfo) {
      super(itemType, count, itemInfo);

      this.stackSize = itemInfo.stackSize;
   }

   public getAttackDamage(): number {
      return 1;
   }
}

export default StackableItem;