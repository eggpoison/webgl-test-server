import { BALLISTA_AMMO_TYPES, BallistaAmmoType, COLLISION_BITS, DEFAULT_COLLISION_MASK, GenericArrowType, IEntityType, ItemType, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, StatusEffectComponentArray, TribeComponentArray, TurretComponentArray } from "../../components/ComponentArray";
import { EntityRelationship, TribeComponent, getTribeMemberRelationship } from "../../components/TribeComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TurretComponent } from "../../components/TurretComponent";
import { HealthComponent } from "../../components/HealthComponent";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { GenericArrowInfo, createWoodenArrow } from "../projectiles/wooden-arrow";
import { InventoryComponent, createNewInventory, getFirstOccupiedItemSlotInInventory, getInventory, getItemFromInventory } from "../../components/InventoryComponent";
import { angleIsInRange, getMaxAngleToCircularHitbox, getMaxAngleToRectangularHitbox, getMinAngleToCircularHitbox, getMinAngleToRectangularHitbox } from "../../ai-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";

interface AmmoInfo {
   readonly type: GenericArrowType;
   readonly damage: number;
   readonly knockback: number;
   readonly shotCooldownTicks: number;
   readonly reloadTimeTicks: number;
   readonly projectileSpeed: number;
   readonly hitboxWidth: number;
   readonly hitboxHeight: number;
   readonly ammoMultiplier: number;
}

const AMMO_INFO_RECORD: Record<BallistaAmmoType, AmmoInfo> = {
   [ItemType.wood]: {
      type: GenericArrowType.woodenBolt,
      damage: 5,
      knockback: 150,
      shotCooldownTicks: 2.5 * SETTINGS.TPS,
      reloadTimeTicks: Math.floor(0.4 * SETTINGS.TPS),
      projectileSpeed: 1000,
      hitboxWidth: 12,
      hitboxHeight: 80,
      ammoMultiplier: 2
   },
   [ItemType.rock]: {
      type: GenericArrowType.ballistaRock,
      damage: 8,
      knockback: 300,
      shotCooldownTicks: 3 * SETTINGS.TPS,
      reloadTimeTicks: Math.floor(0.5 * SETTINGS.TPS),
      projectileSpeed: 1000,
      hitboxWidth: 12,
      hitboxHeight: 80,
      ammoMultiplier: 2
   },
   [ItemType.slimeball]: {
      type: GenericArrowType.woodenBolt,
      damage: 3,
      knockback: 0,
      shotCooldownTicks: 2 * SETTINGS.TPS,
      reloadTimeTicks: Math.floor(0.4 * SETTINGS.TPS),
      projectileSpeed: 800,
      hitboxWidth: 12,
      hitboxHeight: 80,
      ammoMultiplier: 3
   },
   [ItemType.frostcicle]: {
      type: GenericArrowType.woodenBolt,
      damage: 1,
      knockback: 50,
      shotCooldownTicks: 0.6 * SETTINGS.TPS,
      reloadTimeTicks: Math.floor(0.15 * SETTINGS.TPS),
      projectileSpeed: 1500,
      hitboxWidth: 12,
      hitboxHeight: 80,
      ammoMultiplier: 5
   }
}

const VISION_RANGE = 500;
const HITBOX_SIZE = 100 - 0.05;
const AIM_ARC_SIZE = Math.PI / 2;

