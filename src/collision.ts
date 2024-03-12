import { IEntityType, DoorToggleType, rotateXAroundPoint, rotateYAroundPoint, SettingsConst, angle, EntityType } from "webgl-test-shared";
import Entity from "./Entity";
import { DoorComponentArray } from "./components/ComponentArray";
import Hitbox from "./hitboxes/Hitbox";
import CircularHitbox from "./hitboxes/CircularHitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import { PhysicsComponentArray } from "./components/PhysicsComponent";
import { onFrozenYetiCollision } from "./entities/mobs/frozen-yeti";
import { onGolemCollision } from "./entities/mobs/golem";
import { onPebblumCollision } from "./entities/mobs/pebblum";
import { onSlimeCollision } from "./entities/mobs/slime";
import { onYetiCollision } from "./entities/mobs/yeti";
import { onZombieCollision } from "./entities/mobs/zombie";
import { onBattleaxeProjectileCollision } from "./entities/projectiles/battleaxe-projectile";
import { onIceArrowCollision } from "./entities/projectiles/ice-arrow";
import { onIceShardCollision } from "./entities/projectiles/ice-shards";
import { onRockSpikeProjectileCollision } from "./entities/projectiles/rock-spike";
import { onSlimeSpitCollision } from "./entities/projectiles/slime-spit";
import { onSpearProjectileCollision } from "./entities/projectiles/spear-projectile";
import { onSpitPoisonCollision } from "./entities/projectiles/spit-poison";
import { onWoodenArrowCollision } from "./entities/projectiles/wooden-arrow";
import { onCactusCollision } from "./entities/resources/cactus";
import { onIceSpikesCollision } from "./entities/resources/ice-spikes";
import { onSnowballCollision } from "./entities/snowball";
import { onPunjiSticksCollision } from "./entities/structures/punji-sticks";
import { onWoodenSpikesCollision } from "./entities/structures/wooden-spikes";
import { onPlayerCollision } from "./entities/tribes/player";
import { onTribeWorkerCollision } from "./entities/tribes/tribe-worker";

interface CollisionPushInfo {
   direction: number;
   amountIn: number;
}

export const enum CollisionVars {
   NO_COLLISION = 0xFFFF
}

const entityHasHardCollision = (entity: Entity, collidingEntity: Entity): boolean => {
   // Doors have hard collision when closing/closed
   if (entity.type === IEntityType.woodenDoor) {
      const doorComponent = DoorComponentArray.getComponent(entity.id);
      return doorComponent.toggleType === DoorToggleType.close || doorComponent.openProgress === 0;
   }

   // Tunnels have hard collision outside and soft inside
   if (entity.type === IEntityType.woodenTunnel) {
      const projX = Math.sin(entity.rotation + Math.PI / 2);
      const projY = Math.cos(entity.rotation + Math.PI / 2);

      const o = 32 - (8 - 0.05); // @Cleanup
      const minX = entity.position.x - o * projX;
      const minY = entity.position.y - o * projY;
      const maxX = entity.position.x + o * projX;
      const maxY = entity.position.y + o * projY;

      const minProj = minX * projX + minY * projY;
      const maxProj = maxX * projX + maxY * projY;

      const centerProj = collidingEntity.position.x * projX + collidingEntity.position.y * projY;

      return centerProj <= minProj || centerProj >= maxProj;
   }
   
   return entity.type === IEntityType.woodenWall || entity.type === IEntityType.woodenEmbrasure;
}

