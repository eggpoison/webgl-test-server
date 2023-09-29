import { EntityType, GameObjectDebugData, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../../mob-ai/AI";
import Entity, { EntityComponents } from "../Entity";
import Board from "../../Board";
import { AIType } from "../../mob-ai/ai-types";
import DroppedItem from "../../items/DroppedItem";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HitboxObject } from "../../hitboxes/Hitbox";

abstract class Mob extends Entity {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_TIME = 4;

   private static readonly testHitbox = new CircularHitbox();
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   
   private readonly ais = new Array<AI<AIType>>();
   private currentAI: AI<AIType> | null = null;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_TIME - 1);

   private aiParams: Record<string, number> = {};

   protected entitiesInVisionRange = new Set<Entity>();
   public droppedItemsInVisionRange = new Set<DroppedItem>();
   
   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType, visionRange: number) {
      super(position, components, entityType);

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
      
      this.updateGameObjectsInVisionRange();

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
   private updateGameObjectsInVisionRange(): void {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + this.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const tempHitboxObject: HitboxObject = {
         position: this.position.copy(),
         rotation: 0
      };
      Mob.testHitbox.setHitboxInfo(this.visionRange);
      Mob.testHitbox.setHitboxObject(tempHitboxObject);
      Mob.testHitbox.updatePosition();
      Mob.testHitbox.updateHitboxBounds();
      
      this.entitiesInVisionRange = new Set<Entity>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const droppedItem of chunk.getGameObjects()) {
               // Don't add existing game objects
               if ((droppedItem.i === "entity" && this.entitiesInVisionRange.has(droppedItem)) || (droppedItem.i === "droppedItem" && this.droppedItemsInVisionRange.has(droppedItem)) || droppedItem === this) continue;

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
      debugData.circles.push(
         {
            radius: this.visionRange,
            colour: [1, 0, 1],
            thickness: 2
         }
         );
      }

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