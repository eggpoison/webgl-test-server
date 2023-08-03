import { SERVER } from "../server";
import { ITEM_INFO_RECORD } from "webgl-test-shared";
import { createItem } from "../items/item-creation";
import InventoryComponent from "./InventoryComponent";

test("Items can't be added past their stack size", () => {
   SERVER;
   
   // Create a test inventory
   const inventoryComponent = new InventoryComponent();
   inventoryComponent.createNewInventory("inventory", 10);

   const woodStackSize = ITEM_INFO_RECORD.wood.stackSize;
   const item = createItem("wood", woodStackSize + 1);

   inventoryComponent.addItem(item);

   // There should now be stackSize wood in the first slot and 1 wood in the second slot
   const firstSlotCount = inventoryComponent.getItem("inventory", 1)?.count || 0;
   const secondSlotCount = inventoryComponent.getItem("inventory", 2)?.count || 0;
   expect(firstSlotCount).toEqual(woodStackSize);
   expect(secondSlotCount).toEqual(1);
});