import { ItemType, ITEM_INFO_RECORD, BaseItemInfo, ItemClassifications } from "webgl-test-shared";
import FoodItem from "./FoodItem";
import MaterialItem from "./MaterialItem";
import WeaponItem from "./WeaponItem";

let nextAvailableID = 0;
const getUniqueID = (): number => {
   return nextAvailableID++;
}

abstract class Item implements BaseItemInfo {
   /** Unique identifier for the item */
   public readonly id: number;

   public readonly type: ItemType;
   public count: number;

   constructor(itemType: ItemType, count: number, itemInfo: BaseItemInfo) {
      this.id = getUniqueID();

      this.type = itemType;
      this.count = count;
   }
}

export default Item;