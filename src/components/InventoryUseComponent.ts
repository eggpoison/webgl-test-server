import { Inventory, InventoryUseComponentData, SettingsConst, TribeMemberAction } from "webgl-test-shared";
import Entity from "../Entity";
import { InventoryUseComponentArray } from "./ComponentArray";

export interface InventoryUseInfo {
   selectedItemSlot: number;
   readonly inventory: Inventory;
   bowCooldownTicks: number;
   readonly itemAttackCooldowns: Record<number, number>;
   readonly spearWindupCooldowns: Record<number, number>;
   readonly crossbowLoadProgressRecord: Record<number, number>;
   foodEatingTimer: number;
   // @Cleanup: Type name should not be 'tribe member action' as non tribe members can have this component
   currentAction: TribeMemberAction;
   lastAttackTicks: number;
   lastEatTicks: number;
   // @Cleanup: May be able to merge all 3 of these into 1
   lastBowChargeTicks: number;
   lastSpearChargeTicks: number;
   lastBattleaxeChargeTicks: number;
   lastCrossbowLoadTicks: number;
   thrownBattleaxeItemID: number;
}

export class InventoryUseComponent {
   public readonly inventoryUseInfos = new Array<InventoryUseInfo>();

   public addInventoryUseInfo(inventory: Inventory): void {
      this.inventoryUseInfos.push({
         selectedItemSlot: 1,
         inventory: inventory,
         bowCooldownTicks: 0,
         itemAttackCooldowns: {},
         spearWindupCooldowns: {},
         crossbowLoadProgressRecord: {},
         foodEatingTimer: 0,
         currentAction: TribeMemberAction.none,
         lastAttackTicks: 0,
         lastEatTicks: 0,
         lastBowChargeTicks: 0,
         lastSpearChargeTicks: 0,
         lastBattleaxeChargeTicks: 0,
         lastCrossbowLoadTicks: 0,
         thrownBattleaxeItemID: -1
      });
   }
}

export function tickInventoryUseComponent(inventoryUseComponent: InventoryUseComponent): void {
   for (let i = 0; i < inventoryUseComponent.inventoryUseInfos.length; i++) {
      const useInfo = inventoryUseComponent.inventoryUseInfos[i];

      // Update attack cooldowns
      for (let itemSlot = 1; itemSlot <= useInfo.inventory.width * useInfo.inventory.height; itemSlot++) {
         if (useInfo.itemAttackCooldowns.hasOwnProperty(itemSlot)) {
            useInfo.itemAttackCooldowns[itemSlot] -= SettingsConst.I_TPS;
            if (useInfo.itemAttackCooldowns[itemSlot] < 0) {
               delete useInfo.itemAttackCooldowns[itemSlot];
            }
         }
      }

      // Update bow cooldown
      if (useInfo.bowCooldownTicks > 0) {
         useInfo.bowCooldownTicks--;
      }
   }
}

export function getInventoryUseInfo(inventoryUseComponent: InventoryUseComponent, inventoryName: string): InventoryUseInfo {
   for (let i = 0; i < inventoryUseComponent.inventoryUseInfos.length; i++) {
      const useInfo = inventoryUseComponent.inventoryUseInfos[i];
      if (useInfo.inventory.name === inventoryName) {
         return useInfo;
      }
   }

   throw new Error("Can't find inventory use info for inventory name " + inventoryName);
}

export function hasInventoryUseInfo(inventoryUseComponent: InventoryUseComponent, inventoryName: string): boolean {
   for (let i = 0; i < inventoryUseComponent.inventoryUseInfos.length; i++) {
      const useInfo = inventoryUseComponent.inventoryUseInfos[i];
      if (useInfo.inventory.name === inventoryName) {
         return true;
      }
   }

   return false;
}

export function serialiseInventoryUseComponent(entity: Entity): InventoryUseComponentData {
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(entity.id);
   return {
      inventoryUseInfos: inventoryUseComponent.inventoryUseInfos.map(inventoryUseInfo => {
         return {
            selectedItemSlot: inventoryUseInfo.selectedItemSlot,
            inventoryName: inventoryUseInfo.inventory.name,
            bowCooldownTicks: inventoryUseInfo.bowCooldownTicks,
            itemAttackCooldowns: inventoryUseInfo.itemAttackCooldowns,
            spearWindupCooldowns: inventoryUseInfo.spearWindupCooldowns,
            crossbowLoadProgressRecord: inventoryUseInfo.crossbowLoadProgressRecord,
            foodEatingTimer: inventoryUseInfo.foodEatingTimer,
            currentAction: inventoryUseInfo.currentAction,
            lastAttackTicks: inventoryUseInfo.lastAttackTicks,
            lastEatTicks: inventoryUseInfo.lastEatTicks,
            lastBowChargeTicks: inventoryUseInfo.lastBowChargeTicks,
            lastSpearChargeTicks: inventoryUseInfo.lastSpearChargeTicks,
            lastBattleaxeChargeTicks: inventoryUseInfo.lastBattleaxeChargeTicks,
            lastCrossbowLoadTicks: inventoryUseInfo.lastCrossbowLoadTicks,
            thrownBattleaxeItemID: inventoryUseInfo.thrownBattleaxeItemID
         };
      })
   };
}