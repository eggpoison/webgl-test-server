import { ItemType, Item, ITEM_TYPE_RECORD, ITEM_INFO_RECORD, SettingsConst, ToolItemInfo } from "webgl-test-shared";

let nextAvailableID = 0;
const getUniqueID = (): number => {
   return nextAvailableID++;
}

export function createItem(itemType: ItemType, amount: number): Item {
   return new Item(itemType, amount, getUniqueID());
}

export function itemIsTool(item: Item): boolean {
   const itemTypeInfo = ITEM_TYPE_RECORD[item.type];
   return itemTypeInfo === "axe" || itemTypeInfo === "pickaxe" || itemTypeInfo === "sword" || itemTypeInfo === "spear" || itemTypeInfo === "hammer" || itemTypeInfo === "battleaxe";
}

export function getItemAttackCooldown(item: Item): number {
   if (itemIsTool(item)) {
      const itemInfo = ITEM_INFO_RECORD[item.type] as ToolItemInfo;
      return itemInfo.attackCooldown;
   } else {
      return SettingsConst.DEFAULT_ATTACK_COOLDOWN;
   }
}