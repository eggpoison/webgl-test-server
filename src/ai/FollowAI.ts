import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface HerdAIParams extends BaseAIParams {
   /** Maximum distance to keep from the target */
   readonly maxDistance: number;
}

class FollowAI extends AI implements HerdAIParams {
   public readonly maxDistance: number;

   constructor(mob: Mob, { aiWeightMultiplier, maxDistance }: HerdAIParams) {
      super(mob, { aiWeightMultiplier });

      this.maxDistance = maxDistance;
   }

   public tick(): void {
      super.tick();
   }

   protected _getWeight(): number {
      return 1;
   }
}

export default FollowAI;