import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface EscapeAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
}

class EscapeAI extends AI implements EscapeAIParams {
   public readonly type = "escape";
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity }: EscapeAIParams) {
      super(mob, { aiWeightMultiplier });

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
   }

   public tick(): void {
      super.tick();
   }

   protected _getWeight(): number {
      return 1;
   }
}

export default EscapeAI;