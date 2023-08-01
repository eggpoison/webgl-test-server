import { GameObjectDebugData, ItemType, SETTINGS } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import DroppedItem from "../items/DroppedItem";
import AI, { BaseAIParams } from "./AI";
import FoodItem from "../items/generic/FoodItem";
import { GameObject } from "../GameObject";
import Board from "../Board";

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

   private readonly droppedItemsInRange = new Set<DroppedItem>();

   /** The food source to move towards */
   private target: DroppedItem | null = null;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, metabolism, itemTargets }: ItemConsumeAIParams) {
      super(mob, { aiWeightMultiplier });
      
      this.metabolism = metabolism;

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.itemTargets = typeof itemTargets !== "undefined" ? itemTargets : new Set();

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
      for (const droppedItem of this.droppedItemsInRange) {
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
      
      // Calculate dropped items in range
      this.droppedItemsInRange.clear();
      const minX = Math.max(Math.min(Math.floor((this.mob.position.x - this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxX = Math.max(Math.min(Math.floor((this.mob.position.x + this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minY = Math.max(Math.min(Math.floor((this.mob.position.y - this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxY = Math.max(Math.min(Math.floor((this.mob.position.y + this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      for (let chunkX = minX; chunkX <= maxX; chunkX++) {
         for (let chunkY = minY; chunkY <= maxY; chunkY++) {
            for (const droppedItem of Board.getChunk(chunkX, chunkY).getDroppedItems()) {
               if (!this.itemTargets.has(droppedItem.item.type)) {
                  continue;
               }

               const distance = this.mob.position.calculateDistanceBetween(droppedItem.position);
               if (distance > this.mob.visionRange) {
                  continue;
               }
               
               if (!this.droppedItemsInRange.has(droppedItem)) {
                  this.droppedItemsInRange.add(droppedItem);
               }
            }
         }
      }

      // Try to activate the AI if the entity can see something to eat
      if (this.droppedItemsInRange.size > 0) {
         return 1;
      }

      return 0;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.target === null) return;

      debugData.lines.push(
         {
            targetPosition: this.target.position.package(),
            colour: [0, 0, 1]
         }
      );
   }

   public callCallback(callback: () => void): void {
      callback();
   }
}

export default ItemConsumeAI;