import Mob, { MobType } from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface HerdAIParams extends BaseAIParams {
   /** Minimum distance from other members to try and maintain */
   readonly minSeperationDistance: number;
   /** Rate at which the mob turns */
   readonly turnRate: number;
   /** Mobs which can be classified as herd members */
   readonly validHerdMembers: ReadonlySet<MobType>;
}

class HerdAI extends AI implements HerdAIParams {
   public readonly minSeperationDistance: number;
   public readonly turnRate: number;
   public readonly validHerdMembers: ReadonlySet<MobType>;

   constructor(mob: Mob, { aiWeightMultiplier, minSeperationDistance, turnRate, validHerdMembers }: HerdAIParams) {
      super(mob, { aiWeightMultiplier });
      
      this.minSeperationDistance = minSeperationDistance;
      this.turnRate = turnRate;
      this.validHerdMembers = validHerdMembers;
   }

   public tick(): void {
      super.tick();
   }

   protected _getWeight(): number {
      return 1;
   }
}

export default HerdAI;