const getCircleCircleCollisionPushInfo = (pushedHitbox: CircularHitbox, pushingHitbox: CircularHitbox): CollisionPushInfo => {
   const pushedHitboxPositionX = pushedHitbox.object.position.x + pushedHitbox.rotatedOffsetX;
   const pushedHitboxPositionY = pushedHitbox.object.position.y + pushedHitbox.rotatedOffsetY;

   const pushingHitboxPositionX = pushingHitbox.object.position.x + pushingHitbox.rotatedOffsetX;
   const pushingHitboxPositionY = pushingHitbox.object.position.y + pushingHitbox.rotatedOffsetY;
   
   const dist = Math.sqrt(Math.pow(pushedHitboxPositionX - pushingHitboxPositionX, 2) + Math.pow(pushedHitboxPositionY - pushingHitboxPositionY, 2));
   
   return {
      amountIn: pushedHitbox.radius + pushingHitbox.radius - dist,
      // Angle from pushing hitbox to pushed hitbox
      direction: angle(pushedHitboxPositionX - pushingHitboxPositionX, pushedHitboxPositionY - pushingHitboxPositionY)
   };
}

const getCircleRectCollisionPushInfo = (pushedHitbox: CircularHitbox, pushingHitbox: RectangularHitbox): CollisionPushInfo => {
   const rectRotation = pushingHitbox.object.rotation + pushingHitbox.rotation;

   const pushedHitboxPositionX = pushedHitbox.object.position.x + pushedHitbox.rotatedOffsetX;
   const pushedHitboxPositionY = pushedHitbox.object.position.y + pushedHitbox.rotatedOffsetY;

   const pushingHitboxPositionX = pushingHitbox.object.position.x + pushingHitbox.rotatedOffsetX;
   const pushingHitboxPositionY = pushingHitbox.object.position.y + pushingHitbox.rotatedOffsetY;
   
   const circlePosX = rotateXAroundPoint(pushedHitboxPositionX, pushedHitboxPositionY, pushingHitboxPositionX, pushingHitboxPositionY, -rectRotation);
   const circlePosY = rotateYAroundPoint(pushedHitboxPositionX, pushedHitboxPositionY, pushingHitboxPositionX, pushingHitboxPositionY, -rectRotation);
   
   const distanceX = circlePosX - pushingHitboxPositionX;
   const distanceY = circlePosY - pushingHitboxPositionY;

   const absDistanceX = Math.abs(distanceX);
   const absDistanceY = Math.abs(distanceY);

   // Top and bottom collisions
   if (absDistanceX <= (pushingHitbox.width/2)) {
      return {
         amountIn: pushingHitbox.height/2 + pushedHitbox.radius - absDistanceY,
         direction: rectRotation + Math.PI + (distanceY > 0 ? Math.PI : 0)
      };
   }

   // Left and right collisions
   if (absDistanceY <= (pushingHitbox.height/2)) {
      return {
         amountIn: pushingHitbox.width/2 + pushedHitbox.radius - absDistanceX,
         direction: rectRotation + (distanceX > 0 ? Math.PI/2 : -Math.PI/2)
      };
   }

   const cornerDistanceSquared = Math.pow(absDistanceX - pushingHitbox.width/2, 2) + Math.pow(absDistanceY - pushingHitbox.height/2, 2);
   if (cornerDistanceSquared <= pushedHitbox.radius * pushedHitbox.radius) {
      // @Cleanup: Whole lot of copy and paste
      const amountInX = absDistanceX - pushingHitbox.width/2 - pushedHitbox.radius;
      const amountInY = absDistanceY - pushingHitbox.height/2 - pushedHitbox.radius;
      if (Math.abs(amountInY) < Math.abs(amountInX)) {
         const closestRectBorderY = circlePosY < pushingHitboxPositionY ? pushingHitboxPositionY - pushingHitbox.height/2 : pushingHitboxPositionY + pushingHitbox.height/2;
         const closestRectBorderX = circlePosX < pushingHitboxPositionX ? pushingHitboxPositionX - pushingHitbox.width/2 : pushingHitboxPositionX + pushingHitbox.width/2;
         const xDistanceFromRectBorder = Math.abs(closestRectBorderX - circlePosX);
         const len = Math.sqrt(pushedHitbox.radius * pushedHitbox.radius - xDistanceFromRectBorder * xDistanceFromRectBorder);

         return {
            amountIn: Math.abs(closestRectBorderY - (circlePosY - len * Math.sign(distanceY))),
            direction: rectRotation + Math.PI + (distanceY > 0 ? Math.PI : 0)
         };
      } else {
         const closestRectBorderX = circlePosX < pushingHitboxPositionX ? pushingHitboxPositionX - pushingHitbox.width/2 : pushingHitboxPositionX + pushingHitbox.width/2;
         
         const closestRectBorderY = circlePosY < pushingHitboxPositionY ? pushingHitboxPositionY - pushingHitbox.height/2 : pushingHitboxPositionY + pushingHitbox.height/2;
         const yDistanceFromRectBorder = Math.abs(closestRectBorderY - circlePosY);
         const len = Math.sqrt(pushedHitbox.radius * pushedHitbox.radius - yDistanceFromRectBorder * yDistanceFromRectBorder);

         return {
            amountIn: Math.abs(closestRectBorderX - (circlePosX - len * Math.sign(distanceX))),
            direction: rectRotation + (distanceX > 0 ? Math.PI/2 : -Math.PI/2)
         };
      }
   }

   console.warn("Couldn't find the collision");
   return {
      amountIn: 0,
      direction: 0
   };
}

