import { FoodItemInfo, GameObjectDebugData, ITEM_INFO_RECORD, ItemType } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import DroppedItem from "../items/DroppedItem";
import AI from "./AI";
import { MobAIType } from "../mob-ai-types";

interface ItemConsumeAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly itemTargets: ReadonlySet<ItemType>;
}

class ItemConsumeAI extends AI implements ItemConsumeAIParams {
   public readonly type = MobAIType.itemConsume;

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly itemTargets: ReadonlySet<ItemType>;

   /** The food source to move towards */
   private target: DroppedItem | null = null;

   constructor(mob: Mob, aiParams: ItemConsumeAIParams) {
      super(mob);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.itemTargets = typeof aiParams.itemTargets !== "undefined" ? aiParams.itemTargets : new Set();

      this.mob.createEvent("during_dropped_item_collision", (droppedItem: DroppedItem): void => {
         if (!this.mob.isRemoved && this.itemTargets.has(droppedItem.item.type)) {
            this.consumeItem(droppedItem);
         }
      });
   }

   public onRefresh(): void {
      // Find the closest food source
      let target: DroppedItem | undefined;
      let minDistance: number = Number.MAX_SAFE_INTEGER;
      for (const droppedItem of this.mob.visibleDroppedItems) {
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

   public deactivate(): void {
      super.deactivate();
      
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

      this.mob.forceGetComponent("hunger").hunger = 0;
   }

   public canSwitch(): boolean {
      if (this.isActive && this.target === null) return false;

      if (this.mob.forceGetComponent("hunger").hunger < 100) {
         return false;
      }

      // Try to activate the AI if the entity can see something to eat
      for (const droppedItem of this.mob.visibleDroppedItems) {
         if (this.itemTargets.has(droppedItem.item.type)) {
            return true;
         }
      }
      
      return false;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.target === null) return;

      debugData.lines.push({
         targetPosition: this.target.position.package(),
         colour: [0, 0, 1],
         thickness: 2
      });
   }
}

export default ItemConsumeAI;