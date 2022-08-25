import { EntityType, Point, randItem, SETTINGS } from "webgl-test-shared";
import Entity from "../entities/Entity";
import AI from "./AI";

/*

Passive Mob AI:
- If not moving, small chance to start moving to a nearby tile
- If a different entity comes near, stare at them
- If hit by entity, start running away from them until out of escape range

*/

class PassiveMobAI extends AI {
   /** Chance that the mob wanders in a second */
   private readonly wanderChance: number;
   private readonly wanderAcceleration: number;
   private readonly wanderTerminalVelocity: number;
   private readonly visionRange: number;
   /** Distance that the mob will try to put between them and an attacker before being unstartled */
   private readonly escapeRange: number;

   constructor(entity: Entity<EntityType>, moveChance: number, wanderAcceleration: number, wanderTerminalVelocity: number, visionRange: number, escapeRange: number) {
      super(entity);

      this.wanderChance = moveChance;
      this.wanderAcceleration = wanderAcceleration;
      this.wanderTerminalVelocity = wanderTerminalVelocity;
      this.visionRange = visionRange;
      this.escapeRange = escapeRange;
   }

   public tick(): void {
      super.tick();

      const nearbyEntities = super.getEntitiesInRadius(this.visionRange);
      // Remove the same type of entity
      const otherEntities = this.filterEntities(nearbyEntities);

      // If there are nearby entities, stare at them/run away from them
      if (otherEntities.length > 0) {

      // Otherwise try to wander around
      } else {
         this.wanderAttempt();
      }
   }

   private wanderAttempt(): void {
      // Don't wander to a new location if already wandering
      if (this.targetPosition !== null) return;

      if (Math.random() <= this.wanderChance / SETTINGS.TPS) {
         this.wander();
      }
   }

   private wander() {
      // Find nearby potential tiles
      const tileRange = Math.floor(this.visionRange / SETTINGS.TILE_SIZE);
      const nearbyTileCoordinates = super.findNearbyTileCoordinates(tileRange);

      // Find the target
      const targetTileCoordinates = randItem(nearbyTileCoordinates);
      const targetX = (targetTileCoordinates[0] + 0.5) * SETTINGS.TILE_SIZE;
      const targetY = (targetTileCoordinates[1] + 0.5) * SETTINGS.TILE_SIZE;
      const targetPosition = new Point(targetX, targetY);

      super.moveToPosition(targetPosition, this.wanderAcceleration, this.wanderTerminalVelocity);
   }

   /**
    * Removes entities of a different type from an array of entities
    */
   private filterEntities(entities: Array<Entity<EntityType>>): Array<Entity<EntityType>> {
      const filteredEntities = entities.slice();

      // Remove entities of a different type
      for (let idx = filteredEntities.length - 1; idx >= 0; idx--) {
         const entity = filteredEntities[idx];
         if (entity.type === this.entity.type) filteredEntities.splice(idx, 1);
      }

      return filteredEntities;
   }
}

export default PassiveMobAI;