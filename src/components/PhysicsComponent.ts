import { I_TPS, TILE_FRICTIONS, TILE_MOVE_SPEED_MULTIPLIERS, TileTypeConst } from "webgl-test-shared";
import Entity from "../Entity";
import { PhysicsComponentArray } from "./ComponentArray";

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

   // @Incomplete: Make the following flags false by default and make sure the hitboxes and other stuff is correct when spawning in

   /** Whether the game object's position has changed during the current tick or not. Used during collision detection to avoid unnecessary collision checks */
   public positionIsDirty = true;

   constructor(isAffectedByFriction: boolean) {
      this.isAffectedByFriction = isAffectedByFriction;
   }
}

const applyPhysics = (entity: Entity): void => {
   const physicsComponent = PhysicsComponentArray.getComponent(entity);

   // @Temporary @Hack
   if (isNaN(entity.velocity.x) || isNaN(entity.velocity.x)) {
      console.log(entity.type);
      console.warn("Entity velocity was NaN.");
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
      entity.velocity.x += entity.acceleration.x * friction * moveSpeedMultiplier * I_TPS;
      entity.velocity.y += entity.acceleration.y * friction * moveSpeedMultiplier * I_TPS;
   }

   // If the game object is in a river, push them in the flow direction of the river
   // The tileMoveSpeedMultiplier check is so that game objects on stepping stones aren't pushed
   if (entity.isInRiver && !entity.overrideMoveSpeedMultiplier && physicsComponent.isAffectedByFriction) {
      const flowDirection = entity.tile.riverFlowDirection;
      entity.velocity.x += 240 * I_TPS * a[flowDirection];
      entity.velocity.y += 240 * I_TPS * b[flowDirection];
   }

   // Apply velocity
   if (entity.velocity.x !== 0 || entity.velocity.y !== 0) {
      const friction = TILE_FRICTIONS[entity.tile.type];

      if (physicsComponent.isAffectedByFriction) {
         // Apply a friction based on the tile type to air resistance (???)
         entity.velocity.x *= 1 - friction * I_TPS * 2;
         entity.velocity.y *= 1 - friction * I_TPS * 2;

         // Apply a constant friction based on the tile type to simulate ground friction
         const velocityMagnitude = entity.velocity.length();
         if (velocityMagnitude > 0) {
            const groundFriction = Math.min(friction, velocityMagnitude);
            entity.velocity.x -= groundFriction * entity.velocity.x / velocityMagnitude;
            entity.velocity.y -= groundFriction * entity.velocity.y / velocityMagnitude;
         }
      }
      
      entity.position.x += entity.velocity.x * I_TPS;
      entity.position.y += entity.velocity.y * I_TPS;

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