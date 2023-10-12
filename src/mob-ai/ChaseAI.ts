import { GameObjectDebugData, HitFlags, SETTINGS } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { MobAIType } from "../mob-ai-types";

interface ChaseAIParams extends BaseAIParams<MobAIType.chase> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly entityIsChased: (entity: Entity) => boolean;
   /** Distance the entity will try to maintain while chasing */
   readonly desiredDistance?: number;
}

class ChaseAI extends AI<MobAIType.chase> implements ChaseAIParams {
   public readonly type = MobAIType.chase;

   public acceleration: number;
   public terminalVelocity: number;
   public desiredDistance?: number;
   public entityIsChased: (entity: Entity) => boolean;

   public target: Entity | null = null;

   constructor(mob: Mob, aiParams: ChaseAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.desiredDistance = aiParams.desiredDistance;
      this.entityIsChased = aiParams.entityIsChased;
   }

   public tick(): void {
      if (this.target === null) {
         return;
      }

      // Rotate towards target
      const angle = this.mob.position.calculateAngleBetween(this.target.position);
      this.mob.rotation = angle;

      // If the entity has a desired distance from its target, try to stop at that desired distance
      if (typeof this.desiredDistance !== "undefined") {
         const stopDistance = this.estimateStopDistance();
         const distance = this.mob.position.calculateDistanceBetween(this.target.position);
         if (distance - stopDistance <= this.desiredDistance) {
            this.mob.acceleration.x = 0;
            this.mob.acceleration.y = 0;
            this.mob.terminalVelocity = 0;
            return;
         }
      }

      // Move to target
      this.mob.acceleration.x = this.acceleration * Math.sin(this.mob.rotation);
      this.mob.acceleration.y = this.acceleration * Math.cos(this.mob.rotation);
      this.mob.terminalVelocity = this.terminalVelocity;
   }

   public onRefresh(): void {
      // Calculate target
      let minDistance = Number.MAX_SAFE_INTEGER
      for (const entity of this.mob.visibleEntities) {
         const distance = this.mob.position.calculateDistanceBetween(entity.position);
         if (distance < minDistance && this.entityIsChased(entity)) {
            minDistance = distance;
            this.target = entity;
         }
      }
      if (minDistance === Number.MAX_SAFE_INTEGER) {
         this.target = null;
      }
   }

   /** Estimates the distance it will take for the entity to stop */
   private estimateStopDistance(): number {
      if (this.mob.velocity === null) {
         return 0;
      }

      // Estimate time it will take for the entity to stop
      const velocityMagnitude = this.mob.velocity.length();
      const stopTime = Math.pow(velocityMagnitude, 0.8) / (3 * SETTINGS.FRICTION_CONSTANT);
      const stopDistance = (Math.pow(stopTime, 2) + stopTime) * velocityMagnitude;
      return stopDistance;
   }

   public onDeactivation(): void {
      this.target = null;
   }

   public canSwitch(): boolean {
      for (const entity of this.mob.visibleEntities) {
         if (this.entityIsChased(entity)) {
            return true;
         }
      }
      return false;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.target === null) return;

      debugData.lines.push(
         {
            targetPosition: this.target.position.package(),
            colour: [0, 0, 1],
            thickness: 2
         }
      );

      if (typeof this.desiredDistance !== "undefined" && this.mob.velocity !== null) {
         const stopDistance = this.estimateStopDistance();

         const velocityLength = this.mob.velocity.length();
         const offsetX = this.mob.velocity.x / velocityLength * stopDistance;
         const offsetY = this.mob.velocity.y / velocityLength * stopDistance;

         const stopPositionX = this.mob.position.x + offsetX;
         const stopPositionY = this.mob.position.y + offsetY;

         debugData.lines.push({
            targetPosition: [stopPositionX, stopPositionY],
            colour: [0, 1, 0.5],
            thickness: 4
         });
      }
   }
}

export default ChaseAI;