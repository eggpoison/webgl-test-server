import { GameObjectDebugData, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";

interface ChaseAIParams extends BaseAIParams<"chase"> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly entityIsChased: (entity: Entity) => boolean;
   /** Distance the entity will try to maintain while chasing */
   readonly desiredDistance?: number;
}

class ChaseAI extends AI<"chase"> implements ChaseAIParams {
   public readonly type = "chase";

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly desiredDistance?: number;
   public entityIsChased: (entity: Entity) => boolean;

   private target: Entity | null = null;

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
      for (var currentEntity: Entity; currentEntity = entitiesInVisionRangeIterator.next().value;) {
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
            this.mob.acceleration = null;
            this.mob.terminalVelocity = 0;
            return;
         }
      }

      // Move to target
      this.mob.acceleration = new Vector(this.acceleration, this.mob.rotation);
      this.mob.terminalVelocity = this.terminalVelocity;
   }

   /** Estimates the distance it will take for the entity to stop */
   private estimateStopDistance(): number {
      if (this.mob.velocity === null) {
         return 0;
      }

      // Estimate time it will take for the entity to stop
      const stopTime = Math.pow(this.mob.velocity.magnitude, 0.8) / (3 * SETTINGS.FRICTION_CONSTANT);
      const stopDistance = (Math.pow(stopTime, 2) + stopTime) * this.mob.velocity.magnitude;
      return stopDistance
   }

   public onDeactivation(): void {
      this.target = null;
   }

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): Set<Entity> {
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

   public getChaseTarget(): Entity | null {
      return this.target;
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

         const stopPosition = this.mob.position.copy();
         const offset = new Vector(stopDistance, this.mob.velocity.direction).convertToPoint();
         stopPosition.add(offset);

         debugData.lines.push({
            targetPosition: stopPosition.package(),
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