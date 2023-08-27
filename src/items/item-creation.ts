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
import WorkbenchItem from "./specific/WorkbenchItem";
import CactusSpine from "./specific/CactusSpine";
import YetiHide from "./specific/YetiHide";
import Frostcicle from "./specific/Frostcicle";
import Slimeball from "./specific/Slimeball";
import Eyeball from "./specific/Eyeball";
import FleshSword from "./specific/FleshSword";
import TribeTotemItem from "./specific/TribeTotemItem";
import TribeHutItem from "./specific/TribeHutItem";
import BarrelItem from "./specific/BarrelItem";
import FrostArmour from "./specific/FrostArmour";
import FurnaceItem from "./specific/FurnaceItem";
import CampfireItem from "./specific/CampfireItem";
import WoodenBow from "./specific/WoodenBow";

const ITEM_CLASS_RECORD: { [T in ItemType]: () => new (itemType: T, count: number, itemInfo: ItemInfo<T>) => Item } = {
   [ItemType.wood]: () => Wood,
   [ItemType.workbench]: () => WorkbenchItem,
   [ItemType.wooden_sword]: () => WoodenSword,
   [ItemType.wooden_axe]: () => WoodenAxe,
   [ItemType.wooden_pickaxe]: () => WoodenPickaxe,
   [ItemType.berry]: () => Berry,
   [ItemType.raw_beef]: () => RawBeef,
   [ItemType.cooked_beef]: () => CookedBeef,
   [ItemType.rock]: () => Rock,
   [ItemType.stone_sword]: () => StoneSword,
   [ItemType.stone_axe]: () => StoneAxe,
   [ItemType.stone_pickaxe]: () => StonePickaxe,
   [ItemType.leather]: () => Leather,
   [ItemType.leather_backpack]: () => LeatherBackpack,
   [ItemType.cactus_spine]: () => CactusSpine,
   [ItemType.yeti_hide]: () => YetiHide,
   [ItemType.frostcicle]: () => Frostcicle,
   [ItemType.slimeball]: () => Slimeball,
   [ItemType.eyeball]: () => Eyeball,
   [ItemType.flesh_sword]: () => FleshSword,
   [ItemType.tribe_totem]: () => TribeTotemItem,
   [ItemType.tribe_hut]: () => TribeHutItem,
   [ItemType.barrel]: () => BarrelItem,
   [ItemType.frost_armour]: () => FrostArmour,
   [ItemType.campfire]: () => CampfireItem,
   [ItemType.furnace]: () => FurnaceItem,
   [ItemType.wooden_bow]: () => WoodenBow
};

export function createItem(itemType: ItemType, count: number): Item {
   const itemInfoEntry = ITEM_INFO_RECORD[itemType];

   const itemClass = ITEM_CLASS_RECORD[itemType]() as new (itemType: ItemType, count: number, itemInfoEntry: ItemInfo<ItemType>) => Item;
   return new itemClass(itemType, count, itemInfoEntry);
}