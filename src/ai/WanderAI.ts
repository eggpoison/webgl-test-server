import { SETTINGS, Vector } from "webgl-test-shared";
import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface WanderAIParams extends BaseAIParams {
   /** The average number of times that an entity will wander in a second */
   readonly wanderRate: number;
   readonly acceleration: number;
   readonly terminalVelocity: number;
}

class WanderAI extends AI implements WanderAIParams {
   public readonly wanderRate: number;
   public readonly acceleration: number;
   public readonly terminalVelocity: number;

   constructor(mob: Mob, { aiWeightMultiplier, wanderRate: wanderChance, acceleration, terminalVelocity }: WanderAIParams) {
      super(mob, { aiWeightMultiplier });

      this.wanderRate = wanderChance;
      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
   }

   public tick(): void {
      super.tick();

      // Only wander if not moving
      if (this.mob.velocity === null && Math.random() < this.wanderRate / SETTINGS.TPS) {
         const dist = this.mob.visionRange * Math.random();
         const angle = 2 * Math.PI * Math.random();
         const targetPosition = this.mob.position.add(new Vector(dist, angle).convertToPoint());
         super.moveToPosition(targetPosition, this.acceleration, this.terminalVelocity, angle);
      }
   }

   protected _getWeight(): number {
      return 1;
   }
}

export default WanderAI;