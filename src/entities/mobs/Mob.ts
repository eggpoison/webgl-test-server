import { EntityType, GameObjectDebugData, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../../mob-ai/AI";
import Entity, { EntityComponents } from "../Entity";
import Board from "../../Board";
import { AIType } from "../../mob-ai/ai-types";
import DroppedItem from "../../items/DroppedItem";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Chunk from "../../Chunk";

abstract class Mob extends Entity {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_TIME = 4;

   private static readonly testHitbox = new CircularHitbox();
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   private readonly visionRangeSquared: number;
   
   private readonly ais = new Array<AI<AIType>>();
   private currentAI: AI<AIType> | null = null;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_TIME - 1);

   private aiParams: Record<string, number> = {};

   protected readonly entitiesInVisionRange = new Set<Entity>();
   public readonly droppedItemsInVisionRange = new Set<DroppedItem>();

   private chunksInVisionRange = new Array<Chunk>();
   
   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType, visionRange: number) {
      super(position, components, entityType);

      this.visionRange = visionRange;
      this.visionRangeSquared = Math.pow(visionRange, 2);
   }

   /**
    * Adds a new AI component to the mob.
    * @param aiData AI information to use.
    */
   protected addAI(ai: AI<AIType>): void {
      this.ais.push(ai);
   }

   public tick(): void {
      super.tick();

      // @Speed: This shouldn't have to run for mob types which don't need this ai param
      if (this.hasAIParam("hunger")) {
         const previousNumber = this.getAIParam("hunger")!;
         const metabolism = this.getAIParam("metabolism")!;

         let newHunger = previousNumber + metabolism / SETTINGS.TPS;
         if (newHunger > 100) {
            newHunger = 100;
         }
         this.setAIParam("hunger", newHunger);
      }

      // Refresh AI
      if (++this.aiRefreshTicker === Mob.AI_REFRESH_TIME) {
         this.refreshAI();
         this.aiRefreshTicker = 0;
      }

      if (this.currentAI !== null) {
         this.currentAI.tick();
         this.currentAI.callCallback();
      }
   }

   public refreshAI(): void {
      // If the mob has no AI's, don't try to change the current AI
      if (this.ais.length === 0) {
         return;
      }
      
      // @Speed: only update chunks when the position changes
      this.updateChunksInVisionRange();
      this.updateGameObjectsInVisionRange();

      // Update the values of all AI's and find the one with the highest weight
      let aiWithHighestWeight!: AI<AIType>;
      let maxWeight = -1;
      for (const ai of this.ais) {
         ai.updateValues(this.entitiesInVisionRange);

         const weight = ai.getWeight();
         if (weight > maxWeight) {
            maxWeight = weight;
            aiWithHighestWeight = ai;
         }
      }

      // If the AI is new, activate the AI
      if (aiWithHighestWeight !== this.currentAI) {
         aiWithHighestWeight.activate();
         if (this.currentAI !== null) {
            this.currentAI.deactivate();
            if (typeof this.currentAI.onDeactivation !== "undefined") this.currentAI.onDeactivation();
         }
      }
      
      if (typeof aiWithHighestWeight.onRefresh !== "undefined") aiWithHighestWeight.onRefresh();
      
      this.currentAI = aiWithHighestWeight;
   }

   private updateChunksInVisionRange(): void {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);

      this.chunksInVisionRange = [];
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            // 
            // Check if the chunk is actually in the vision range
            // 

            // Find the closest vertex of the chunk to the mob
            const x = this.position.x < (chunkX + 0.5) * SETTINGS.CHUNK_UNITS ? chunkX * SETTINGS.CHUNK_UNITS : (chunkX + 1) * SETTINGS.CHUNK_UNITS;
            const y = this.position.y < (chunkY + 0.5) * SETTINGS.CHUNK_UNITS ? chunkY * SETTINGS.CHUNK_UNITS : (chunkY + 1) * SETTINGS.CHUNK_UNITS;

            if (Math.pow(x - this.position.x, 2) + Math.pow(y - this.position.y, 2) <= this.visionRangeSquared) {
               this.chunksInVisionRange.push(Board.getChunk(chunkX, chunkY));
            }
         }
      }
   }
   
   /** Finds all entities within the range of the mob's vision */
   private updateGameObjectsInVisionRange(): void {
      Mob.testHitbox.radius = this.visionRange;
      Mob.testHitbox.position.x = this.position.x;
      Mob.testHitbox.position.y = this.position.y;
      Mob.testHitbox.updateHitboxBounds(0);
      
      this.entitiesInVisionRange.clear();
      this.droppedItemsInVisionRange.clear();
      for (const chunk of this.chunksInVisionRange) {
         for (const droppedItem of chunk.gameObjects) {
            // Don't add existing game objects
            if ((droppedItem.i === "entity" && this.entitiesInVisionRange.has(droppedItem)) || (droppedItem.i === "droppedItem" && this.droppedItemsInVisionRange.has(droppedItem)) || droppedItem === this) {
               continue;
            }

            if (Math.pow(this.position.x - droppedItem.position.x, 2) + Math.pow(this.position.y - droppedItem.position.y, 2) <= Math.pow(this.visionRange, 2)) {
               switch (droppedItem.i) {
                  case "entity": {
                     this.entitiesInVisionRange.add(droppedItem);
                     break;
                  }
                  case "droppedItem": {
                     this.droppedItemsInVisionRange.add(droppedItem);
                     break;
                  }
               }
               continue;
            }

            // If the test hitbox can 'see' any of the game object's hitboxes, it is visible
            for (const hitbox of droppedItem.hitboxes) {
               if (Mob.testHitbox.isColliding(hitbox)) {
                  switch (droppedItem.i) {
                     case "entity": {
                        this.entitiesInVisionRange.add(droppedItem);
                        break;
                     }
                     case "droppedItem": {
                        this.droppedItemsInVisionRange.add(droppedItem);
                        break;
                     }
                  }
                  break;
               }
            }
         }
      }
   }

   public getCurrentAIType(): AIType | null {
      return this.currentAI !== null ? this.currentAI.type : null;
   }

   public getCurrentAI(): AI<AIType> | null {
      return this.currentAI;   
   }

   public getAIParam(param: string): number | undefined {
      return this.aiParams[param];
   }

   public setAIParam(param: string, value: number): void {
      this.aiParams[param] = value;
   }

   public hasAIParam(param: string): boolean {
      return this.aiParams.hasOwnProperty(param);
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      // Circle for vision range
      if (this.visionRange > 0) {
         debugData.circles.push({
            radius: this.visionRange,
            colour: [1, 0, 1],
            thickness: 2
         });
      }

      debugData.debugEntries.push("Current AI type: " + (this.currentAI !== null ? this.currentAI.type : "none"));

      if (typeof this.currentAI?.addDebugData !== "undefined") {
         this.currentAI.addDebugData(debugData);
      }

      return debugData;
   }

   public getAI<T extends AIType>(type: T): AI<T> | null {
      for (const ai of this.ais) {
         if (ai.type === type) {
            return ai as AI<T>;
         }
      }
      return null;
   }
}

export default Mob;