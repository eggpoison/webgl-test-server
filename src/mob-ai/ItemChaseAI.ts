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
      const droppedItemsInVisionRangeIterator = this.mob.droppedItemsInVisionRange.values();

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

   public onDeactivation(): void {
      this.target = null;
   }
   
   protected _getWeight(): number {
      if (typeof this.itemIsChased !== "undefined") {
         for (const droppedItem of this.mob.droppedItemsInVisionRange) {
            if (this.itemIsChased(droppedItem)) {
               return 1;
            }
         }
      } else {
         if (this.mob.droppedItemsInVisionRange.size > 0) {
            return 1;
         }
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

   protected _callCallback(callback: (targetEntity: DroppedItem | null) => void): void {
      callback(this.target);
   }
}

export default ItemChaseAI;