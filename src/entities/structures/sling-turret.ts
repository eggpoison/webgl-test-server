import { COLLISION_BITS, DEFAULT_COLLISION_MASK, GenericArrowType, HitboxCollisionTypeConst, IEntityType, Point, SettingsConst, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, TribeComponentArray, TurretComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import Tribe from "../../Tribe";
import { EntityRelationship, TribeComponent, getEntityRelationship } from "../../components/TribeComponent";
import { getAngleDiff } from "../../ai-shared";
import { TurretComponent } from "../../components/TurretComponent";
import { GenericArrowInfo, createWoodenArrow } from "../projectiles/wooden-arrow";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";

// @Cleanup: A lot of copy and paste from ballista.ts


export const SLING_TURRET_SHOT_COOLDOWN_TICKS = 1.5 * SettingsConst.TPS;
export const SLING_TURRET_RELOAD_TIME_TICKS = Math.floor(0.4 * SettingsConst.TPS);
const VISION_RANGE = 400;

export function createSlingTurretHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   hitboxes.push(new CircularHitbox(entity.position.x, entity.position.y, 1.5, 0, 0, HitboxCollisionTypeConst.hard, 40 - 0.05, entity.getNextHitboxLocalID(), entity.rotation));
   return hitboxes;
}

export function createSlingTurret(position: Point, rotation: number, tribe: Tribe): Entity {
   const slingTurret = new Entity(position, IEntityType.slingTurret, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   slingTurret.rotation = rotation;

   const hitboxes = createSlingTurretHitboxes(slingTurret);
   for (let i = 0; i < hitboxes.length; i++) {
      slingTurret.addHitbox(hitboxes[i]);
   }

   HealthComponentArray.addComponent(slingTurret, new HealthComponent(25));
   StatusEffectComponentArray.addComponent(slingTurret, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TurretComponentArray.addComponent(slingTurret, new TurretComponent(SLING_TURRET_SHOT_COOLDOWN_TICKS));
   TribeComponentArray.addComponent(slingTurret, new TribeComponent(tribe));
   AIHelperComponentArray.addComponent(slingTurret, new AIHelperComponent(VISION_RANGE));
   
   return slingTurret;
}

const entityIsTargetted = (entity: Entity, tribeComponent: TribeComponent): boolean => {
   if (!HealthComponentArray.hasComponent(entity)) {
      return false;
   }
   
   const relationship = getEntityRelationship(tribeComponent, entity);
   return relationship > EntityRelationship.friendlyBuilding && relationship !== EntityRelationship.resource;
}

const getTarget = (turret: Entity, visibleEntities: ReadonlyArray<Entity>): Entity | null => {
   const tribeComponent = TribeComponentArray.getComponent(turret.id);
   
   let closestValidTarget: Entity;
   let minDist = 9999999.9;
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];
      if (!entityIsTargetted(entity, tribeComponent)) {
         continue;
      }

      const dist = entity.position.calculateDistanceSquaredBetween(turret.position);
      if (dist < minDist) {
         minDist = dist;
         closestValidTarget = entity;
      }
   }

   if (minDist < 9999999.9) {
      return closestValidTarget!;
   }
   return null;
}

const fire = (turret: Entity, slingTurretComponent: TurretComponent): void => {
   const arrowInfo: GenericArrowInfo = {
      type: GenericArrowType.slingRock,
      damage: 2,
      knockback: 75,
      hitboxWidth: 20,
      hitboxHeight: 20,
      ignoreFriendlyBuildings: true,
      statusEffect: null
   };
   
   const spawnPosition = turret.position.copy();
   const rock = createWoodenArrow(spawnPosition, turret, arrowInfo);

   const direction = slingTurretComponent.aimDirection + turret.rotation;
   rock.rotation = direction;
   rock.velocity.x = 550 * Math.sin(direction);
   rock.velocity.y = 550 * Math.cos(direction);
}

export function tickSlingTurret(turret: Entity): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(turret.id);
   const slingTurretComponent = TurretComponentArray.getComponent(turret.id);

   if (aiHelperComponent.visibleEntities.length > 0) {
      const target = getTarget(turret, aiHelperComponent.visibleEntities);
      if (target !== null) {
         const targetDirection = turret.position.calculateAngleBetween(target.position);

         const turretAimDirection = slingTurretComponent.aimDirection + turret.rotation;

         // Turn to face the target
         const angleDiff = getAngleDiff(turretAimDirection, targetDirection);
         if (angleDiff < 0) {
            slingTurretComponent.aimDirection -= Math.PI * SettingsConst.I_TPS;
         } else {
            slingTurretComponent.aimDirection += Math.PI * SettingsConst.I_TPS;
         }

         if (slingTurretComponent.fireCooldownTicks > 0) {
            slingTurretComponent.fireCooldownTicks--;
         }

         const newAngleDiff = getAngleDiff(slingTurretComponent.aimDirection + turret.rotation, targetDirection);
         if (Math.abs(newAngleDiff) > Math.abs(angleDiff) || Math.sign(newAngleDiff) !== Math.sign(angleDiff)) {
            slingTurretComponent.aimDirection = targetDirection - turret.rotation;
            if (slingTurretComponent.fireCooldownTicks === 0) {
               fire(turret, slingTurretComponent);
               slingTurretComponent.fireCooldownTicks = SLING_TURRET_SHOT_COOLDOWN_TICKS + SLING_TURRET_RELOAD_TIME_TICKS;
            }
         }
         return;
      }
   }

   if (slingTurretComponent.fireCooldownTicks < SLING_TURRET_SHOT_COOLDOWN_TICKS) {
      slingTurretComponent.fireCooldownTicks = SLING_TURRET_SHOT_COOLDOWN_TICKS;
   }
}

export function onSlingTurretRemove(turret: Entity): void {
   HealthComponentArray.removeComponent(turret);
   StatusEffectComponentArray.removeComponent(turret);
   TurretComponentArray.removeComponent(turret);
   TribeComponentArray.removeComponent(turret);
   AIHelperComponentArray.removeComponent(turret);
}