import { ItemType, Item } from "webgl-test-shared";

let nextAvailableID = 0;
const getUniqueID = (): number => {
   return nextAvailableID++;
}

export function createItem(itemType: ItemType, amount: number): Item {
   return new Item(itemType, amount, getUniqueID());
}