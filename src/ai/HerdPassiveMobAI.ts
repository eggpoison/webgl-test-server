import { EntityType } from "webgl-test-shared";
import Entity from "../entities/Entity";
import PassiveMobAI, { PassiveMobAIInfo } from "./PassiveMobAI";

/*

(effectively just a modified boid system) (why did i reinvent the wheel)

Herd Passive Mob AI:
   - Herd members try not to stray too far from each other
   - Try to orientate themselves in the direction of nearby herd members
   - If too close to another herd member, will change direction to move away
*/

interface HerdPassiveMobAIInfo extends PassiveMobAIInfo {
   
}

class HerdPassiveMobAI extends PassiveMobAI {
   private readonly herdValidationFunction: (entity: Entity<EntityType>) => boolean;

   constructor(entity: Entity<EntityType>, info: HerdPassiveMobAIInfo, herdValidationFunction: (entity: Entity<EntityType>) => boolean) {
      super(entity, info);

      this.herdValidationFunction = herdValidationFunction;
   }

   public tick(): void {
      // 
      // Prioritise the herd AI first, then wandering second
      // 
      
      const nearbyEntities = super.getEntitiesInRadius(this.visionRange);
      const nearbyHerdMembers = this.filterHerdMembers(nearbyEntities);

      const [closestHerdMember, minHerdMemberDistance] = this.findClosestHerdMember(nearbyHerdMembers);

      // 1. Move away from herd members who are too close

      // 2. Move closer to herd members if too far away

      // 3. Orientate to nearby herd members
   }

   private filterHerdMembers(entities: ReadonlyArray<Entity<EntityType>>): ReadonlyArray<Entity<EntityType>> {
      return entities.filter(entity => this.herdValidationFunction(entity));
   }

   private findClosestHerdMember(entities: ReadonlyArray<Entity<EntityType>>): [closestHerdMember: Entity<EntityType>, minHerdMemberDistance: number] {
      
   }
}

export default HerdPassiveMobAI;