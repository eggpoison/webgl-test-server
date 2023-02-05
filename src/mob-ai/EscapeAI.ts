import { SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface EscapeAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly attackSubsideTime: number;
}

class EscapeAI extends AI implements EscapeAIParams {
   public readonly type = "escape";
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly attackSubsideTime: number;

   private attacker: Entity | null = null;
   /** Counts down the time it takes for the mob to forget about the attacker */
   private attackSubsideTimer: number;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, attackSubsideTime }: EscapeAIParams) {
      super(mob, { aiWeightMultiplier });

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.attackSubsideTime = attackSubsideTime;

      this.attackSubsideTimer = attackSubsideTime;

      this.mob.createEvent("hurt", (_1, _2, _3, attackingEntity: Entity | null): void => {
         if (attackingEntity !== null) {
            this.attacker = attackingEntity;
            this.attackSubsideTimer = this.attackSubsideTime;
         }
      });
   }

   public tick(): void {
      super.tick();

      if (this.attacker === null) return;

      // Run away from the attacker
      const direction = this.mob.position.calculateAngleBetween(this.attacker.position) + Math.PI;
      this.mob.acceleration = new Vector(this.acceleration, direction);
      this.mob.terminalVelocity = this.terminalVelocity;
      this.mob.rotation = direction;
   }

   protected _getWeight(): number {
      this.attackSubsideTimer -= Mob.AI_REFRESH_TIME / SETTINGS.TPS;
      if (this.attackSubsideTimer <= 0) {
         this.attacker = null;
      }

      // If the attacker is out of vision range, disable
      if (this.attacker !== null && !this.entitiesInVisionRange.has(this.attacker)) {
         this.attacker = null;
      }

      return this.attacker !== null ? 1 : 0;
   }
}

export default EscapeAI;