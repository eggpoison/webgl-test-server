import { Point, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob, { MobAIs } from "../entities/Mob";

export type BaseAIParams = {
   readonly aiWeightMultiplier: number;
};

abstract class AI {
   protected readonly mob: Mob;
   
   public readonly aiWeightMultiplier: number;

   public abstract readonly type: keyof typeof MobAIs;
   protected abstract _getWeight(): number;

   protected isActive: boolean = false;
   protected targetPosition: Point | null = null;
   protected entitiesInVisionRange!: Set<Entity>;

   // Notes to future self:

   // Make "entitiesInVisionRange" public and then don't bother doing distance check
   // if self is already in the test entity's entitiesInVisionRange array

   // Also skip check if entity isn't moving (make sure this works and the velocity
   // property isn't lagging behind

   constructor(mob: Mob, { aiWeightMultiplier }: BaseAIParams) {
      this.mob = mob;
      this.aiWeightMultiplier = aiWeightMultiplier;
   }

   public tick(): void {
      // If the entity has a reached its target position, stop moving
      if (this.hasReachedTargetPosition()) {
         this.targetPosition = null;
         this.mob.acceleration = null;
      }
   }

   public activate(): void {
      this.isActive = true;
      this.targetPosition = null;
      
      if (typeof this.onActivation !== "undefined") this.onActivation();
   }

   public deactivate(): void {
      this.isActive = false;
   }

   protected onActivation?(): void;
   public onDeactivation?(): void;
   public onRefresh?(): void;

   protected filterEntitiesInVisionRange?(visibleEntities: ReadonlySet<Entity>): Set<Entity>;

   public updateValues(entitiesInVisionRange: Set<Entity>): void {
      if (typeof this.filterEntitiesInVisionRange !== "undefined") {
         this.entitiesInVisionRange = this.filterEntitiesInVisionRange(entitiesInVisionRange);
      } else {
         this.entitiesInVisionRange = entitiesInVisionRange;
      }
   }

   public getWeight(): number {
      return this._getWeight() * this.aiWeightMultiplier;
   }

   private hasReachedTargetPosition(): boolean {
      if (this.targetPosition === null || this.mob.velocity === null) return false;

      const relativeTargetPosition = this.mob.position.subtract(this.targetPosition);
      const dotProduct = this.mob.velocity.convertToPoint().dot(relativeTargetPosition);
      return dotProduct > 0;
   }

   protected moveToPosition(targetPosition: Point, acceleration: number, terminalVelocity: number, direction?: number): void {
      const _direction = typeof direction === "undefined" ? this.mob.position.angleBetween(targetPosition) : direction;
      
      this.targetPosition = targetPosition;
      this.mob.acceleration = new Vector(acceleration, _direction);
      this.mob.terminalVelocity = terminalVelocity;
      this.mob.rotation = _direction;
   }
}

export default AI;