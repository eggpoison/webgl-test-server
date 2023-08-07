import { GameObjectDebugData, Vector } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import DroppedItem from "../items/DroppedItem";

interface ItemChaseAIParams extends BaseAIParams<"item_chase"> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly itemIsChased: (droppedItem: DroppedItem) => boolean;
}

class ItemChaseAI extends AI<"item_chase"> implements ItemChaseAIParams {
   public readonly type = "item_chase";

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
      if (this.mob.droppedItemsInVisionRange.size === 0) return;

      const droppedItemsInVisionRangeIterator = this.mob.droppedItemsInVisionRange.values();

      // Find closest target
      let closestEntity = droppedItemsInVisionRangeIterator.next().value as DroppedItem;
      let minDistance = this.mob.position.calculateDistanceBetween(closestEntity.position);
      for (var currentEntity: DroppedItem; currentEntity = droppedItemsInVisionRangeIterator.next().value;) {
         const distance = this.mob.position.calculateDistanceBetween(currentEntity.position);
         if (distance < minDistance) {
            closestEntity = currentEntity;
            minDistance = distance;
         }
      }
      this.target = closestEntity;

      // Move to target
      const angle = this.mob.position.calculateAngleBetween(closestEntity.position);
      this.mob.rotation = angle;
      this.mob.acceleration = new Vector(this.acceleration, this.mob.rotation);
      this.mob.terminalVelocity = this.terminalVelocity;
   }

   public onDeactivation(): void {
      this.target = null;
   }
   
   protected _getWeight(): number {
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

   protected _callCallback(callback: (targetEntity: DroppedItem | null) => void): void {
      callback(this.target);
   }
}

export default ItemChaseAI;