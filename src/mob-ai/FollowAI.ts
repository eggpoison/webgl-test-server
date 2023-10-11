import { EntityType, GameObjectDebugData, randItem, SETTINGS } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { MobAIType } from "../mob-ai-types";

interface HerdAIParams extends BaseAIParams<MobAIType.follow> {
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
   /** All entity types which the entity is able to follow */
   readonly followableEntityTypes: ReadonlySet<EntityType>;
}

class FollowAI extends AI<MobAIType.follow> implements HerdAIParams {
   public readonly type = MobAIType.follow;
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly minDistanceFromFollowTarget: number;
   public readonly weightBuildupTime: number;
   public readonly interestDuration: number;
   public readonly chanceToGainInterest?: number;
   public readonly followableEntityTypes: ReadonlySet<EntityType>;

   private followTarget: Entity | null = null;

   private weight = 0;

   constructor(mob: Mob, aiParams: HerdAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.minDistanceFromFollowTarget = aiParams.minDistanceFromFollowTarget;
      this.weightBuildupTime = aiParams.weightBuildupTime;
      this.interestDuration = aiParams.interestDuration;
      this.chanceToGainInterest = aiParams.chanceToGainInterest;
      this.followableEntityTypes = aiParams.followableEntityTypes;
   }

   public tick(): void {
      super.tick();

      if (this.followTarget !== null) {
         const distanceFromTarget = this.mob.position.calculateDistanceBetween(this.followTarget.position);
         const dir = this.mob.position.calculateAngleBetween(this.followTarget.position);

         if (distanceFromTarget > this.minDistanceFromFollowTarget) {
            // Follow the target if far away enough
            this.mob.acceleration.x = this.acceleration * Math.sin(dir);
            this.mob.acceleration.y = this.acceleration * Math.cos(dir);
            this.mob.terminalVelocity = this.terminalVelocity;
         } else {
            // If too close to the target, don't move any closer
            this.mob.acceleration.x = 0;
            this.mob.acceleration.y = 0;
         }

         // Always stare at the target
         this.mob.rotation = dir;
      } else {
         // If has no target, don't move
         this.mob.acceleration.x = 0;
         this.mob.acceleration.y = 0;
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

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): ReadonlySet<Entity> {
      const filteredEntities = new Set<Entity>();

      for (const entity of visibleEntities) {
         if (this.followableEntityTypes.has(entity.type)) {
            filteredEntities.add(entity);
         }
      }

      return filteredEntities;
   }

   // The more the entity wants to stare, the more weight it has
   protected _getWeight(): number {
      if (this.isActive && this.followTarget !== null) {
         this.weight -= Mob.AI_REFRESH_INTERVAL / this.interestDuration / SETTINGS.TPS;
         if (this.weight <= 0) {
            return 0;
         }
         return 1;
      }

      this.weight += Mob.AI_REFRESH_INTERVAL / this.weightBuildupTime / SETTINGS.TPS;
      if (this.weight > 1) {
         this.weight = 1;
      }

      if (this.entitiesInVisionRange.size === 0 || (this.isActive && this.followTarget === null)) {
         return 0;
      }

      if (typeof this.chanceToGainInterest !== "undefined" && Math.random() >= this.chanceToGainInterest / SETTINGS.TPS * Mob.AI_REFRESH_INTERVAL) {
         return 0;
      }
      return this.weight;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.followTarget === null) return;

      debugData.lines.push(
         {
            targetPosition: this.followTarget.position.package(),
            colour: [0, 0, 1],
            thickness: 2
         }
      );
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default FollowAI;