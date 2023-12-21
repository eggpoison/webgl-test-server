import { SETTINGS, TribeMemberAction } from "webgl-test-shared";
import { Inventory } from "./InventoryComponent";

export class InventoryUseComponent {
   public readonly inventory: Inventory;
   public bowCooldownTicks = 0;
   public readonly itemAttackCooldowns: Record<number, number> = {};
   public foodEatingTimer = 0;

   public selectedItemSlot = 1;

   public currentAction = TribeMemberAction.none;
   public lastAttackTicks = -99999;
   public lastEatTicks = -99999;
   public lastBowChargeTicks = -99999;

   constructor(inventory: Inventory) {
      this.inventory = inventory;
   }
}

export function tickInventoryUseComponent(inventoryUseComponent: InventoryUseComponent): void {
   // Update attack cooldowns
   for (let itemSlot = 1; itemSlot <= inventoryUseComponent.inventory.width * inventoryUseComponent.inventory.height; itemSlot++) {
      if (inventoryUseComponent.itemAttackCooldowns.hasOwnProperty(itemSlot)) {
         inventoryUseComponent.itemAttackCooldowns[itemSlot] -= 1 / SETTINGS.TPS;
         if (inventoryUseComponent.itemAttackCooldowns[itemSlot] < 0) {
            delete inventoryUseComponent.itemAttackCooldowns[itemSlot];
         }
      }
   }

   inventoryUseComponent.bowCooldownTicks--;
   if (inventoryUseComponent.bowCooldownTicks < 0) {
      inventoryUseComponent.bowCooldownTicks = 0;
   }
}