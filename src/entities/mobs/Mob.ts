import { EntityType, GameObjectDebugData, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../../mob-ai/AI";
import Entity, { EntityComponents } from "../Entity";
import Board from "../../Board";
import { AIType } from "../../mob-ai/ai-types";
import DroppedItem from "../../items/DroppedItem";

abstract class Mob extends Entity {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_TIME = 4;
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   
   private readonly ais = new Array<AI<AIType>>();
   private currentAI: AI<AIType> | null = null;

   /** Used to further distinguish between herd members in the HerdAI AI component */
   public readonly herdMemberHash?: number;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_TIME - 1);

   private aiParams: Record<string, number> = {};

   protected entitiesInVisionRange = new Set<Entity>();
   public droppedItemsInVisionRange = new Set<DroppedItem>();
   
   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType, visionRange: number, isNaturallySpawned: boolean) {
      super(position, components, entityType, isNaturallySpawned);

      this.visionRange = visionRange;
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
      
      this.entitiesInVisionRange = this.calculateEntitiesInVisionRange();
      // this.droppedItemsInVisionRange = this.calculateDroppedItemsInVisionRange();

      // Update the values of all AI's
      for (const ai of this.ais) {
         ai.updateValues(this.entitiesInVisionRange);
      }

      // The new AI is the one with the highest weight.
      const newAI = this.findAIWithHighestWeight();

      // If the AI is new, activate the AI
      if (newAI !== this.currentAI) {
         newAI.activate();
         if (this.currentAI !== null) {
            this.currentAI.deactivate();
            if (typeof this.currentAI.onDeactivation !== "undefined") this.currentAI.onDeactivation();
         }
      }
      
      if (typeof newAI.onRefresh !== "undefined") newAI.onRefresh();
      
      this.currentAI = newAI;
   }

   private findAIWithHighestWeight(): AI<AIType> {
      let aiWithHighestWeight!: AI<AIType>;
      let maxWeight = -1;

      for (const ai of this.ais) {
         const weight = ai.getWeight();
         if (weight > maxWeight) {
            maxWeight = weight;
            aiWithHighestWeight = ai;
         }
      }

      return aiWithHighestWeight;
   }

   /** Finds all entities within the range of the mob's vision */
   private calculateEntitiesInVisionRange(): Set<Entity> {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const entitiesInVisionRange = new Set<Entity>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.getEntities()) {
               // Don't add existing entities
               if (entitiesInVisionRange.has(entity)) continue;

               if (Math.pow(this.position.x - entity.position.x, 2) + Math.pow(this.position.y - entity.position.y, 2) <= Math.pow(this.visionRange, 2)) {
                  entitiesInVisionRange.add(entity);
               }
            }
         }  
      }

      // Remove self from entities in vision
      entitiesInVisionRange.delete(this);

      return entitiesInVisionRange;
   }

   /** Finds all entities within the range of the mob's vision */
   private calculateDroppedItemsInVisionRange(): Set<DroppedItem> {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const droppedItemsInVisionRange = new Set<DroppedItem>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const droppedItem of chunk.getDroppedItems()) {
               // Don't add existing entities
               if (droppedItemsInVisionRange.has(droppedItem)) continue;

               if (Math.pow(this.position.x - droppedItem.position.x, 2) + Math.pow(this.position.y - droppedItem.position.y, 2) <= Math.pow(this.visionRange, 2)) {
                  droppedItemsInVisionRange.add(droppedItem);
               }
            }
         }  
      }

      return droppedItemsInVisionRange;
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
      debugData.circles.push(
         {
            radius: this.visionRange,
            colour: [1, 0, 1],
            thickness: 2
         }
      );

      if (typeof this.currentAI?.addDebugData !== "undefined") {
         this.currentAI.addDebugData(debugData);
      }

      return debugData;
   }
}

export default Mob;