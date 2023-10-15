import { GameObjectDebugData } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import DroppedItem from "../items/DroppedItem";
import { MobAIType } from "../mob-ai-types";

interface ItemChaseAIParams extends BaseAIParams<MobAIType.item_chase> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly itemIsChased: (droppedItem: DroppedItem) => boolean;
}

class ItemChaseAI extends AI<MobAIType.item_chase> implements ItemChaseAIParams {
   public readonly type = MobAIType.item_chase;

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public itemIsChased: (droppedItem: DroppedItem) => boolean;

   private target: DroppedItem | null = null;

   constructor(mob: Mob, aiParams: ItemChaseAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.itemIsChased = aiParams.itemIsChased;
   }

   public tick(): void {
      const droppedItemsInVisionRangeIterator = this.mob.visibleDroppedItems.values();

      // Find closest target
      let closestEntity = droppedItemsInVisionRangeIterator.next().value as DroppedItem;
      let minDistance = this.mob.position.calculateDistanceBetween(closestEntity.position);
      for (let currentDroppedItem: DroppedItem; currentDroppedItem = droppedItemsInVisionRangeIterator.next().value;) {
         if (typeof this.itemIsChased !== "undefined" && !this.itemIsChased(currentDroppedItem)) {
            continue;
         }

         const distance = this.mob.position.calculateDistanceBetween(currentDroppedItem.position);
         if (distance < minDistance) {
            closestEntity = currentDroppedItem;
            minDistance = distance;
         }
      }

      if (typeof closestEntity === "undefined") {
         return;
      }
      
      this.target = closestEntity;

      // Move to target
      const angle = this.mob.position.calculateAngleBetween(closestEntity.position);
      this.mob.rotation = angle;
      this.mob.acceleration.x = this.acceleration * Math.sin(this.mob.rotation);
      this.mob.acceleration.y = this.acceleration * Math.cos(this.mob.rotation);
      this.mob.terminalVelocity = this.terminalVelocity;
   }

   public deactivate(): void {
      super.deactivate();

      this.target = null;
   }
   
   public canSwitch(): boolean {
      if (typeof this.itemIsChased !== "undefined") {
         for (const droppedItem of this.mob.visibleDroppedItems) {
            if (this.itemIsChased(droppedItem)) {
               return true;
            }
         }
      } else if (this.mob.visibleDroppedItems.length > 0) {
         return true;
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

export default ItemChaseAI;