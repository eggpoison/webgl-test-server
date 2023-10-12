import { circleAndRectangleDoIntersect, circlesDoIntersect, EntityType, GameObjectDebugData, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../../mob-ai/AI";
import Entity, { EntityComponents } from "../Entity";
import Board from "../../Board";
import DroppedItem from "../../items/DroppedItem";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Chunk from "../../Chunk";
import { MobAIType } from "../../mob-ai-types";
import { GameObject } from "src/GameObject";
import Hitbox from "src/hitboxes/Hitbox";
import RectangularHitbox from "src/hitboxes/RectangularHitbox";

abstract class Mob extends Entity {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_INTERVAL = 4;
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   private readonly visionRangeSquared: number;
   
   private readonly ais = new Array<AI<MobAIType>>();
   protected currentAI: AI<MobAIType> | null = null;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_INTERVAL - 1);

   private gameObjectsInVisionRange = new Array<GameObject>();
   protected readonly entitiesInVisionRange = new Set<Entity>();
   public readonly droppedItemsInVisionRange = new Set<DroppedItem>();

   private visibleChunks = new Array<Chunk>();

   public readonly potentialVisibleGameObjects = new Array<GameObject>();
   public readonly potentialVisibleGameObjectAppearances = new Array<number>();

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
      if (++this.aiRefreshTicker === Mob.AI_REFRESH_INTERVAL && this.ais.length > 0) {
         this.refreshAI();
         this.aiRefreshTicker = 0;
      }

      if (this.currentAI !== null) {
         this.currentAI.tick();
         this.currentAI.callCallback();
      }
   }

   public refreshAI(): void {
      this.updateVisibleChunks();
      this.updateVisibleGameObjects();

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
         }
      }
      
      if (typeof ai.onRefresh !== "undefined") ai.onRefresh();
      
      this.currentAI = ai;
   }

   private updateVisibleChunks(): void {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);

      if (minChunkX !== this.lastMinVisibleChunkX || maxChunkX !== this.lastMaxVisibleChunkX || minChunkY !== this.lastMinVisibleChunkY || maxChunkY !== this.lastMaxVisibleChunkY) {
         const newVisibleChunks = new Array<Chunk>();
         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               // Check if the chunk is actually in the vision range
               // Find the closest vertex of the chunk to the mob
               const x = this.position.x < (chunkX + 0.5) * SETTINGS.CHUNK_UNITS ? chunkX * SETTINGS.CHUNK_UNITS : (chunkX + 1) * SETTINGS.CHUNK_UNITS;
               const y = this.position.y < (chunkY + 0.5) * SETTINGS.CHUNK_UNITS ? chunkY * SETTINGS.CHUNK_UNITS : (chunkY + 1) * SETTINGS.CHUNK_UNITS;
   
               if (Math.pow(x - this.position.x, 2) + Math.pow(y - this.position.y, 2) <= this.visionRangeSquared) {
                  newVisibleChunks.push(Board.getChunk(chunkX, chunkY));
               }
            }
         }

         // Find all chunks which aren't present in the new chunks and remove them
         for (const chunk of this.visibleChunks) {
            if (newVisibleChunks.indexOf(chunk) === -1) {
               // Remove previously visible chunk
               chunk.viewingMobs.splice(chunk.viewingMobs.indexOf(this), 1);
               this.visibleChunks.splice(this.visibleChunks.indexOf(chunk), 1);

               // Remove game objects in the chunk from the potentially visible list
               const numGameObjects = chunk.gameObjects.length;
               for (let i = 0; i < numGameObjects; i++) {
                  const gameObject = chunk.gameObjects[i];
                  const idx = this.potentialVisibleGameObjects.indexOf(gameObject);
                  this.potentialVisibleGameObjectAppearances[idx]--;
                  if (this.potentialVisibleGameObjectAppearances[idx] === 0) {
                     this.potentialVisibleGameObjects.splice(idx, 1);
                     this.potentialVisibleGameObjectAppearances.splice(idx, 1);
                  }
               }
            }
         }
   
         // Add all new chunks
         for (const chunk of newVisibleChunks) {
            if (this.visibleChunks.indexOf(chunk) === -1) {
               // Add new visible chunk
               chunk.viewingMobs.push(this);
               this.visibleChunks.push(chunk);

               // Add existing game objects to the potentially visible list
               const numGameObjects = chunk.gameObjects.length;
               for (let i = 0; i < numGameObjects; i++) {
                  const gameObject = chunk.gameObjects[i];
                  const idx = this.potentialVisibleGameObjects.indexOf(gameObject);
                  if (idx === -1) {
                     this.potentialVisibleGameObjects.push(gameObject);
                     this.potentialVisibleGameObjectAppearances.push(1);
                  } else {
                     this.potentialVisibleGameObjectAppearances[idx]++;
                  }
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
   private updateVisibleGameObjects(): void {
      this.gameObjectsInVisionRange = [this];
      this.entitiesInVisionRange.clear();
      this.droppedItemsInVisionRange.clear();

      const numPotentialGameObjects = this.potentialVisibleGameObjects.length;
      for (let i = 0; i < numPotentialGameObjects; i++) {
         const gameObject = this.potentialVisibleGameObjects[i];
         // Don't add existing game objects
         if (this.gameObjectsInVisionRange.indexOf(gameObject) !== -1) {
            continue;
         }

         if (Math.pow(this.position.x - gameObject.position.x, 2) + Math.pow(this.position.y - gameObject.position.y, 2) <= this.visionRangeSquared) {
            this.gameObjectsInVisionRange.push(gameObject);
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
            if (this.hitboxIsVisible(hitbox)) {
               this.gameObjectsInVisionRange.push(gameObject);
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

      this.gameObjectsInVisionRange.splice(this.gameObjectsInVisionRange.indexOf(this));
   }

   private hitboxIsVisible(hitbox: Hitbox): boolean {
      // @Speed: This check is slow
      if (hitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circlesDoIntersect(this.position, this.visionRange, hitbox.position, (hitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersect(this.position, this.visionRange, hitbox.position, (hitbox as RectangularHitbox).width, (hitbox as RectangularHitbox).height, (hitbox as RectangularHitbox).rotation);
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