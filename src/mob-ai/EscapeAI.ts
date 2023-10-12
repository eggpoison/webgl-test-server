import { GameObjectDebugData, SETTINGS } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { MobAIType } from "../mob-ai-types";

interface EscapeAIParams extends BaseAIParams<MobAIType.escape> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly attackSubsideTime: number;
   /** Maximum health at which the escape AI will attempt to activate */
   readonly escapeHealthThreshold: number
}

class EscapeAI extends AI<MobAIType.escape> implements EscapeAIParams {
   public readonly type = MobAIType.escape;
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly attackSubsideTime: number;
   public readonly escapeHealthThreshold: number;

   private attacker: Entity | null = null;
   /** Counts down the time it takes for the mob to forget about the attacker */
   private attackSubsideTimer: number;

   constructor(mob: Mob, aiParams: EscapeAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.attackSubsideTime = aiParams.attackSubsideTime;
      this.escapeHealthThreshold = aiParams.escapeHealthThreshold;

      this.attackSubsideTimer = aiParams.attackSubsideTime;

      this.mob.createEvent("hurt", (_: unknown, attackingEntity: Entity | null): void => {
         if (attackingEntity === null) return;

         const healthComponent = this.mob.forceGetComponent("health");
         if (healthComponent.getHealth() <= this.escapeHealthThreshold) {
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
      this.mob.acceleration.x = this.acceleration * Math.sin(direction);
      this.mob.acceleration.y = this.acceleration * Math.cos(direction);
      this.mob.terminalVelocity = this.terminalVelocity;
      this.mob.rotation = direction;
   }

   public canSwitch(): boolean {
      this.attackSubsideTimer -= Mob.AI_REFRESH_INTERVAL / SETTINGS.TPS;
      if (this.attackSubsideTimer <= 0) {
         this.attacker = null;
      }

      // If the attacker is out of vision range, disable
      if (this.attacker !== null && !this.entitiesInVisionRange.has(this.attacker)) {
         this.attacker = null;
      }

      return this.attacker !== null;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.attacker === null) return;

      debugData.lines.push(
         {
            targetPosition: this.attacker.position.package(),
            colour: [1, 0, 1],
            thickness: 2
         }
      );
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default EscapeAI;