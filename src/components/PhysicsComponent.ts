import { SettingsConst, TILE_FRICTIONS, TILE_MOVE_SPEED_MULTIPLIERS, TileTypeConst } from "webgl-test-shared";
import Entity from "../Entity";
import { ComponentArray } from "./ComponentArray";

// @Cleanup: Variable names
const a = new Array<number>();
const b = new Array<number>();
for (let i = 0; i < 8; i++) {
   const angle = i / 4 * Math.PI;
   a.push(Math.sin(angle));
   b.push(Math.cos(angle));
}

/** Anything to do with entities moving */
export class PhysicsComponent {
   public moveSpeedMultiplier = 1 + Number.EPSILON;

   /** If set to false, the game object will not experience friction from moving over tiles. */
   public isAffectedByFriction;

   /** Whether the game object's position has changed during the current tick or not. Used during collision detection to avoid unnecessary collision checks */
   public positionIsDirty = false;

   constructor(isAffectedByFriction: boolean) {
      this.isAffectedByFriction = isAffectedByFriction;
   }
}

export const PhysicsComponentArray = new ComponentArray<PhysicsComponent>();

const applyPhysics = (entity: Entity): void => {
   // @Speed: There are a whole bunch of conditions in here which rely on physicsComponent.isAffectedByFriction,
   // which is only set at the creation of an entity. To remove these conditions we could probably split the physics
   // entities into two groups, and call two different applyPhysicsFriction and applyPhysicsNoFriction functions to
   // the corresponding groups
   
   const physicsComponent = PhysicsComponentArray.getComponent(entity);

   // @Temporary @Hack
   if (isNaN(entity.velocity.x) || isNaN(entity.velocity.x)) {
      console.warn("Entity type " + entity.type + " velocity was NaN.");
      entity.velocity.x = 0;
      entity.velocity.y = 0;
   }

   // Apply acceleration
   if (entity.acceleration.x !== 0 || entity.acceleration.y !== 0) {
      // @Speed: very complicated logic
      let moveSpeedMultiplier: number;
      if (entity.overrideMoveSpeedMultiplier || !physicsComponent.isAffectedByFriction) {
         moveSpeedMultiplier = 1;
      } else if (entity.tile.type === TileTypeConst.water && !entity.isInRiver) {
         moveSpeedMultiplier = physicsComponent.moveSpeedMultiplier;
      } else {
         moveSpeedMultiplier = TILE_MOVE_SPEED_MULTIPLIERS[entity.tile.type] * physicsComponent.moveSpeedMultiplier;
      }

      const friction = TILE_FRICTIONS[entity.tile.type];
      
      // @Speed: A lot of multiplies
      entity.velocity.x += entity.acceleration.x * friction * moveSpeedMultiplier * SettingsConst.I_TPS;
      entity.velocity.y += entity.acceleration.y * friction * moveSpeedMultiplier * SettingsConst.I_TPS;
   }

   // If the game object is in a river, push them in the flow direction of the river
   // The tileMoveSpeedMultiplier check is so that game objects on stepping stones aren't pushed
   if (entity.isInRiver && !entity.overrideMoveSpeedMultiplier && physicsComponent.isAffectedByFriction) {
      const flowDirection = entity.tile.riverFlowDirection;
      entity.velocity.x += 240 * SettingsConst.I_TPS * a[flowDirection];
      entity.velocity.y += 240 * SettingsConst.I_TPS * b[flowDirection];
   }

   // Apply velocity
   if (entity.velocity.x !== 0 || entity.velocity.y !== 0) {
      // Friction
      if (physicsComponent.isAffectedByFriction) {
         // @Speed: pre-multiply the array
         const tileFriction = TILE_FRICTIONS[entity.tile.type];

         // Apply a friction based on the tile type for air resistance (???)
         entity.velocity.x *= 1 - tileFriction * SettingsConst.I_TPS * 2;
         entity.velocity.y *= 1 - tileFriction * SettingsConst.I_TPS * 2;

         // Apply a constant friction based on the tile type to simulate ground friction
         // @Incomplete @Bug: Doesn't take into acount the TPS. Would also be fixed by pre-multiplying the array
         const velocityMagnitude = entity.velocity.length();
         if (tileFriction < velocityMagnitude) {
            entity.velocity.x -= tileFriction * entity.velocity.x / velocityMagnitude;
            entity.velocity.y -= tileFriction * entity.velocity.y / velocityMagnitude;
         } else {
            entity.velocity.x = 0;
            entity.velocity.y = 0;
         }
      }
      
      // @Incomplete(???): Multiply by move speed multiplier
      entity.position.x += entity.velocity.x * SettingsConst.I_TPS;
      entity.position.y += entity.velocity.y * SettingsConst.I_TPS;

      physicsComponent.positionIsDirty = true;
   }
}

const updatePosition = (entity: Entity): void => {
   // @Speed: we run this function in both applyPhysics and updatePosition
   const physicsComponent = PhysicsComponentArray.getComponent(entity);
   
   if (entity.hitboxesAreDirty) {
      entity.cleanHitboxes();
      entity.updateContainingChunks();
   } else if (physicsComponent.positionIsDirty) {
      entity.updateHitboxes();
      entity.updateContainingChunks();
   }

   if (physicsComponent.positionIsDirty) {
      physicsComponent.positionIsDirty = false;

      entity.resolveWallTileCollisions();
   
      // If the object moved due to resolving wall tile collisions, recalculate
      if (physicsComponent.positionIsDirty) {
         entity.cleanHitboxes();
      }

      entity.resolveBorderCollisions();
   
      // If the object moved due to resolving border collisions, recalculate
      if (physicsComponent.positionIsDirty) {
         entity.cleanHitboxes();
      }

      entity.updateTile();
      entity.checkIsInRiver();
   }
}

export function tickPhysicsComponent(entity: Entity): void {
   applyPhysics(entity);
   updatePosition(entity);
}

export function applyKnockback(entity: Entity, knockback: number, knockbackDirection: number): void {
   if (!PhysicsComponentArray.hasComponent(entity)) {
      return;
   }
   
   const knockbackForce = knockback / entity.totalMass;
   entity.velocity.x += knockbackForce * Math.sin(knockbackDirection);
   entity.velocity.y += knockbackForce * Math.cos(knockbackDirection);
}