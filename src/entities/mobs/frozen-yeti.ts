import { COLLISION_BITS, DEFAULT_COLLISION_MASK, FrozenYetiAttackType, IEntityType, I_TPS, ItemType, PlayerCauseOfDeath, Point, SETTINGS, SnowballSize, StatusEffectConst, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { AIHelperComponentArray, FrozenYetiComponentArray, HealthComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, applyStatusEffect } from "../../components/StatusEffectComponent";
import { AIHelperComponent } from "../../components/AIHelperComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { FrozenYetiComponent } from "../../components/FrozenYetiComponent";
import Board from "../../Board";
import { entityHasReachedPosition, entityIsInVisionRange, getAngleDifference, getEntitiesInVisionRange, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { ROCK_SPIKE_HITBOX_SIZES, createRockSpikeProjectile } from "../projectiles/rock-spike";
import { createSnowball } from "../snowball";

const FROZEN_YETI_SIZE = 144;
const HEAD_HITBOX_SIZE = 72;
const HEAD_DISTANCE = 60;
const PAW_SIZE = 32;
const PAW_OFFSET = 80;
const PAW_RESTING_ANGLE = Math.PI / 3.5;

const TARGET_ENTITY_FORGET_TIME = 10;

const SLOW_ACCELERATION = 200;
const ACCELERATION = 300;

const VISION_RANGE = 350;
const BITE_RANGE = 150;
const ROAR_ARC = Math.PI / 6;
const ROAR_REACH = 450;

export const FROZEN_YETI_GLOBAL_ATTACK_COOLDOWN = 1.25;
export const FROZEN_YETI_BITE_COOLDOWN = 30;
export const FROZEN_YETI_SNOWBALL_THROW_COOLDOWN = 10;
export const FROZEN_YETI_ROAR_COOLDOWN = 100;
export const FROZEN_YETI_STOMP_COOLDOWN = 100;

const SNOWBALL_THROW_OFFSET = 150;
const STOMP_START_OFFSET = 40;
const BITE_ATTACK_OFFSET = 140;
const BITE_ATTACK_RANGE = 35;

const SNOWBALL_THROW_SPEED = [590, 750] as const;

export interface FrozenYetiTargetInfo {
   damageDealtToSelf: number;
   timeSinceLastAggro: number;
}

export interface FrozenYetiRockSpikeInfo {
   readonly positionX: number;
   readonly positionY: number;
   readonly size: number;
}

export function createFrozenYeti(position: Point): Entity {
   const frozenYeti = new Entity(position, IEntityType.frozenYeti, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const bodyHitbox = new CircularHitbox(frozenYeti, 0, 0, FROZEN_YETI_SIZE / 2);
   frozenYeti.addHitbox(bodyHitbox);

   const headHitbox = new CircularHitbox(frozenYeti, 0, HEAD_DISTANCE, HEAD_HITBOX_SIZE / 2);
   frozenYeti.addHitbox(headHitbox);

   // Paw hitboxes
   for (let i = 0; i < 2; i++) {
      const pawDirection = PAW_RESTING_ANGLE * (i === 0 ? -1 : 1);
      const hitbox = new CircularHitbox(frozenYeti, PAW_OFFSET * Math.sin(pawDirection), PAW_OFFSET * Math.cos(pawDirection), PAW_SIZE / 2);
      frozenYeti.addHitbox(hitbox);
   }

   HealthComponentArray.addComponent(frozenYeti, new HealthComponent(250));
   StatusEffectComponentArray.addComponent(frozenYeti, new StatusEffectComponent(StatusEffectConst.freezing));
   AIHelperComponentArray.addComponent(frozenYeti, new AIHelperComponent(VISION_RANGE));
   FrozenYetiComponentArray.addComponent(frozenYeti, new FrozenYetiComponent());
   WanderAIComponentArray.addComponent(frozenYeti, new WanderAIComponent());

   frozenYeti.rotation = 2 * Math.PI * Math.random();

   return frozenYeti;
}

const findTargets = (frozenYeti: Entity, visibleEntities: ReadonlyArray<Entity>): ReadonlyArray<Entity> => {
   const targets = new Array<Entity>();
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];

      if (entity.tile.biomeName === "tundra" && entity.type !== IEntityType.itemEntity && entity.type !== IEntityType.frozenYeti && entity.type !== IEntityType.iceSpikes && entity.type !== IEntityType.snowball) {
         targets.push(entity);
      }
   }

   // Add attacking entities to targets
   const frozenYetiComponent = FrozenYetiComponentArray.getComponent(frozenYeti);
   // @Speed
   for (const _targetID of Object.keys(frozenYetiComponent.attackingEntities)) {
      const entity = Board.entityRecord[Number(_targetID)];
      if (targets.indexOf(entity) === -1) {
         targets.push(entity);
      }
   }

   return targets;
}

const getAttackType = (frozenYeti: Entity, target: Entity, angleToTarget: number, numTargets: number): FrozenYetiAttackType => {
   const frozenYetiComponent = FrozenYetiComponentArray.getComponent(frozenYeti);
   
   if (frozenYetiComponent.globalAttackCooldownTimer > 0) {
      return FrozenYetiAttackType.none;
   }

   const angleDifference = getAngleDifference(angleToTarget, frozenYeti.rotation);
   
   // Bite if target is in range and the yeti's mouth is close enough
   if (frozenYetiComponent.biteCooldownTimer === 0 && Math.abs(angleDifference) <= 0.7 && entityIsInVisionRange(frozenYeti.position, BITE_RANGE, target)) {
      return FrozenYetiAttackType.bite;
   }

   // Stomp if two or more targets in range
   if (frozenYetiComponent.stompCooldownTimer === 0 && numTargets >= 2) {
      return FrozenYetiAttackType.stomp;
   }
   
   // Roar attack if mouth is close enough
   if (frozenYetiComponent.roarCooldownTimer === 0 && Math.abs(angleDifference) <= 0.5) {
      return FrozenYetiAttackType.roar;
   }

   // Snow throw attack if mouth is close enough
   if (frozenYetiComponent.snowballThrowCooldownTimer === 0 && Math.abs(angleDifference) <= 0.5) {
      return FrozenYetiAttackType.snowThrow;
   }

   return FrozenYetiAttackType.none;
}

const attemptToAdvanceStage = (frozenYetiComponent: FrozenYetiComponent): void => {
   if (frozenYetiComponent.stageProgress >= 1) {
      frozenYetiComponent.attackStage++;
      frozenYetiComponent.stageProgress = 0;
   }
}

const clearAttack = (frozenYetiComponent: FrozenYetiComponent): void => {
   if (frozenYetiComponent.stageProgress >= 1) {
      frozenYetiComponent.stageProgress = 0;
      frozenYetiComponent.attackStage = 0;
      frozenYetiComponent.attackType = FrozenYetiAttackType.none;
   }
}

/**
 * Stomp
 * @param targets Whomst to stomp
 */
const generateRockSpikeAttackInfo = (frozenYeti: Entity, targets: ReadonlyArray<Entity>): Array<FrozenYetiRockSpikeInfo> => {
   // @Speed: Garbage collection

   const rockSpikeInfoArray = new Array<FrozenYetiRockSpikeInfo>();
   
   const angles = new Array<number>();

   const numSequences = Math.min(targets.length, 3);
   const availableTargetIndexes = targets.map((_, i) => i);
   for (let i = 0; i < numSequences; i++) {
      const idx = Math.floor(Math.random() * availableTargetIndexes.length);
      const target = targets[availableTargetIndexes[idx]];
      availableTargetIndexes.splice(idx, 1);
      
      const direction = frozenYeti.position.calculateAngleBetween(target.position);
      
      // Don't do sequence if too close to existing sequence
      let isValid = true;
      for (const angle of angles) {
         if (Math.abs(getAngleDifference(angle, direction)) <= Math.PI / 5) {
            isValid = false;
            break;
         }
      }
      if (!isValid) {
         continue;
      }
      
      const perpendicularDirection = direction + Math.PI / 2;
      angles.push(direction);

      // 
      // Main sequence
      // 
      
      const numMainSequenceNodes = randInt(4, 5);
      
      const startPositionX = frozenYeti.position.x + (FROZEN_YETI_SIZE / 2 + STOMP_START_OFFSET) * Math.sin(direction);
      const startPositionY = frozenYeti.position.y + (FROZEN_YETI_SIZE / 2 + STOMP_START_OFFSET) * Math.cos(direction);

      const spikePositions = new Array<Point>();
      const spikeSizes = new Array<number>();
      
      // Create main sequence spikes
      let totalOffset = 0;
      for (let i = 0; i < numMainSequenceNodes; i++) {
         let positionX = startPositionX + totalOffset * Math.sin(direction);
         let positionY = startPositionY + totalOffset * Math.cos(direction);
         totalOffset += randFloat(75, 110);

         // Add perpendicular offset
         const offsetMagnitude = randFloat(-25, 25) * Math.pow(i + 1, 0.75);
         positionX += offsetMagnitude * Math.sin(perpendicularDirection);
         positionY += offsetMagnitude * Math.cos(perpendicularDirection);

         const spawnPosition = new Point(positionX, positionY);
         const size = i <= numMainSequenceNodes / 2 ? 2 : 1;

         spikePositions.push(spawnPosition);
         spikeSizes.push(size);
         rockSpikeInfoArray.push({
            positionX: positionX,
            positionY: positionY,
            size: size
         });
      }

      // Create non-main-sequence spikes
      for (let i = 0; i < 15; i++) {
         const size = 0;
         
         const dist = Math.random();
         const offset = totalOffset * 1.5 * dist;

         let positionX = startPositionX + offset * Math.sin(direction);
         let positionY = startPositionY + offset * Math.cos(direction);

         // Perpendicular offset
         const offsetMagnitude = randFloat(-40, 40) * Math.pow(i + 1, 0.75);
         positionX += offsetMagnitude * Math.sin(perpendicularDirection);
         positionY += offsetMagnitude * Math.cos(perpendicularDirection);

         const position = new Point(positionX, positionY);

         // Make sure the position wouldn't collide with any other spikes
         let positionIsValid = true;
         let minDist = Number.MAX_SAFE_INTEGER;
         for (let i = 0; i < spikePositions.length; i++) {
            const otherPosition = spikePositions[i];
            const otherSize = spikeSizes[i];

            const distance = position.calculateDistanceBetween(otherPosition);
            if (distance <= ROCK_SPIKE_HITBOX_SIZES[size] / 2 + ROCK_SPIKE_HITBOX_SIZES[otherSize] / 2) {
               positionIsValid = false;
               break;
            }
            if (otherSize > 0 && distance < minDist) {
               minDist = distance;
            }
         }
         // Don't create spike if would collide with existing spike or too far away from main sequence spike
         if (!positionIsValid || minDist > 100) {
            continue;
         }

         spikePositions.push(position);
         spikeSizes.push(size);
         rockSpikeInfoArray.push({
            positionX: positionX,
            positionY: positionY,
            size: size
         });
      }
   }

   return rockSpikeInfoArray;
}

const createRockSpikes = (frozenYetiID: number, frozenYetiComponent: FrozenYetiComponent): void => {
   for (const info of frozenYetiComponent.rockSpikeInfoArray) {
      const position = new Point(info.positionX, info.positionY);
      createRockSpikeProjectile(position, info.size, frozenYetiID);
   }
   frozenYetiComponent.rockSpikeInfoArray = [];
}

const spawnSnowball = (frozenYeti: Entity, size: SnowballSize): void => {
   const angle = frozenYeti.rotation + randFloat(-1, 1);
   
   const position = frozenYeti.position.copy();
   position.x += SNOWBALL_THROW_OFFSET * Math.sin(angle);
   position.y += SNOWBALL_THROW_OFFSET * Math.cos(angle);

   const snowball = createSnowball(position, size, frozenYeti.id)

   const velocityMagnitude = randFloat(SNOWBALL_THROW_SPEED[0], SNOWBALL_THROW_SPEED[1]);
   snowball.velocity.x = velocityMagnitude * Math.sin(angle);
   snowball.velocity.y = velocityMagnitude * Math.cos(angle);
}

const throwSnow = (frozenYeti: Entity): void => {
   // Large snowballs
   for (let i = 0; i < 3; i++) {
      spawnSnowball(frozenYeti, SnowballSize.large);
   }

   // Small snowballs
   for (let i = 0; i < 5; i++) {
      spawnSnowball(frozenYeti, SnowballSize.small);
   }

   // Kickback
   frozenYeti.velocity.x += 50 * Math.sin(frozenYeti.rotation + Math.PI);
   frozenYeti.velocity.y += 50 * Math.cos(frozenYeti.rotation + Math.PI);
}

const duringRoar = (frozenYeti: Entity, targets: ReadonlyArray<Entity>): void => {
   for (const entity of targets) {
      // Make sure the entity is in range
      if (frozenYeti.position.calculateDistanceSquaredBetween(entity.position) > ROAR_REACH * ROAR_REACH) {
         continue;
      }
      
      // Check if the entity is within the arc range of the attack
      const angle = frozenYeti.position.calculateAngleBetween(entity.position);
      const angleDifference = getAngleDifference(frozenYeti.rotation, angle);
      if (Math.abs(angleDifference) <= ROAR_ARC / 2) {
         entity.velocity.x += 50 * Math.sin(angle);
         entity.velocity.y += 50 * Math.cos(angle);

         applyStatusEffect(entity, StatusEffectConst.freezing, 5 * SETTINGS.TPS);
      }
   }
}

const doBiteAttack = (frozenYeti: Entity, angleToTarget: number): void => {
   const x = frozenYeti.position.x + BITE_ATTACK_OFFSET * Math.sin(frozenYeti.rotation);
   const y = frozenYeti.position.y + BITE_ATTACK_OFFSET * Math.cos(frozenYeti.rotation);
   const hitEntities = getEntitiesInVisionRange(x, y, BITE_ATTACK_RANGE);
   for (const entity of hitEntities) {
      if (entity !== frozenYeti) {
         if (HealthComponentArray.hasComponent(entity)) {
            damageEntity(entity, 3, 200, angleToTarget, frozenYeti, PlayerCauseOfDeath.frozen_yeti, 0);
            if (StatusEffectComponentArray.hasComponent(entity)) {
               applyStatusEffect(entity, StatusEffectConst.bleeding, 5 * SETTINGS.TPS);
            }
         }
      }
   }
}

export function tickFrozenYeti(frozenYeti: Entity): void {
   const frozenYetiComponent = FrozenYetiComponentArray.getComponent(frozenYeti);
   
   // Remove targets which are dead or have been out of aggro long enough
   // @Speed: Remove calls to Object.keys, Number, and hasOwnProperty
   for (const _targetID of Object.keys(frozenYetiComponent.attackingEntities)) {
      const targetID = Number(_targetID);

      if (!Board.entityRecord.hasOwnProperty(targetID)) {
         delete frozenYetiComponent.attackingEntities[targetID];
         continue;
      }

      frozenYetiComponent.attackingEntities[targetID].timeSinceLastAggro += I_TPS;
      if (frozenYetiComponent.attackingEntities[targetID].timeSinceLastAggro >= TARGET_ENTITY_FORGET_TIME) {
         delete frozenYetiComponent.attackingEntities[targetID];
      }
   }

   // @Cleanup: Too long, should be separated into many individual functions
   
   const aiHelperComponent = AIHelperComponentArray.getComponent(frozenYeti);
   const targets = findTargets(frozenYeti, aiHelperComponent.visibleEntities);
   
   if (targets.length === 0 && frozenYetiComponent.attackType === FrozenYetiAttackType.none) {
      frozenYetiComponent.attackType = FrozenYetiAttackType.none;
      frozenYetiComponent.attackStage = 0;
      frozenYetiComponent.stageProgress = 0;

      frozenYetiComponent.globalAttackCooldownTimer = FROZEN_YETI_GLOBAL_ATTACK_COOLDOWN;
      frozenYetiComponent.biteCooldownTimer = FROZEN_YETI_BITE_COOLDOWN;
      frozenYetiComponent.snowballThrowCooldownTimer = FROZEN_YETI_SNOWBALL_THROW_COOLDOWN;
      frozenYetiComponent.roarCooldownTimer = FROZEN_YETI_ROAR_COOLDOWN;
      frozenYetiComponent.stompCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;

      // Wander AI
      const wanderAIComponent = WanderAIComponentArray.getComponent(frozenYeti);
      if (wanderAIComponent.targetPositionX !== -1) {
         if (entityHasReachedPosition(frozenYeti, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
            wanderAIComponent.targetPositionX = -1;
            stopEntity(frozenYeti);
         }
      } else if (shouldWander(frozenYeti, 0.6)) {
         let attempts = 0;
         let targetTile: Tile;
         do {
            targetTile = getWanderTargetTile(frozenYeti, VISION_RANGE);
         } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "grasslands"));

         const x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
         const y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
         wander(frozenYeti, x, y, SLOW_ACCELERATION)
      } else {
         stopEntity(frozenYeti);
      }

      return;
   }

   frozenYetiComponent.globalAttackCooldownTimer -= 1 / SETTINGS.TPS;
   if (frozenYetiComponent.globalAttackCooldownTimer < 0) {
      frozenYetiComponent.globalAttackCooldownTimer = 0;
   }
   frozenYetiComponent.snowballThrowCooldownTimer -= 1 / SETTINGS.TPS;
   if (frozenYetiComponent.snowballThrowCooldownTimer < 0) {
      frozenYetiComponent.snowballThrowCooldownTimer = 0;
   }
   frozenYetiComponent.roarCooldownTimer -= 1 / SETTINGS.TPS;
   if (frozenYetiComponent.roarCooldownTimer < 0) {
      frozenYetiComponent.roarCooldownTimer = 0;
   }
   frozenYetiComponent.biteCooldownTimer -= 1 / SETTINGS.TPS;
   if (frozenYetiComponent.biteCooldownTimer < 0) {
      frozenYetiComponent.biteCooldownTimer = 0;
   }
   frozenYetiComponent.stompCooldownTimer -= 1 / SETTINGS.TPS;
   if (frozenYetiComponent.stompCooldownTimer < 0) {
      frozenYetiComponent.stompCooldownTimer = 0;
   }

   // If any target has dealt damage to the yeti, choose the target based on which one has dealt the most damage to it
   // Otherwise attack the closest target
   let target: Entity | null = null; 
   let a = 0;
   if (Object.keys(frozenYetiComponent.attackingEntities).length === 0) {
      // Choose based on distance
      let minDist = Number.MAX_SAFE_INTEGER;
      for (const currentTarget of targets) {
         const distance = frozenYeti.position.calculateDistanceBetween(currentTarget.position);
         if (distance < minDist) {
            minDist = distance;
            target = currentTarget;
         }
      }
   } else {
      a = 1;
      let mostDamageDealt = -1;
      for (const currentTarget of targets) {
         if (frozenYetiComponent.attackingEntities.hasOwnProperty(currentTarget.id)) {
            const targetInfo = frozenYetiComponent.attackingEntities[currentTarget.id];
            if (targetInfo.damageDealtToSelf > mostDamageDealt) {
               mostDamageDealt = targetInfo.damageDealtToSelf;
               target = currentTarget;
            }
         }
      }
   }
   if (target !== null) {
      // @Speed: Garbage collection
      frozenYetiComponent.lastTargetPosition = target.position.copy();
   }

   let angleToTarget: number;
   if (target !== null) {
      angleToTarget = frozenYeti.position.calculateAngleBetween(target.position);
   } else {
      angleToTarget = frozenYeti.position.calculateAngleBetween(frozenYetiComponent.lastTargetPosition!);
   }
   if (angleToTarget < 0) {
      angleToTarget += 2 * Math.PI;
   }

   if (frozenYetiComponent.attackType === FrozenYetiAttackType.none && target !== null) {
      frozenYetiComponent.attackType = getAttackType(frozenYeti, target, angleToTarget, targets.length);
   }
   switch (frozenYetiComponent.attackType) {
      case FrozenYetiAttackType.stomp: {
         frozenYeti.acceleration.x = 0;
         frozenYeti.acceleration.y = 0;

         switch (frozenYetiComponent.attackStage) {
            // Windup
            case 0: {
               if (frozenYetiComponent.stageProgress === 0) {
                  frozenYetiComponent.rockSpikeInfoArray = generateRockSpikeAttackInfo(frozenYeti, targets);
               }
               
               frozenYetiComponent.stageProgress += 0.75 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
               if (frozenYetiComponent.stageProgress === 0) {
                  createRockSpikes(frozenYeti.id, frozenYetiComponent);
               }
               break;
            }
            // Stomp
            case 1: {
               frozenYetiComponent.stageProgress += 2 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
            }
            // Daze
            case 2: {
               frozenYetiComponent.stageProgress += 2 / SETTINGS.TPS;
               clearAttack(frozenYetiComponent);
               if (frozenYetiComponent.stageProgress === 0) {
                  frozenYetiComponent.stompCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;
                  frozenYetiComponent.globalAttackCooldownTimer = FROZEN_YETI_GLOBAL_ATTACK_COOLDOWN;
               }
            }
         }
         
         break;
      }
      case FrozenYetiAttackType.snowThrow: {
         frozenYeti.acceleration.x = 0;
         frozenYeti.acceleration.y = 0;
         
         switch (frozenYetiComponent.attackStage) {
            // Windup
            case 0: {
               frozenYeti.turn(angleToTarget, 0.9);
               
               frozenYetiComponent.stageProgress += 0.55 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
               break;
            }
            // Throw
            case 1: {
               frozenYetiComponent.stageProgress += 3 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
               if (frozenYetiComponent.stageProgress === 0) {
                  throwSnow(frozenYeti);
               }
               break;
            }
            // Wind down
            case 2: {
               frozenYetiComponent.stageProgress += 2 / SETTINGS.TPS;
               clearAttack(frozenYetiComponent);
               if (frozenYetiComponent.stageProgress === 0) {
                  frozenYetiComponent.snowballThrowCooldownTimer = FROZEN_YETI_SNOWBALL_THROW_COOLDOWN
                  frozenYetiComponent.globalAttackCooldownTimer = FROZEN_YETI_GLOBAL_ATTACK_COOLDOWN;
               }
               break;
            }
         }
         
         break;
      }
      case FrozenYetiAttackType.roar: {
         frozenYeti.acceleration.x = 0;
         frozenYeti.acceleration.y = 0;

         switch (frozenYetiComponent.attackStage) {
            // Windup
            case 0: {
               // Track target
               frozenYeti.turn(angleToTarget, 0.9);

               frozenYetiComponent.stageProgress += 0.5 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
               break;
            }
            // Roar attack
            case 1: {
               // Track target
               frozenYeti.turn(angleToTarget, 0.35);

               duringRoar(frozenYeti, targets);
               
               frozenYetiComponent.stageProgress += 0.5 / SETTINGS.TPS;
               clearAttack(frozenYetiComponent);
               if (frozenYetiComponent.stageProgress === 0) {
                  frozenYetiComponent.roarCooldownTimer = FROZEN_YETI_ROAR_COOLDOWN;
                  frozenYetiComponent.globalAttackCooldownTimer = FROZEN_YETI_GLOBAL_ATTACK_COOLDOWN;
               }
               break;
            }
         }

         break;
      }
      case FrozenYetiAttackType.bite: {
         switch (frozenYetiComponent.attackStage) {
            // Charge
            case 0: {
               // Move towards the target
               frozenYeti.acceleration.x = 0;
               frozenYeti.acceleration.y = 0;
               frozenYeti.turn(angleToTarget, 1.3);

               frozenYetiComponent.stageProgress += 1.15 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
               break;
            }
            // Lunge
            case 1: {
               frozenYeti.acceleration.x = ACCELERATION * Math.sin(angleToTarget);
               frozenYeti.acceleration.y = ACCELERATION * Math.cos(angleToTarget);

               // Lunge forwards at the beginning of this stage
               if (frozenYetiComponent.stageProgress === 0) {
                  frozenYeti.velocity.x += 450 * Math.sin(frozenYeti.rotation);
                  frozenYeti.velocity.y += 450 * Math.cos(frozenYeti.rotation);
               }

               frozenYetiComponent.stageProgress += 2 / SETTINGS.TPS;
               attemptToAdvanceStage(frozenYetiComponent);
               if (frozenYetiComponent.stageProgress === 0) {
                  frozenYetiComponent.biteCooldownTimer = FROZEN_YETI_BITE_COOLDOWN;
                  frozenYetiComponent.globalAttackCooldownTimer = FROZEN_YETI_GLOBAL_ATTACK_COOLDOWN;
                  doBiteAttack(frozenYeti, angleToTarget);
               }
               break;
            }
            // Wind-down
            case 2: {
               frozenYeti.acceleration.x = ACCELERATION * Math.sin(angleToTarget);
               frozenYeti.acceleration.y = ACCELERATION * Math.cos(angleToTarget);
               frozenYeti.turn(angleToTarget, 1.3);

               frozenYetiComponent.stageProgress += 2.5 / SETTINGS.TPS;
               clearAttack(frozenYetiComponent);
            }
         }

         break;
      }
      case FrozenYetiAttackType.none: {
         // Move towards the target
         frozenYeti.turn(angleToTarget, Math.PI);
         frozenYeti.acceleration.x = ACCELERATION * Math.sin(angleToTarget);
         frozenYeti.acceleration.y = ACCELERATION * Math.cos(angleToTarget);
         
         break;
      }
   }
}

