import { ItemComponentData, ItemType, SettingsConst } from "webgl-test-shared";
import Entity from "../Entity";
import { ItemComponentArray } from "./ComponentArray";

export interface ItemComponent {
   readonly itemType: ItemType;
   amount: number;
   /** Stores which entities are on cooldown to pick up the item, and their remaining cooldowns */
   readonly entityPickupCooldowns: Record<number, number>;
}

export function tickItemComponent(itemComponent: ItemComponent): void {
   // @Speed
   for (const entityID of Object.keys(itemComponent.entityPickupCooldowns).map(idString => Number(idString))) {
      itemComponent.entityPickupCooldowns[entityID] -= SettingsConst.I_TPS;
      if (itemComponent.entityPickupCooldowns[entityID] <= 0) {
         delete itemComponent.entityPickupCooldowns[entityID];
      }
   }
}

export function serialiseItemComponent(entity: Entity): ItemComponentData {
   const itemComponent = ItemComponentArray.getComponent(entity.id);
   return {
      itemType: itemComponent.itemType
   };
}