import { EntityType, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

interface ChaseAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly targetEntityTypes: ReadonlySet<EntityType>;
}

class ChaseAI extends AI implements ChaseAIParams {
   public readonly type = "chase";

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly targetEntityTypes: ReadonlySet<EntityType>;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, targetEntityTypes }: ChaseAIParams) {
      super(mob, { aiWeightMultiplier });

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.targetEntityTypes = targetEntityTypes;
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

      // Move to target
      const angle = this.mob.position.calculateAngleBetween(closestEntity.position);
      this.mob.rotation = angle;
      this.mob.acceleration = new Vector(this.acceleration, this.mob.rotation);
      this.mob.terminalVelocity = this.terminalVelocity;
   }

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): Set<Entity> {
      const filteredEntities = new Set<Entity>();

      for (const entity of visibleEntities) {
         if (this.targetEntityTypes.has(entity.type)) {
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
}

export default ChaseAI;