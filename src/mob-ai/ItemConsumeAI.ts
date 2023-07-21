import { ItemType, SETTINGS, TileType } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import ItemEntity from "../items/ItemEntity";
import { SERVER } from "../server";
import AI, { BaseAIParams } from "./AI";
import FoodItem from "../items/generic/FoodItem";
import { GameObject } from "../GameObject";

type FoodSource = {
   /** Amount of food given by eating the source */
   readonly foodUnits: number;
}

export interface TileFoodSource extends FoodSource {
   /** What the tile turns into after being eaten */
   readonly resultingTileType: TileType;
   /** Time it takes to eat the tile */
   readonly grazeTime: number;
}

export interface ItemFoodSource extends FoodSource {

}

interface ItemConsumeAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Amount of food units used every second */
   readonly metabolism: number;
   readonly itemTargets: ReadonlySet<ItemType>;
}

class ItemConsumeAI extends AI implements ItemConsumeAIParams {
   public readonly type = "itemConsume";

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly metabolism: number;
   public readonly itemTargets: ReadonlySet<ItemType>;

   private readonly itemEntitiesInRange = new Set<ItemEntity>();

   /** The food source to move towards */
   private target: ItemEntity | null = null;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, metabolism, itemTargets }: ItemConsumeAIParams) {
      super(mob, { aiWeightMultiplier });
      
      this.metabolism = metabolism;

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.itemTargets = typeof itemTargets !== "undefined" ? itemTargets : new Set();

      this.mob.createEvent("enter_collision", (itemEntity: GameObject): void => {
         if (itemEntity.i === "itemEntity") {
            if (!this.mob.isRemoved && this.itemTargets.has(itemEntity.item.type)) {
               this.consumeItem(itemEntity);
            }
         }
      });
   }

   public onRefresh(): void {
      // Move to the closest food sourcee
      let target: ItemEntity | undefined;
      let minDistance: number = Number.MAX_SAFE_INTEGER;
      for (const itemEntity of this.itemEntitiesInRange) {
         const distance = this.mob.position.calculateDistanceBetween(itemEntity.position);
         if (distance < minDistance) {
            minDistance = distance;
            target = itemEntity;
         }
      }

      if (typeof target === "undefined") {
         this.target = null;
         return;
      } else {
         this.target = target;
      }

      // Move to the target item entity
      super.moveToPosition(this.target.position, this.acceleration, this.terminalVelocity);
   }

   public onDeactivation(): void {
      this.target = null;
   }

   public tick(): void {
      super.tick();

      if (this.target === null) return;

      // Move to the item entity
      super.moveToPosition(this.target.position, this.acceleration, this.terminalVelocity);
   }

   private consumeItem(itemEntity: ItemEntity): void {
      // If the item entity was a food item, gain health based on the quality of the food
      if (itemEntity.item.hasOwnProperty("eatTime")) {
         const healthComponent = this.mob.getComponent("health");
         if (healthComponent !== null) {
            healthComponent.heal((itemEntity.item as FoodItem).healAmount);
         }
      }
      
      itemEntity.destroy();
   }

   protected _getWeight(): number {
      if (this.isActive && this.target === null) return 0;

      // Calculate item entities in range
      this.itemEntitiesInRange.clear();
      const minX = Math.max(Math.min(Math.floor((this.mob.position.x - this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxX = Math.max(Math.min(Math.floor((this.mob.position.x + this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minY = Math.max(Math.min(Math.floor((this.mob.position.y - this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxY = Math.max(Math.min(Math.floor((this.mob.position.y + this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      for (let chunkX = minX; chunkX <= maxX; chunkX++) {
         for (let chunkY = minY; chunkY <= maxY; chunkY++) {
            for (const itemEntity of SERVER.board.getChunk(chunkX, chunkY).getItemEntities()) {
               if (!this.itemTargets.has(itemEntity.item.type)) {
                  continue;
               }
               
               if (!this.itemEntitiesInRange.has(itemEntity)) {
                  this.itemEntitiesInRange.add(itemEntity);
               }
            }
         }
      }

      // Try to activate the AI if the entity can see something to eat
      if (this.itemEntitiesInRange.size > 0) {
         return 1;
      }

      return 0;
   }
}

export default ItemConsumeAI;