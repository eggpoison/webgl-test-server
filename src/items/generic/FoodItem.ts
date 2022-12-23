import { FoodItemInfo, ItemType } from "webgl-test-shared";
import StackableItem from "./StackableItem";

class FoodItem extends StackableItem implements FoodItemInfo {
   public readonly healAmount: number;
   public readonly eatTime: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: FoodItemInfo) {
      super(itemType, count, itemInfo);

      this.healAmount = itemInfo.healAmount;
      this.eatTime = itemInfo.eatTime;
   }
}

export default FoodItem;