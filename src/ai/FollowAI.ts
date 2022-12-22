import { EntityType, randItem, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface HerdAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Maximum distance to keep from the target */
   readonly minDistanceFromFollowTarget: number;
   /** Time it takes for the weight to build from 0 -> 1 when not staring */
   readonly weightBuildupTime: number;
   /** How long the mob can hold their attention on the entity before becoming disinterested */
   readonly interestDuration: number;
   /** Chance for the mob to start following a target in a second */
   readonly chanceToGainInterest?: number;
   /** Entities to avoid following */
   readonly entityTypesToExclude: ReadonlySet<EntityType>;
}

class FollowAI extends AI implements HerdAIParams {
   public readonly type = "follow";
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly minDistanceFromFollowTarget: number;
   public readonly weightBuildupTime: number;
   public readonly interestDuration: number;
   public readonly chanceToGainInterest?: number;
   public readonly entityTypesToExclude: ReadonlySet<EntityType>;

   private followTarget: Entity | null = null;

   private weight = 0;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, minDistanceFromFollowTarget, weightBuildupTime, interestDuration, chanceToGainInterest, entityTypesToExclude }: HerdAIParams) {
      super(mob, { aiWeightMultiplier });

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.minDistanceFromFollowTarget = minDistanceFromFollowTarget;
      this.weightBuildupTime = weightBuildupTime;
      this.interestDuration = interestDuration;
      this.chanceToGainInterest = chanceToGainInterest;
      this.entityTypesToExclude = entityTypesToExclude;
   }

   public tick(): void {
      super.tick();

      if (this.followTarget !== null) {
         const distanceFromTarget = this.mob.position.calculateDistanceBetween(this.followTarget.position);
         const dir = this.mob.position.calculateAngleBetween(this.followTarget.position);

         if (distanceFromTarget > this.minDistanceFromFollowTarget) {
            // Follow the target if far away enough
            this.mob.acceleration = new Vector(this.acceleration, dir);
            this.mob.terminalVelocity = this.terminalVelocity;
         } else {
            // If too close to the target, don't move any closer
            this.mob.acceleration = null;
         }

         // Always stare at the target
         this.mob.rotation = dir;
      } else {
         // If has no target, don't move
         this.mob.acceleration = null;
      }
   }

   // On activation, pick a random nearby entity and stare at it
   public onActivation(): void {
      if (this.entitiesInVisionRange.size === 0) throw new Error("Entities in vision range is empty for some reason :/");

      this.followTarget = randItem(Array.from(this.entitiesInVisionRange));
   }

   public onRefresh(): void {
      if (this.followTarget === null) return;
      
      // If the target has gone out of range, stop following it
      if (!this.entitiesInVisionRange.has(this.followTarget)) {
         this.followTarget = null;
      }
   }

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): Set<Entity> {
      const filteredEntities = new Set<Entity>(visibleEntities);

      for (const entity of filteredEntities) {
         if (this.entityTypesToExclude.has(entity.type)) {
            filteredEntities.delete(entity);
         }
      }

      return filteredEntities;
   }

   // The more the entity wants to stare, the more weight it has
   protected _getWeight(): number {
      if (this.isActive && this.followTarget !== null) {
         this.weight -= Mob.AI_REFRESH_TIME / this.interestDuration / SETTINGS.TPS;
         if (this.weight <= 0) {
            return 0;
         }
         return 1;
      }

      this.weight += Mob.AI_REFRESH_TIME / this.weightBuildupTime / SETTINGS.TPS;
      if (this.weight > 1) {
         this.weight = 1;
      }

      if (this.entitiesInVisionRange.size === 0 || (this.isActive && this.followTarget === null)) {
         return 0;
      }

      if (typeof this.chanceToGainInterest !== "undefined" && Math.random() >= this.chanceToGainInterest / SETTINGS.TPS * Mob.AI_REFRESH_TIME) {
         return 0;
      }
      return this.weight;
   }
}

export default FollowAI;