import { circleAndRectangleDoIntersect, circlesDoIntersect, EntityType, GameObjectDebugData, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../../mob-ai/AI";
import Entity, { EntityComponents } from "../Entity";
import Board from "../../Board";
import DroppedItem from "../../items/DroppedItem";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Chunk from "../../Chunk";
import { MobAIType } from "../../mob-ai-types";
import Hitbox from "src/hitboxes/Hitbox";
import RectangularHitbox from "src/hitboxes/RectangularHitbox";
import GameObject from "src/GameObject";

abstract class Mob extends Entity {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_INTERVAL = 4;
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   private readonly visionRangeSquared: number;
   
   private readonly ais = new Array<AI>();
   protected currentAI: AI | null = null;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_INTERVAL - 1);

   public visibleGameObjects = new Array<GameObject>();
   public visibleEntities = new Array<Entity>();
   public visibleDroppedItems = new Array<DroppedItem>();

   private visibleChunks = new Array<Chunk>();

   public readonly potentialVisibleGameObjects = new Array<GameObject>();
   /** The number of times each potential visible game object appears in the mob's visible chunks */
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

   protected addAI(ai: AI): void {
      this.ais.push(ai);
   }

   public tick(): void {
      super.tick();

      // Refresh AI
      if (++this.aiRefreshTicker === Mob.AI_REFRESH_INTERVAL) {
         this.updateVisibleChunks();
         this.updateVisibleGameObjects();
         // @Temporary: If the tribesman starts using AI classes, move this check into the main one just above
         if (this.ais.length > 0) {
            this.refreshAI();
         }
         this.aiRefreshTicker = 0;
      }

      if (this.currentAI !== null) {
         this.currentAI.tick();
      }
   }

   public refreshAI(): void {
      // Find the AI to switch to
      let ai!: AI;
      const numAIs = this.ais.length;
      for (var i = 0; i < numAIs; i++) {
         ai = this.ais[i];
         if (ai.isEnabled && ai.canSwitch()) {
            break;
         }
      }
      if (i === numAIs) {
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
      // @Speed: We can't only run this check when the mob changes visible chunk bounds because the visible chunks isn't a circle.
      // But perhaps there is some other optimisation we can do using visible chunk bounds, so I am leaving some of the earlier
      // stuff here in case it is useful in the future
      
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);

      const thisChunkX = Math.max(Math.min(Math.floor(this.position.x / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      const thisChunkY = Math.max(Math.min(Math.floor(this.position.y / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
      
      const newVisibleChunks = new Array<Chunk>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            // Check if the chunk is actually in the vision range
            // Find the closest point of the chunk border to the mob
            let closestChunkPointX: number;
            let closestChunkPointY: number;
            if (chunkX === thisChunkX) {
               closestChunkPointX = this.position.x;
            } else {
               closestChunkPointX = this.position.x < (chunkX + 0.5) * SETTINGS.CHUNK_UNITS ? chunkX * SETTINGS.CHUNK_UNITS : (chunkX + 1) * SETTINGS.CHUNK_UNITS;
            }
            if (chunkY === thisChunkY) {
               closestChunkPointY = this.position.y;
            } else {
               closestChunkPointY = this.position.y < (chunkY + 0.5) * SETTINGS.CHUNK_UNITS ? chunkY * SETTINGS.CHUNK_UNITS : (chunkY + 1) * SETTINGS.CHUNK_UNITS;
            }

            if (Math.pow(closestChunkPointX - this.position.x, 2) + Math.pow(closestChunkPointY - this.position.y, 2) <= this.visionRangeSquared) {
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
   
   /** Finds all entities within the range of the mob's vision */
   private updateVisibleGameObjects(): void {
      // @Speed: Garbage collection, and likely uses a whole ton of malloc under the hood
      this.visibleGameObjects = [];
      this.visibleEntities = [];
      this.visibleDroppedItems = [];

      for (let i = 0; i < this.potentialVisibleGameObjects.length; i++) {
         const gameObject = this.potentialVisibleGameObjects[i];
         
         if (Math.pow(this.position.x - gameObject.position.x, 2) + Math.pow(this.position.y - gameObject.position.y, 2) <= this.visionRangeSquared) {
            gameObject.addToMobVisibleGameObjects(this);
            continue;
         }

         // If the mob can see any of the game object's hitboxes, it is visible
         const numHitboxes = gameObject.hitboxes.length;
         for (let j = 0; j < numHitboxes; j++) {
            const hitbox = gameObject.hitboxes[j];
            if (this.hitboxIsVisible(hitbox)) {
               gameObject.addToMobVisibleGameObjects(this);
               break;
            }
         }
      }

      this.visibleGameObjects.splice(this.visibleGameObjects.indexOf(this), 1);
      this.visibleEntities.splice(this.visibleEntities.indexOf(this), 1);
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
}

export default Mob;