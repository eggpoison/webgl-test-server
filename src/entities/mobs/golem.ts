import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, I_TPS, Point, SETTINGS, StatusEffectConst, distance, lerp } from "webgl-test-shared";
import Entity from "../../Entity";
import { GolemComponentArray, HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { GolemComponent } from "../../components/GolemComponent";
import Board from "../../Board";

export const BODY_GENERATION_RADIUS = 55;

const ROCK_SMALL_MASS = 0.75;
const ROCK_MEDIUM_MASS = 1;
const ROCK_LARGE_MASS = 1.25;

const TARGET_ENTITY_FORGET_TIME = 10;

export const GOLEM_WAKE_TIME_TICKS = Math.floor(2.5 * SETTINGS.TPS);

const hitboxIsTooClose = (golem: Entity, hitboxX: number, hitboxY: number): boolean => {
   for (let j = 0; j < golem.hitboxes.length; j++) {
      const otherHitbox = golem.hitboxes[j];

      const dist = distance(hitboxX, hitboxY, golem.position.x + otherHitbox.offset.x, golem.position.y + otherHitbox.offset.y);
      if (dist <= (otherHitbox as CircularHitbox).radius + 2) {
         return true;
      }
   }

   return false;
}

const getMinSeparationFromOtherHitboxes = (golem: Entity, hitboxX: number, hitboxY: number, hitboxRadius: number): number => {
   let minSeparation = 999.9;
   for (let i = 0; i < golem.hitboxes.length; i++) {
      const otherHitbox = golem.hitboxes[i] as CircularHitbox;

      const dist = distance(hitboxX, hitboxY, golem.position.x + otherHitbox.offset.x, golem.position.y + otherHitbox.offset.y);
      const separation = dist - otherHitbox.radius - hitboxRadius;
      if (separation < minSeparation) {
         minSeparation = separation;
      }
   }
   return minSeparation;
}

const updateGolemHitboxPositions = (golem: Entity, golemComponent: GolemComponent, wakeProgress: number): void => {
   for (let i = 0; i < golem.hitboxes.length; i++) {
      const hitbox = golem.hitboxes[i];

      const rockInfo = golemComponent.rockInfoRecord[hitbox.localID];
      hitbox.offset.x = lerp(rockInfo.sleepOffsetX, rockInfo.awakeOffsetX, wakeProgress);
      hitbox.offset.y = lerp(rockInfo.sleepOffsetY, rockInfo.awakeOffsetY, wakeProgress);
   }
}

export function createGolem(position: Point): Entity {
   const golem = new Entity(position, IEntityType.golem, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   // Create core hitbox
   const hitbox = new CircularHitbox(golem, ROCK_LARGE_MASS, 0, 0, 32, 0);
   golem.addHitbox(hitbox);

   // Create head hitbox
   golem.addHitbox(new CircularHitbox(golem, ROCK_LARGE_MASS, 0, 45, 36, 1));
   
   // Create body hitboxes
   let i = 0;
   let attempts = 0;
   while (i < 8 && ++attempts < 100) {
      const offsetMagnitude = BODY_GENERATION_RADIUS * Math.random();
      const offsetDirection = 2 * Math.PI * Math.random();
      const offsetX = offsetMagnitude * Math.sin(offsetDirection);
      const offsetY = offsetMagnitude * Math.cos(offsetDirection);
      const x = golem.position.x + offsetX;
      const y = golem.position.y + offsetY;

      const size = Math.random() < 0.4 ? 0 : 1;
      const radius = size === 0 ? 20 : 26;

      // Make sure the hitboxes aren't too close
      if (hitboxIsTooClose(golem, x, y)) {
         continue;
      }

      // Make sure the hitbox touches another one at least a small amount
      const minSeparation = getMinSeparationFromOtherHitboxes(golem, x, y, radius);
      if (minSeparation > -6) {
         continue;
      }

      const mass = size === 0 ? ROCK_SMALL_MASS : ROCK_MEDIUM_MASS;
      const hitbox = new CircularHitbox(golem, mass, offsetX, offsetY, radius, 2 + i);
      golem.addHitbox(hitbox);

      i++;
   }

   // Create hand hitboxes
   for (let j = 0; j < 2; j++) {
      const offsetX = 60 * (j === 0 ? -1 : 1);
      const hitbox = new CircularHitbox(golem, ROCK_MEDIUM_MASS, offsetX, 50, 20, 2 + i + j);
      golem.addHitbox(hitbox);
   }

   HealthComponentArray.addComponent(golem, new HealthComponent(150));
   StatusEffectComponentArray.addComponent(golem, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.burning | StatusEffectConst.poisoned));
   const golemComponent = new GolemComponent(golem.hitboxes);
   GolemComponentArray.addComponent(golem, golemComponent);

   updateGolemHitboxPositions(golem, golemComponent, 0);

   golem.rotation = 2 * Math.PI * Math.random();
   
   return golem;
}

const getTarget = (golemComponent: GolemComponent): Entity => {
   let mostDamage = 0;
   let mostDamagingEntity!: Entity;
   for (const _targetID of Object.keys(golemComponent.attackingEntities)) {
      const targetID = Number(_targetID);

      const damageDealt = golemComponent.attackingEntities[targetID].damageDealtToSelf;
      if (damageDealt > mostDamage) {
         mostDamage = damageDealt;
         mostDamagingEntity = Board.entityRecord[targetID];
      }
   }
   return mostDamagingEntity;
}

export function tickGolem(golem: Entity): void {
   const golemComponent = GolemComponentArray.getComponent(golem);
   
   // Remove targets which are dead or have been out of aggro long enough
   // @Speed: Remove calls to Object.keys, Number, and hasOwnProperty
   // @Cleanup: Copy and paste from frozen-yeti
   for (const _targetID of Object.keys(golemComponent.attackingEntities)) {
      const targetID = Number(_targetID);

      if (!Board.entityRecord.hasOwnProperty(targetID)) {
         delete golemComponent.attackingEntities[targetID];
         continue;
      }

      golemComponent.attackingEntities[targetID].timeSinceLastAggro += I_TPS;
      if (golemComponent.attackingEntities[targetID].timeSinceLastAggro >= TARGET_ENTITY_FORGET_TIME) {
         delete golemComponent.attackingEntities[targetID];
      }
   }
   
   if (Object.keys(golemComponent.attackingEntities).length === 0) {
      return;
   }

   const target = getTarget(golemComponent);

   // Wake up
   if (golemComponent.wakeTimerTicks < GOLEM_WAKE_TIME_TICKS) {
      const wakeProgress = golemComponent.wakeTimerTicks / GOLEM_WAKE_TIME_TICKS;
      updateGolemHitboxPositions(golem, golemComponent, wakeProgress);
      
      golemComponent.wakeTimerTicks++;

      golem.turn(golem.position.calculateAngleBetween(target.position), Math.PI / 4);
   }
}

// @Cleanup: Copy and paste from frozen-yeti
export function onGolemHurt(golem: Entity, attackingEntity: Entity, damage: number): void {
   const golemComponent = GolemComponentArray.getComponent(golem);

   // Update/create the entity's targetInfo record
   if (golemComponent.attackingEntities.hasOwnProperty(attackingEntity.id)) {
      golemComponent.attackingEntities[attackingEntity.id].damageDealtToSelf += damage;
      golemComponent.attackingEntities[attackingEntity.id].timeSinceLastAggro += 0;
   } else {
      golemComponent.attackingEntities[attackingEntity.id] = {
         damageDealtToSelf: damage,
         timeSinceLastAggro: 0
      };
   }
}

export function onGolemRemove(golem: Entity): void {
   HealthComponentArray.removeComponent(golem);
   StatusEffectComponentArray.removeComponent(golem);
   GolemComponentArray.removeComponent(golem);
}