import { GameObjectDebugData, ItemType } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import DroppedItem from "../items/DroppedItem";
import AI, { BaseAIParams } from "./AI";
import FoodItem from "../items/generic/FoodItem";
import { GameObject } from "../GameObject";

interface ItemConsumeAIParams extends BaseAIParams<"itemConsume"> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Amount of food units used every second */
   readonly metabolism: number;
   readonly itemTargets: ReadonlySet<ItemType>;
}

class ItemConsumeAI extends AI<"itemConsume"> implements ItemConsumeAIParams {
   public readonly type = "itemConsume";

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly metabolism: number;
   public readonly itemTargets: ReadonlySet<ItemType>;

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
      // Move to the closest food sourcee
      let target: DroppedItem | undefined;
      let minDistance: number = Number.MAX_SAFE_INTEGER;
      for (const droppedItem of this.mob.droppedItemsInVisionRange) {
         const distance = this.mob.position.calculateDistanceBetween(droppedItem.position);
         if (distance < minDistance) {
            minDistance = distance;
            target = droppedItem;
         }
      }

      if (typeof target === "undefined") {
         this.target = null;
         return;
      } else {
         this.target = target;
      }

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
            healthComponent.heal((droppedItem.item as FoodItem).healAmount);
         }
      }
      
      droppedItem.remove();

      this.mob.setAIParam("hunger", 0);
   }

   protected _getWeight(): number {
      if (this.isActive && this.target === null) return 0;

      const hunger = this.mob.getAIParam("hunger")!;
      if (hunger < 50) {
         return 0;
      }
      
      // Try to activate the AI if the entity can see something to eat
      if (this.mob.droppedItemsInVisionRange.size > 0) {
         return 1;
      }

      return 0;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.target === null) return;

      debugData.lines.push(
         {
            targetPosition: this.target.position.package(),
            colour: [0, 0, 1],
            thickness: 2
         }
      );
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default ItemConsumeAI;