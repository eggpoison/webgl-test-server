import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray, TribeComponentArray, TurretComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import Tribe from "../../Tribe";
import { EntityRelationship, TribeComponent, getTribeMemberRelationship } from "../../components/TribeComponent";
import { createSlingRock } from "../projectiles/sling-rock";
import { getAngleDiff } from "../../ai-shared";
import { TurretComponent } from "../../components/TurretComponent";

// @Cleanup: A lot of copy and paste from ballista.ts


const COOLDOWN_TICKS = 1.5 * SETTINGS.TPS;
const RELOAD_TIME_TICKS = Math.floor(0.4 * SETTINGS.TPS);
const VISION_RANGE = 300;

export function createSlingTurret(position: Point, tribe: Tribe | null): Entity {
   const turret = new Entity(position, IEntityType.slingTurret, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   turret.addHitbox(new CircularHitbox(turret, 1.5, 0, 0, 40 - 0.05, 0));

   HealthComponentArray.addComponent(turret, new HealthComponent(25));
   StatusEffectComponentArray.addComponent(turret, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TurretComponentArray.addComponent(turret, new TurretComponent(COOLDOWN_TICKS));
   TribeComponentArray.addComponent(turret, new TribeComponent(tribe));
   AIHelperComponentArray.addComponent(turret, new AIHelperComponent(VISION_RANGE));
   
   return turret;
}

const entityIsTargetted = (entity: Entity, tribeComponent: TribeComponent): boolean => {
   if (!HealthComponentArray.hasComponent(entity)) {
      return false;
   }
   
   return getTribeMemberRelationship(tribeComponent, entity) > EntityRelationship.friendlyBuilding;
}

const getTarget = (turret: Entity, visibleEntities: ReadonlyArray<Entity>): Entity | null => {
   const tribeComponent = TribeComponentArray.getComponent(turret);
   
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
   const tribeComponent = TribeComponentArray.getComponent(turret);
   
   const spawnPosition = turret.position.copy();
   const rock = createSlingRock(spawnPosition, tribeComponent.tribe);

   const direction = slingTurretComponent.aimDirection + turret.rotation;
   rock.rotation = direction;
   rock.velocity.x = 550 * Math.sin(direction);
   rock.velocity.y = 550 * Math.cos(direction);
}

export function tickSlingTurret(turret: Entity): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(turret);
   const slingTurretComponent = TurretComponentArray.getComponent(turret);

   if (aiHelperComponent.visibleEntities.length > 0) {
      const target = getTarget(turret, aiHelperComponent.visibleEntities);
      if (target !== null) {
         const targetDirection = turret.position.calculateAngleBetween(target.position);

         const turretAimDirection = slingTurretComponent.aimDirection + turret.rotation;

         // Turn to face the target
         const angleDiff = getAngleDiff(turretAimDirection, targetDirection);
         if (angleDiff < 0) {
            slingTurretComponent.aimDirection -= Math.PI / SETTINGS.TPS;
         } else {
            slingTurretComponent.aimDirection += Math.PI / SETTINGS.TPS;
         }

         if (slingTurretComponent.fireCooldownTicks > 0) {
            slingTurretComponent.fireCooldownTicks--;
         }

         const newAngleDiff = getAngleDiff(slingTurretComponent.aimDirection + turret.rotation, targetDirection);
         if (Math.abs(newAngleDiff) > Math.abs(angleDiff) || Math.sign(newAngleDiff) !== Math.sign(angleDiff)) {
            slingTurretComponent.aimDirection = targetDirection - turret.rotation;
            if (slingTurretComponent.fireCooldownTicks === 0) {
               fire(turret, slingTurretComponent);
               slingTurretComponent.fireCooldownTicks = COOLDOWN_TICKS + RELOAD_TIME_TICKS;
            }
         }
         return;
      }
   }

   if (slingTurretComponent.fireCooldownTicks < COOLDOWN_TICKS) {
      slingTurretComponent.fireCooldownTicks = COOLDOWN_TICKS;
   }
}

export function onSlingTurretRemove(turret: Entity): void {
   HealthComponentArray.removeComponent(turret);
   StatusEffectComponentArray.removeComponent(turret);
   TurretComponentArray.removeComponent(turret);
   TribeComponentArray.removeComponent(turret);
   AIHelperComponentArray.removeComponent(turret);
}

export function getSlingTurretChargeProgress(slingTurretComponent: TurretComponent): number {
   if (slingTurretComponent.fireCooldownTicks > COOLDOWN_TICKS) {
      return 0;
   }
   
   return 1 - slingTurretComponent.fireCooldownTicks / COOLDOWN_TICKS;
}

export function getSlingTurretReloadProgress(slingTurretComponent: TurretComponent): number {
   if (slingTurretComponent.fireCooldownTicks < COOLDOWN_TICKS) {
      return 0;
   }

   return 1 - (slingTurretComponent.fireCooldownTicks - COOLDOWN_TICKS) / RELOAD_TIME_TICKS;
}