const getCollisionPushInfo = (pushedHitbox: Hitbox, pushingHitbox: Hitbox): CollisionPushInfo => {
   if (pushedHitbox.hasOwnProperty("radius") && pushingHitbox.hasOwnProperty("radius")) {
      // Circle + Circle
      return getCircleCircleCollisionPushInfo(pushedHitbox as CircularHitbox, pushingHitbox as CircularHitbox);
   } else if (pushedHitbox.hasOwnProperty("radius") && !pushingHitbox.hasOwnProperty("radius")) {
      // Circle + Rectangle
      return getCircleRectCollisionPushInfo(pushedHitbox as CircularHitbox, pushingHitbox as RectangularHitbox);
   } else if (!pushedHitbox.hasOwnProperty("radius") && pushingHitbox.hasOwnProperty("radius")) {
      // Rectangle + Circle
      const pushInfo = getCircleRectCollisionPushInfo(pushingHitbox as CircularHitbox, pushedHitbox as RectangularHitbox);
      pushInfo.direction += Math.PI;
      return pushInfo;
   } else {
      // Rectangle + Rectangle
      // @Incomplete
      return {
         amountIn: 0,
         direction: 0
      }
   }
}

/**
 * @returns A number where the first 8 bits hold the index of the entity's colliding hitbox, and the next 8 bits hold the index of the other entity's colliding hitbox
*/
export function isColliding(entity1: Entity, entity2: Entity): number {
   if ((entity1.collisionMask & entity2.collisionBit) === 0 || (entity2.collisionMask & entity1.collisionBit) === 0) {
      return CollisionVars.NO_COLLISION;
   }

   // AABB bounding area check
   if (entity1.boundingAreaMinX > entity2.boundingAreaMaxX || // minX(1) > maxX(2)
       entity1.boundingAreaMaxX < entity2.boundingAreaMinX || // maxX(1) < minX(2)
       entity1.boundingAreaMinY > entity2.boundingAreaMaxY || // minY(1) > maxY(2)
       entity1.boundingAreaMaxY < entity2.boundingAreaMinY) { // maxY(1) < minY(2)
      return CollisionVars.NO_COLLISION;
   }
   
   // More expensive hitbox check
   const numHitboxes = entity1.hitboxes.length;
   const numOtherHitboxes = entity2.hitboxes.length;
   for (let i = 0; i < numHitboxes; i++) {
      const hitbox = entity1.hitboxes[i];

      for (let j = 0; j < numOtherHitboxes; j++) {
         const otherHitbox = entity2.hitboxes[j];

         // If the objects are colliding, add the colliding object and this object
         if (hitbox.isColliding(otherHitbox)) {
            return i + (j << 8);
         }
      }
   }

   // If no hitboxes match, then they aren't colliding
   return CollisionVars.NO_COLLISION;
}