export function onFrozenYetiCollision(frozenYeti: Entity, collidingEntity: Entity): void {
   if (collidingEntity === null || collidingEntity.type === IEntityType.iceSpikes) {
      return;
   }

   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      const hitDirection = frozenYeti.position.calculateAngleBetween(collidingEntity.position);
      damageEntity(collidingEntity, 5, 250, hitDirection, frozenYeti, PlayerCauseOfDeath.yeti, 0, "frozen_yeti");
      addLocalInvulnerabilityHash(healthComponent, "frozen_yeti", 0.3);
   }
}

export function onFrozenYetiHurt(frozenYeti: Entity, attackingEntity: Entity, damage: number): void {
   const frozenYetiComponent = FrozenYetiComponentArray.getComponent(frozenYeti);

   // Update/create the entity's targetInfo record
   if (frozenYetiComponent.attackingEntities.hasOwnProperty(attackingEntity.id)) {
      frozenYetiComponent.attackingEntities[attackingEntity.id].damageDealtToSelf += damage;
      frozenYetiComponent.attackingEntities[attackingEntity.id].timeSinceLastAggro += 0;
   } else {
      frozenYetiComponent.attackingEntities[attackingEntity.id] = {
         damageDealtToSelf: damage,
         timeSinceLastAggro: 0
      };
   }
}

export function onFrozenYetiDeath(frozenYeti: Entity, attackingEntity: Entity | null): void {
   createItemsOverEntity(frozenYeti, ItemType.raw_beef, randInt(13, 18));

   if (attackingEntity !== null && (attackingEntity.type === IEntityType.player || attackingEntity.type === IEntityType.tribeWorker || attackingEntity.type === IEntityType.tribeWarrior)) {
      createItemsOverEntity(frozenYeti, ItemType.deepfrost_heart, randInt(2, 3));
      createItemsOverEntity(frozenYeti, ItemType.yeti_hide, randInt(5, 7));
   }
}

export function onFrozenYetiRemove(frozenYeti: Entity): void {
   HealthComponentArray.removeComponent(frozenYeti);
   StatusEffectComponentArray.removeComponent(frozenYeti);
   AIHelperComponentArray.removeComponent(frozenYeti);
   FrozenYetiComponentArray.removeComponent(frozenYeti);
   WanderAIComponentArray.removeComponent(frozenYeti);
}