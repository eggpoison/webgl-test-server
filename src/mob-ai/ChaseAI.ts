import { GameObjectDebugData, SETTINGS } from "webgl-test-shared";
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
      if (this.entitiesInVisionRange.size === 0) return;

      const entitiesInVisionRangeIterator = this.entitiesInVisionRange.values();

      // Find closest target
      let closestEntity = entitiesInVisionRangeIterator.next().value as Entity;
      let minDistance = this.mob.position.calculateDistanceBetween(closestEntity.position);
      for (let currentEntity: Entity; currentEntity = entitiesInVisionRangeIterator.next().value;) {
         const distance = this.mob.position.calculateDistanceBetween(currentEntity.position);
         if (distance < minDistance) {
            closestEntity = currentEntity;
            minDistance = distance;
         }
      }
      this.target = closestEntity;

      // Rotate towards target
      const angle = this.mob.position.calculateAngleBetween(closestEntity.position);
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

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): ReadonlySet<Entity> {
      const filteredEntities = new Set<Entity>();

      for (const entity of visibleEntities) {
         if (this.entityIsChased(entity)) {
            filteredEntities.add(entity);
         }
      }

      return filteredEntities;
   }
   
   protected _getWeight(): number {
      if (this.entitiesInVisionRange.size > 0) {
         return 1;
      }
      return 0;
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

   protected _callCallback(callback: (targetEntity: Entity | null) => void): void {
      callback(this.target);
   }
}

export default ChaseAI;