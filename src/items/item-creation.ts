import { ItemClassifications, ItemType, ITEM_INFO_RECORD, ITEM_TYPE_RECORD } from "webgl-test-shared";
import Item from "./generic/Item";
import Berry from "./specific/Berry";
import CookedBeef from "./specific/CookedBeef";
import RawBeef from "./specific/RawBeef";
import Wood from "./specific/Wood";
import WoodenAxe from "./specific/WoodenAxe";
import WoodenSword from "./specific/WoodenSword";
import Workbench from "./specific/Workbench";

const ITEM_CLASS_RECORD: { [T in ItemType]: () => new (itemType: T, count: number, itemInfo: ItemClassifications[ReturnType<ITEM_TYPE_RECORD[T]>]) => Item } = {
   wood: () => Wood,
   workbench: () => Workbench,
   wooden_sword: () => WoodenSword,
   wooden_axe: () => WoodenAxe,
   berry: () => Berry,
   raw_beef: () => RawBeef,
   cooked_beef: () => CookedBeef
};

export function createItem(itemType: ItemType, count: number): Item {
   const itemInfoEntry = ITEM_INFO_RECORD[itemType];

   const itemClass = ITEM_CLASS_RECORD[itemType]() as new (itemType: ItemType, count: number, itemInfo: ItemClassifications[ReturnType<ITEM_TYPE_RECORD[ItemType]>]) => Item;
   return new itemClass(itemType, count, itemInfoEntry.info);
}