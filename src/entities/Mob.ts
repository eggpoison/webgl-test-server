import { EntityType, Point, Vector } from "webgl-test-shared";
import AI from "../ai/AI";
import EscapeAI from "../ai/EscapeAI";
import FollowAI from "../ai/FollowAI";
import GrazeAI from "../ai/StarveAI";
import HerdAI from "../ai/HerdAI";
import WanderAI from "../ai/WanderAI";
import MOB_AI_DATA_RECORD, { MobAICreationInfo } from "../data/mob-ai-data";
import Entity, { Components } from "./Entity";

type NarrowEntityType<E extends EntityType> = E;
export type MobType = NarrowEntityType<"cow">;

export const MobAIs = {
   wander: WanderAI,
   follow: FollowAI,
   herd: HerdAI,
   graze: GrazeAI,
   escape: EscapeAI
}

type MobAIEntry<T extends keyof typeof MobAIs> = [T, ConstructorParameters<typeof MobAIs[T]>[1]];

export interface MobInfo {
   readonly visionRange: number;
}

abstract class Mob extends Entity implements MobInfo {
   /** Number of ticks between AI refreshes */
   private static readonly AI_REFRESH_TIME = 4;
   
   /** Number of units that the mob can see for */
   public readonly visionRange: number;
   
   private readonly ais: Set<AI>;
   private currentAI!: AI;

   /** Used to further distinguish between herd members in the HerdAI AI component */
   public readonly herdMemberHash?: number;

   private aiRefreshTicker = 0;

   constructor(type: MobType, position: Point, velocity: Vector | null, acceleration: Vector | null, rotation: number, components: Partial<Components>, id?: number) {
      super(type, position, velocity, acceleration, rotation, components, id);

      const mobData = MOB_AI_DATA_RECORD[type];

      this.visionRange = mobData.info.visionRange;
      
      this.ais = this.createAIs(mobData.aiCreationInfo);
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
      this.currentAI = this.calculateCurrentAI();
   }

   /** Finds the AI with highest weight */
   private calculateCurrentAI(): AI {
      let currentAI!: AI;
      let maxWeight = -1;
      for (const ai of this.ais) {
         const weight = ai.getWeight();
         if (weight > maxWeight) {
            maxWeight = weight;
            currentAI = ai;
         }
      }
      return currentAI;
   }
}

export default Mob;