const resolveHardCollision = (entity: Entity, pushInfo: CollisionPushInfo): void => {
   // Transform the entity out of the hitbox
   entity.position.x += pushInfo.amountIn * Math.sin(pushInfo.direction);
   entity.position.y += pushInfo.amountIn * Math.cos(pushInfo.direction);

   // Kill all the velocity going into the hitbox
   const bx = Math.sin(pushInfo.direction + Math.PI/2);
   const by = Math.cos(pushInfo.direction + Math.PI/2);
   const projectionCoeff = entity.velocity.x * bx + entity.velocity.y * by;
   entity.velocity.x = bx * projectionCoeff;
   entity.velocity.y = by * projectionCoeff;
}

const resolveSoftCollision = (entity: Entity, pushedHitbox: Hitbox, pushingHitbox: Hitbox, pushInfo: CollisionPushInfo): void => {
   // Force gets greater the further into each other the entities are
   const distMultiplier = Math.pow(pushInfo.amountIn, 1.1);
   const pushForce = SettingsConst.ENTITY_PUSH_FORCE * SettingsConst.I_TPS * distMultiplier * pushingHitbox.mass / pushedHitbox.mass;
   
   entity.velocity.x += pushForce * Math.sin(pushInfo.direction);
   entity.velocity.y += pushForce * Math.cos(pushInfo.direction);
}

export function collide(entity: Entity, pushingEntity: Entity, pushedHitboxIdx: number, pushingHitboxIdx: number): void {
   if (PhysicsComponentArray.hasComponent(entity)) {
      const physicsComponent = PhysicsComponentArray.getComponent(entity.id);
      if (!physicsComponent.ignoreCollisions) {
         const pushedHitbox = entity.hitboxes[pushedHitboxIdx];
         const pushingHitbox = pushingEntity.hitboxes[pushingHitboxIdx];
         
         const pushInfo = getCollisionPushInfo(pushedHitbox, pushingHitbox);
         if (entityHasHardCollision(pushingEntity, entity)) {
            resolveHardCollision(entity, pushInfo);
         } else {
            resolveSoftCollision(entity, pushedHitbox, pushingHitbox, pushInfo);
         }
      }
   }

   switch (entity.type) {
      case IEntityType.player: onPlayerCollision(entity, pushingEntity); break;
      case IEntityType.tribeWorker: onTribeWorkerCollision(entity, pushingEntity); break;
      case IEntityType.iceSpikes: onIceSpikesCollision(entity, pushingEntity); break;
      case IEntityType.iceShardProjectile: onIceShardCollision(entity, pushingEntity); break;
      case IEntityType.cactus: onCactusCollision(entity, pushingEntity); break;
      case IEntityType.zombie: onZombieCollision(entity, pushingEntity); break;
      case IEntityType.slime: onSlimeCollision(entity, pushingEntity); break;
      case IEntityType.woodenArrowProjectile: onWoodenArrowCollision(entity, pushingEntity); break;
      case IEntityType.yeti: onYetiCollision(entity, pushingEntity); break;
      case IEntityType.snowball: onSnowballCollision(entity, pushingEntity); break;
      case IEntityType.frozenYeti: onFrozenYetiCollision(entity, pushingEntity); break;
      case IEntityType.rockSpikeProjectile: onRockSpikeProjectileCollision(entity, pushingEntity); break;
      case IEntityType.spearProjectile: onSpearProjectileCollision(entity, pushingEntity); break;
      case IEntityType.slimeSpit: onSlimeSpitCollision(entity, pushingEntity); break;
      case IEntityType.spitPoison: onSpitPoisonCollision(entity, pushingEntity); break;
      case IEntityType.battleaxeProjectile: onBattleaxeProjectileCollision(entity, pushingEntity); break;
      case IEntityType.iceArrow: onIceArrowCollision(entity, pushingEntity); break;
      case IEntityType.pebblum: onPebblumCollision(entity, pushingEntity); break;
      case IEntityType.golem: onGolemCollision(entity, pushingEntity); break;
      case IEntityType.woodenSpikes: onWoodenSpikesCollision(entity, pushingEntity); break;
      case IEntityType.punjiSticks: onPunjiSticksCollision(entity, pushingEntity); break;
   }
}