import { EntityType, Point, randItem, SETTINGS } from "webgl-test-shared";
import Entity from "../entities/Entity";
import AI from "./AI";

/*

Passive Mob AI:
- If not moving, small chance to start moving to a nearby tile
- If a different entity comes near, stare at them
- If hit by entity, start running away from them until out of escape range

Staring:
- If an entity comes close and the mob wants to stare, then the mob will stop moving and stare at the entity
- An entity wants to stare if:
   - Their stare time hasn't expired

*/

interface PassiveMobAIInfo {
   /** Chance that the mob wanders in a second */
   readonly wanderChance: number;
   readonly wanderAcceleration: number;
   readonly wanderTerminalVelocity: number;
   readonly visionRange: number;
   /** Distance that the mob will try to put between them and an attacker before being unstartled */
   readonly escapeRange: number;
   /** Expected number of seconds before the mob chooses an entity to stare at */
   readonly stareLockTime: number;
   /** Max duration of a stare */
   readonly stareTime: number;
   /** Cooldown between stares */
   readonly stareCooldown: number;
}

class PassiveMobAI extends AI {
   /** Chance that the mob wanders in a second */
   private readonly wanderChance: number;
   private readonly wanderAcceleration: number;
   private readonly wanderTerminalVelocity: number;
   private readonly visionRange: number;
   /** Distance that the mob will try to put between them and an attacker before being unstartled */
   private readonly escapeRange: number;
   /** Expected number of seconds before the mob chooses an entity to stare at */
   readonly stareLockTime: number;
   /** Max duration of a stare */
   private readonly stareTime: number;
   /** Cooldown between stares */
   private readonly stareCooldown: number;

   /**
    * If this is greater than 0, the entity will want to stare.
    * While staring, this timer will decrease by 1 each second
    * When not staring, this timer will increase by 1 each second
    * When this timer reaches 0, it will immediately go to -stareCooldown (to make the cooldown work)
    */
   private stareTimer = 0;

   /** Entity the mob is staring at */
   private stareTarget: Entity<EntityType> | null = null;

   constructor(entity: Entity<EntityType>, { wanderChance, wanderAcceleration, wanderTerminalVelocity, visionRange, escapeRange, stareLockTime, stareTime, stareCooldown }: PassiveMobAIInfo) {
      super(entity);

      this.wanderChance = wanderChance;
      this.wanderAcceleration = wanderAcceleration;
      this.wanderTerminalVelocity = wanderTerminalVelocity;
      this.visionRange = visionRange;
      this.escapeRange = escapeRange;
      this.stareLockTime = stareLockTime;
      this.stareTime = stareTime;
      this.stareCooldown = stareCooldown;
   }

   public tick(): void {
      super.tick();

      let nearbyEntities = super.getEntitiesInRadius(this.visionRange);
      // Remove the same type of entity
      nearbyEntities = this.filterEntities(nearbyEntities);

      // If there are nearby entities, stare at them/run away from them
      let canWander = true;
      if (nearbyEntities.length > 0) {
         // Find a stare target
         if (this.stareTarget === null) {
            if (Math.random() < 1 / (this.stareLockTime + Number.EPSILON) / SETTINGS.TPS) {
               const closestEntity = this.calculateClosestEntity(nearbyEntities);
               this.stareTarget = closestEntity;
            }
         }

         if (this.stareTarget !== null && this.wantsToStare()) {
            // Stare at the target
            this.stare(this.stareTarget);

            this.stareTimer -= 1 / SETTINGS.TPS;
            if (this.stareTimer <= 0) {
               this.stareTarget = null;
               this.stareTimer = -this.stareCooldown;
            }
   
            canWander = false;
         // If the mob doesn't want to stare, increase the timer
         } else {
            this.stareTimer += 1 / SETTINGS.TPS;
            if (this.stareTimer + 1 / SETTINGS.TPS >= 0) {
               this.stareTimer = this.stareTime;
            }
         }
      // If there are no nearby entities, slowly increase the stare timer
      } else {
         this.stareTarget = null;
         this.stareTimer += 1 / SETTINGS.TPS;
         if (this.stareTimer > this.stareTime) this.stareTimer = this.stareTime;
      }
      
      // Otherwise try to wander around
      if (canWander) {
         this.wanderAttempt();
      }
   }

   private calculateClosestEntity(entities: Array<Entity<EntityType>>): Entity<EntityType> {
      let minDist: number = Number.MAX_SAFE_INTEGER;
      let closestEntity!: Entity<EntityType>;
      for (const entity of entities) {
         const dist = this.entity.position.distanceFrom(entity.position);
         if (dist < minDist) {
            closestEntity = entity;
         }
      }

      return closestEntity;
   }

   private wantsToStare(): boolean {
      return this.stareTimer > 0;
   }

   /**
    * Rotates the mob to stare at an entity
    * @param entity The entity to stare at
    */
   private stare(entity: Entity<EntityType>): void {
      const angle = this.entity.position.angleBetween(entity.position);

      this.entity.rotation = angle;
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