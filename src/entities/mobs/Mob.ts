import { EntityType, GameObjectDebugData, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../../mob-ai/AI";
import Entity, { EntityComponents } from "../Entity";
import Board from "../../Board";
import DroppedItem from "../../items/DroppedItem";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Chunk from "../../Chunk";
import { MobAIType } from "../../mob-ai-types";

abstract class Mob extends Entity {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_INTERVAL = 4;

   private static readonly testHitbox = new CircularHitbox();
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   private readonly visionRangeSquared: number;
   
   private readonly ais = new Array<AI<MobAIType>>();
   protected currentAI: AI<MobAIType> | null = null;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_INTERVAL - 1);

   protected readonly entitiesInVisionRange = new Set<Entity>();
   public readonly droppedItemsInVisionRange = new Set<DroppedItem>();

   private chunksInVisionRange = new Array<Chunk>();

   /** Value used by herd member hash for determining mob herds */
   public herdMemberHash = -1;

   private lastMinVisibleChunkX = -1;
   private lastMaxVisibleChunkX = -1;
   private lastMinVisibleChunkY = -1;
   private lastMaxVisibleChunkY = -1;
   
   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType, visionRange: number) {
      super(position, components, entityType);

      this.visionRange = visionRange;
      this.visionRangeSquared = Math.pow(visionRange, 2);
   }

   protected addAI(ai: AI<MobAIType>): void {
      this.ais.push(ai);
   }

   public tick(): void {
      super.tick();

      // Refresh AI
      if (++this.aiRefreshTicker === Mob.AI_REFRESH_INTERVAL) {
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
      
      this.updateChunksInVisionRange();
      this.updateGameObjectsInVisionRange();

      // Find the AI to switch to
      let ai: AI<MobAIType> | undefined;
      const numAIs = this.ais.length;
      for (let i = 0; i < numAIs; i++) {
         ai = this.ais[i];
         ai.updateValues(this.entitiesInVisionRange);
         if (ai.canSwitch()) {
            break;
         }
      }
      if (typeof ai === "undefined") {
         this.currentAI = null;
         return;
      }

      // If the AI is new, activate the AI
      if (ai !== this.currentAI) {
         ai.activate();
         if (this.currentAI !== null) {
            this.currentAI.deactivate();
            if (typeof this.currentAI.onDeactivation !== "undefined") this.currentAI.onDeactivation();
         }
      }
      
      if (typeof ai.onRefresh !== "undefined") ai.onRefresh();
      
      this.currentAI = ai;
   }

   private updateChunksInVisionRange(): void {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);

      if (minChunkX !== this.lastMinVisibleChunkX || maxChunkX !== this.lastMaxVisibleChunkX || minChunkY !== this.lastMinVisibleChunkY || maxChunkY !== this.lastMaxVisibleChunkY) {
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

         this.lastMinVisibleChunkX = minChunkX;
         this.lastMaxVisibleChunkX = maxChunkX;
         this.lastMinVisibleChunkY = minChunkY;
         this.lastMaxVisibleChunkY = maxChunkY;
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

      const numChunksInVisionRange = this.chunksInVisionRange.length;
      for (let i = 0; i < numChunksInVisionRange; i++) {
         const chunk = this.chunksInVisionRange[i];

         for (const gameObject of chunk.gameObjects) {
            // Don't add existing game objects
            // @Speed: This is a ton of checks
            if ((gameObject.i === "entity" && this.entitiesInVisionRange.has(gameObject)) || (gameObject.i === "droppedItem" && this.droppedItemsInVisionRange.has(gameObject)) || gameObject === this) {
               continue;
            }

            if (Math.pow(this.position.x - gameObject.position.x, 2) + Math.pow(this.position.y - gameObject.position.y, 2) <= this.visionRangeSquared) {
               switch (gameObject.i) {
                  case "entity": {
                     this.entitiesInVisionRange.add(gameObject);
                     break;
                  }
                  case "droppedItem": {
                     this.droppedItemsInVisionRange.add(gameObject);
                     break;
                  }
               }
               continue;
            }

            // If the test hitbox can 'see' any of the game object's hitboxes, it is visible
            const numHitboxes = gameObject.hitboxes.length;
            for (let j = 0; j < numHitboxes; j++) {
               const hitbox = gameObject.hitboxes[j];
               if (Mob.testHitbox.isColliding(hitbox)) {
                  switch (gameObject.i) {
                     case "entity": {
                        this.entitiesInVisionRange.add(gameObject);
                        break;
                     }
                     case "droppedItem": {
                        this.droppedItemsInVisionRange.add(gameObject);
                        break;
                     }
                  }
                  break;
               }
            }
         }
      }
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

      debugData.debugEntries.push("Current AI type: " + (this.currentAI !== null ? MobAIType[this.currentAI.type] : "none"));

      if (typeof this.currentAI?.addDebugData !== "undefined") {
         this.currentAI.addDebugData(debugData);
      }

      return debugData;
   }

   public getAI<T extends MobAIType>(type: T): AI<T> | null {
      for (const ai of this.ais) {
         if (ai.type === type) {
            return ai as AI<T>;
         }
      }
      return null;
   }
}

export default Mob;