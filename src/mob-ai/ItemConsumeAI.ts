import { FoodItemInfo, GameObjectDebugData, ITEM_INFO_RECORD, ItemType, SETTINGS, randFloat } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import DroppedItem from "../items/DroppedItem";
import AI, { BaseAIParams } from "./AI";
import { GameObject } from "../GameObject";
import { MobAIType } from "../mob-ai-types";

interface ItemConsumeAIParams extends BaseAIParams<MobAIType.itemConsume> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Amount of food units used every second */
   readonly metabolism: number;
   readonly itemTargets: ReadonlySet<ItemType>;
}

class ItemConsumeAI extends AI<MobAIType.itemConsume> implements ItemConsumeAIParams {
   public readonly type = MobAIType.itemConsume;

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly metabolism: number;
   public readonly itemTargets: ReadonlySet<ItemType>;

   public hunger = randFloat(0, 25);
   
   /** The food source to move towards */
   private target: DroppedItem | null = null;

   constructor(mob: Mob, aiParams: ItemConsumeAIParams) {
      super(mob, aiParams);
      
      this.metabolism = aiParams.metabolism;

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.itemTargets = typeof aiParams.itemTargets !== "undefined" ? aiParams.itemTargets : new Set();

      this.mob.createEvent("enter_collision", (droppedItem: GameObject): void => {
         if (droppedItem.i === "droppedItem") {
            if (!this.mob.isRemoved && this.itemTargets.has(droppedItem.item.type)) {
               this.consumeItem(droppedItem);
            }
         }
      });
   }

   public onRefresh(): void {
      // Find the closest food source
      let target: DroppedItem | undefined;
      let minDistance: number = Number.MAX_SAFE_INTEGER;
      for (const droppedItem of this.mob.droppedItemsInVisionRange) {
         if (!this.itemTargets.has(droppedItem.item.type)) {
            continue;
         }
         
         const distance = this.mob.position.calculateDistanceBetween(droppedItem.position);
         if (distance < minDistance) {
            minDistance = distance;
            target = droppedItem;
         }
      }

      if (typeof target === "undefined") {
         this.target = null;
         return;
      }

      this.target = target;

      // Move to the target dropped item
      super.moveToPosition(this.target.position, this.acceleration, this.terminalVelocity);
   }

   public onDeactivation(): void {
      this.target = null;
   }

   public tick(): void {
      super.tick();

      if (this.target === null) return;

      // Move to the dropped item
      super.moveToPosition(this.target.position, this.acceleration, this.terminalVelocity);
   }

   private consumeItem(droppedItem: DroppedItem): void {
      // If the dropped item was a food item, gain health based on the quality of the food
      if (droppedItem.item.hasOwnProperty("eatTime")) {
         const healthComponent = this.mob.getComponent("health");
         if (healthComponent !== null) {
            const itemInfo = ITEM_INFO_RECORD[droppedItem.item.type] as FoodItemInfo;
            healthComponent.heal(itemInfo.healAmount);
         }
      }
      
      droppedItem.remove();

      this.hunger = 0;
   }

   protected _getWeight(): number {
      // Hackily udpate hunger
      this.hunger += this.metabolism / SETTINGS.TPS * Mob.AI_REFRESH_INTERVAL;
      if (this.hunger > 100) {
         this.hunger = 100;
      }
      
      if (this.isActive && this.target === null) return 0;

      if (this.hunger < 100) {
         return 0;
      }

      // Try to activate the AI if the entity can see something to eat
      for (const droppedItem of this.mob.droppedItemsInVisionRange) {
         if (this.itemTargets.has(droppedItem.item.type)) {
            return 1;
         }
      }
      
      return 0;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.target === null) return;

      debugData.lines.push({
         targetPosition: this.target.position.package(),
         colour: [0, 0, 1],
         thickness: 2
      });
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default ItemConsumeAI;