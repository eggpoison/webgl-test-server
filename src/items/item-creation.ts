import { ItemType, ITEM_INFO_RECORD } from "webgl-test-shared";
import FoodItem from "./FoodItem";
import Item from "./Item";
import MaterialItem from "./MaterialItem";
import PlaceableItem from "./PlaceableItem";
import WeaponItem from "./WeaponItem";

const ITEM_CLASS_RECORD = {
   material: () => MaterialItem,
   food: () => FoodItem,
   weapon: () => WeaponItem,
   placeable: () => PlaceableItem
}

export function createItem(itemType: ItemType, count: number): Item {
   const itemInfoEntry = ITEM_INFO_RECORD[itemType];

   const itemClass = ITEM_CLASS_RECORD[itemInfoEntry.classification]();
   
   switch (itemInfoEntry.classification) {
      case "material": {
         return new (itemClass as typeof MaterialItem)(itemType, count, itemInfoEntry.info);
      }
      case "food": {
         return new (itemClass as typeof FoodItem)(itemType, count, itemInfoEntry.info);
      }
      case "weapon": {
         return new (itemClass as typeof WeaponItem)(itemType, count, itemInfoEntry.info);
      }
      case "placeable": {
         return new (itemClass as typeof PlaceableItem)(itemType, count, itemInfoEntry.info);
      }
   }
}