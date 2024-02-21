import { ItemType, SETTINGS } from "webgl-test-shared";

export interface ItemComponent {
   readonly itemType: ItemType;
   amount: number;
   /** Stores which entities are on cooldown to pick up the item, and their remaining cooldowns */
   readonly entityPickupCooldowns: Record<number, number>;
}

export function tickItemComponent(itemComponent: ItemComponent): void {
   // @Speed
   for (const entityID of Object.keys(itemComponent.entityPickupCooldowns).map(idString => Number(idString))) {
      itemComponent.entityPickupCooldowns[entityID] -= 1 / SETTINGS.TPS;
      if (itemComponent.entityPickupCooldowns[entityID] <= 0) {
         delete itemComponent.entityPickupCooldowns[entityID];
      }
   }
}