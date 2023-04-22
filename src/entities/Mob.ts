import { EntityType, HitboxType, Point, randInt, SETTINGS } from "webgl-test-shared";
import AI from "../mob-ai/AI";
import EscapeAI from "../mob-ai/EscapeAI";
import FollowAI from "../mob-ai/FollowAI";
import StarveAI from "../mob-ai/StarveAI";
import HerdAI from "../mob-ai/HerdAI";
import WanderAI from "../mob-ai/WanderAI";
import Entity, { Components } from "./Entity";
import { SERVER } from "../server";
import ChaseAI from "../mob-ai/ChaseAI";
import Hitbox from "../hitboxes/Hitbox";

export const MobAIs = {
   wander: WanderAI,
   follow: FollowAI,
   herd: HerdAI,
   starve: StarveAI,
   escape: EscapeAI,
   chase: ChaseAI
}

type MobAIEntry<T extends keyof typeof MobAIs> = [T, ConstructorParameters<typeof MobAIs[T]>[1]];

export interface MobInfo {
   readonly visionRange: number;
}

export type MobAICreationInfo = Partial<{ [T in keyof typeof MobAIs]: ConstructorParameters<typeof MobAIs[T]>[1] }>;

export type MobAIData = {
   readonly info: MobInfo;
   readonly aiCreationInfo: MobAICreationInfo;
}
abstract class Mob extends Entity implements MobInfo {
   /** Number of ticks between AI refreshes */
   public static readonly AI_REFRESH_TIME = 4;
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   
   private readonly ais: Set<AI>;
   private currentAI!: AI;

   /** Used to further distinguish between herd members in the HerdAI AI component */
   public readonly herdMemberHash?: number;

   private aiRefreshTicker = randInt(0, Mob.AI_REFRESH_TIME - 1);
   
   constructor(position: Point, components: Partial<Components>, entityType: EntityType, aiData: MobAIData) {
      super(position, components, entityType);

      this.visionRange = aiData.info.visionRange;
      
      this.ais = this.createAIs(aiData.aiCreationInfo);
      this.refreshAI();
   }

   private createAIs(aiCreationInfo: MobAICreationInfo): Set<AI> {
      const ais = new Set<AI>();

      const entries = Object.entries(aiCreationInfo) as Array<MobAIEntry<keyof MobAICreationInfo>>;
      for (const [aiKey, params] of entries) {
         const constructor = MobAIs[aiKey];
         const ai = new constructor(this as any, params as any);
         ais.add(ai);
      }

      return ais;
   }

   public tick(): void {
      super.tick();

      // Refresh AI
      if (++this.aiRefreshTicker === Mob.AI_REFRESH_TIME) {
         this.refreshAI();
         this.aiRefreshTicker = 0;
      }

      this.currentAI.tick();
   }

   public refreshAI(): void {
      const entitiesInVisionRange = this.calculateEntitiesInVisionRange();

      // Update the values of all AI's
      for (const ai of this.ais) {
         ai.updateValues(entitiesInVisionRange);
      }

      // The new AI is the one with the highest weight.
      const newAI = this.findAIWithHighestWeight();

      // If the AI is new, activate the AI
      if (newAI !== this.currentAI) {
         newAI.activate();
         if (typeof this.currentAI !== "undefined") {
            this.currentAI.deactivate();
            if (typeof this.currentAI.onDeactivation !== "undefined") this.currentAI.onDeactivation();
         }
      }
      
      if (typeof newAI.onRefresh !== "undefined") newAI.onRefresh();
      
      this.currentAI = newAI;
   }

   private findAIWithHighestWeight(): AI {
      let aiWithHighestWeight!: AI;
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
            const chunk = SERVER.board.getChunk(chunkX, chunkY);
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

   public getCurrentAIType(): keyof typeof MobAIs {
      return this.currentAI.type;
   }
}

export default Mob;