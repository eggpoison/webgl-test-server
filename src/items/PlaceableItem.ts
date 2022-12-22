import { EntityType, ItemType, PlaceableItemInfo } from "webgl-test-shared";
import StackableItem from "./StackableItem";

class PlaceableItem extends StackableItem implements PlaceableItemInfo {
   public readonly entityType: EntityType;
   
   constructor(itemType: ItemType, count: number, itemInfo: PlaceableItemInfo) {
      super(itemType, count, itemInfo);

      this.entityType = itemInfo.entityType;
   }
}

export default PlaceableItem;