export function createBallista(position: Point, tribe: Tribe | null): Entity {
   const turret = new Entity(position, IEntityType.ballista, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   turret.addHitbox(new RectangularHitbox(turret, 2, 0, 0, HITBOX_SIZE, HITBOX_SIZE, 0));
   
   HealthComponentArray.addComponent(turret, new HealthComponent(50));
   StatusEffectComponentArray.addComponent(turret, new StatusEffectComponent(StatusEffectConst.poisoned | StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(turret, new TribeComponent(tribe));
   TurretComponentArray.addComponent(turret, new TurretComponent(0));
   AIHelperComponentArray.addComponent(turret, new AIHelperComponent(VISION_RANGE));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(turret, inventoryComponent);
   createNewInventory(inventoryComponent, "ammoBoxInventory", 3, 1, false);

   return turret;
}

const getAmmoType = (turret: Entity): BallistaAmmoType | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(turret);
   const ammoBoxInventory = getInventory(inventoryComponent, "ammoBoxInventory");

   const firstOccupiedSlot = getFirstOccupiedItemSlotInInventory(ammoBoxInventory);
   if (firstOccupiedSlot === 0) {
      return null;
   }

   const item = getItemFromInventory(ammoBoxInventory, firstOccupiedSlot)!;
   if (!BALLISTA_AMMO_TYPES.includes(item.type as BallistaAmmoType)) {
      console.warn("Item type in ammo box isn't ammo");
      return null;
   }

   return item.type as BallistaAmmoType;
}

const entityIsTargetted = (turret: Entity, entity: Entity, tribeComponent: TribeComponent): boolean => {
   if (entity.type === IEntityType.itemEntity) {
      return false;
   }

   const minAngle = turret.rotation - AIM_ARC_SIZE / 2;
   const maxAngle = turret.rotation + AIM_ARC_SIZE / 2;

   // Make sure at least 1 of the entities' hitboxes is within the arc
   let isInRange = false;
   for (let i = 0; i < entity.hitboxes.length; i++) {
      let minAngleToHitbox: number;
      let maxAngleToHitbox: number;
      
      const hitbox = entity.hitboxes[i];
      if (hitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         minAngleToHitbox = getMinAngleToCircularHitbox(turret.position.x, turret.position.y, hitbox as CircularHitbox);
         maxAngleToHitbox = getMaxAngleToCircularHitbox(turret.position.x, turret.position.y, hitbox as CircularHitbox);
      } else {
         // Rectangular hitbox
         minAngleToHitbox = getMinAngleToRectangularHitbox(turret.position.x, turret.position.y, hitbox as RectangularHitbox);
         maxAngleToHitbox = getMaxAngleToRectangularHitbox(turret.position.x, turret.position.y, hitbox as RectangularHitbox);
      }

      if (angleIsInRange(minAngleToHitbox, minAngle, maxAngle) || angleIsInRange(maxAngleToHitbox, minAngle, maxAngle)) {
         isInRange = true;
      }
   }
   if (!isInRange) {
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
      if (!entityIsTargetted(turret, entity, tribeComponent)) {
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

const fire = (turret: Entity, ammoType: BallistaAmmoType): void => {
   const turretComponent = TurretComponentArray.getComponent(turret);

   const ammoInfo = AMMO_INFO_RECORD[ammoType];
   
   const arrowInfo: GenericArrowInfo = {
      type: ammoInfo.type,
      damage: ammoInfo.damage,
      knockback: ammoInfo.knockback,
      width: ammoInfo.hitboxWidth,
      height: ammoInfo.hitboxHeight,
      ignoreFriendlyBuildings: true
   };

   // @Incomplete: Spawn slightly offset from the turret's position
   if (ammoType === ItemType.frostcicle) {
      // Frostcicles shoot twin bolts
      for (let i = 0; i < 2; i++) {
         const spawnPosition = turret.position.copy();
         const bolt = createWoodenArrow(spawnPosition, turret, arrowInfo);
   
         const direction = turretComponent.aimDirection + turret.rotation + (i === 0 ? 1 : -1) * 0.02;
         bolt.rotation = direction;
         bolt.velocity.x = ammoInfo.projectileSpeed * Math.sin(direction);
         bolt.velocity.y = ammoInfo.projectileSpeed * Math.cos(direction);
      }
   } else {
      const spawnPosition = turret.position.copy();
      const bolt = createWoodenArrow(spawnPosition, turret, arrowInfo);

      const direction = turretComponent.aimDirection + turret.rotation;
      bolt.rotation = direction;
      bolt.velocity.x = ammoInfo.projectileSpeed * Math.sin(direction);
      bolt.velocity.y = ammoInfo.projectileSpeed * Math.cos(direction);
   }
}

export function tickBallista(ballista: Entity): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(ballista);
   const turretComponent = TurretComponentArray.getComponent(ballista);

   const ammoType = getAmmoType(ballista);

   if (aiHelperComponent.visibleEntities.length > 0 && ammoType !== null) {
      const target = getTarget(ballista, aiHelperComponent.visibleEntities);
      if (target !== null) {
         // If the ballista has just acquired a target, reset the shot cooldown
         if (!turretComponent.hasTarget) {
            const ammoInfo = AMMO_INFO_RECORD[ammoType];
            turretComponent.fireCooldownTicks = ammoInfo.shotCooldownTicks;
         }
         turretComponent.hasTarget = true;

         const targetDirection = ballista.position.calculateAngleBetween(target.position);

         const turretAimDirection = turretComponent.aimDirection + ballista.rotation;

         // Turn to face the target
         const angleDiff = targetDirection - turretAimDirection;
         if (angleDiff < 0) {
            turretComponent.aimDirection -= Math.PI / 3 / SETTINGS.TPS;
            if (turretComponent.aimDirection + ballista.rotation < targetDirection) {
               turretComponent.aimDirection = targetDirection - ballista.rotation;
            }
         } else {
            turretComponent.aimDirection += Math.PI / 3 / SETTINGS.TPS;
            if (turretComponent.aimDirection + ballista.rotation > targetDirection) {
               turretComponent.aimDirection = targetDirection - ballista.rotation;
            }
         }
         if (turretComponent.fireCooldownTicks > 0) {
            turretComponent.fireCooldownTicks--;
         } else if (Math.abs(angleDiff) < 0.01) {
            fire(ballista, ammoType);

            // Reset firing cooldown
            const ammoInfo = AMMO_INFO_RECORD[ammoType];
            turretComponent.fireCooldownTicks = ammoInfo.shotCooldownTicks + ammoInfo.reloadTimeTicks;
         }
         return;
      }
   }

   turretComponent.hasTarget = false;
   turretComponent.fireCooldownTicks = 0;
}

export function onBallistaRemove(ballista: Entity): void {
   HealthComponentArray.removeComponent(ballista);
   StatusEffectComponentArray.removeComponent(ballista);
   TribeComponentArray.removeComponent(ballista);
   TurretComponentArray.removeComponent(ballista);
   AIHelperComponentArray.removeComponent(ballista);
   InventoryComponentArray.removeComponent(ballista);
}

// @Copynpaste: Following 2 functions copied from sling-turret.ts. Perhaps unify into 1 component?

export function getBallistaChargeProgress(ballista: Entity): number {
   const ammo = getAmmoType(ballista);
   if (ammo === null) {
      return 0;
   }

   const shotCooldownTicks = AMMO_INFO_RECORD[ammo].shotCooldownTicks;
   const turretComponent = TurretComponentArray.getComponent(ballista);
   
   if (turretComponent.fireCooldownTicks > shotCooldownTicks) {
      return 0;
   }

   return 1 - turretComponent.fireCooldownTicks / shotCooldownTicks;
}

export function getBallistaReloadProgress(ballista: Entity): number {
   const ammo = getAmmoType(ballista);
   if (ammo === null) {
      return 0;
   }

   const shotCooldownTicks = AMMO_INFO_RECORD[ammo].shotCooldownTicks;
   const turretComponent = TurretComponentArray.getComponent(ballista);

   if (turretComponent.fireCooldownTicks < shotCooldownTicks) {
      return 0;
   }
   
   const reloadTimeTicks = AMMO_INFO_RECORD[ammo].reloadTimeTicks;
   return 1 - (turretComponent.fireCooldownTicks - shotCooldownTicks) / reloadTimeTicks;
}