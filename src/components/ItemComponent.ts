import { ItemType } from "webgl-test-shared";

export interface ItemComponent {
   readonly type: ItemType;
   amount: number;
   /** Stores which entities are on cooldown to pick up the item, and their remaining cooldowns */
   readonly entityPickupCooldowns: Record<number, number>;
}