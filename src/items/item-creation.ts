import { ItemInfo, ItemType, ITEM_INFO_RECORD } from "webgl-test-shared";
import Item from "./generic/Item";
import Berry from "./specific/Berry";
import CookedBeef from "./specific/CookedBeef";
import Leather from "./specific/Leather";
import LeatherBackpack from "./specific/LeatherBackpack";
import RawBeef from "./specific/RawBeef";
import Rock from "./specific/Rock";
import StoneAxe from "./specific/StoneAxe";
import StonePickaxe from "./specific/StonePickaxe";
import StoneSword from "./specific/StoneSword";
import Wood from "./specific/Wood";
import WoodenAxe from "./specific/WoodenAxe";
import WoodenPickaxe from "./specific/WoodenPickaxe";
import WoodenSword from "./specific/WoodenSword";
import Workbench from "./specific/Workbench";

const ITEM_CLASS_RECORD: { [T in ItemType]: () => new (itemType: T, count: number, itemInfo: ItemInfo<T>) => Item } = {
   wood: () => Wood,
   workbench: () => Workbench,
   wooden_sword: () => WoodenSword,
   wooden_axe: () => WoodenAxe,
   wooden_pickaxe: () => WoodenPickaxe,
   berry: () => Berry,
   raw_beef: () => RawBeef,
   cooked_beef: () => CookedBeef,
   rock: () => Rock,
   stone_sword: () => StoneSword,
   stone_axe: () => StoneAxe,
   stone_pickaxe: () => StonePickaxe,
   leather: () => Leather,
   leather_backpack: () => LeatherBackpack
};

export function createItem(itemType: ItemType, count: number): Item {
   const itemInfoEntry = ITEM_INFO_RECORD[itemType];

   const itemClass = ITEM_CLASS_RECORD[itemType]() as new (itemType: ItemType, count: number, itemInfoEntry: ItemInfo<ItemType>) => Item;
   return new itemClass(itemType, count, itemInfoEntry);
}