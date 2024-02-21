import { AMMO_INFO_RECORD, BALLISTA_AMMO_TYPES, BallistaAmmoType, COLLISION_BITS, DEFAULT_COLLISION_MASK, GenericArrowType, IEntityType, ItemType, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import Tribe from "../../Tribe";
import { BallistaComponentArray, HealthComponentArray, InventoryComponentArray, StatusEffectComponentArray, TribeComponentArray, TurretComponentArray } from "../../components/ComponentArray";
import { EntityRelationship, TribeComponent, getTribeMemberRelationship } from "../../components/TribeComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TurretComponent } from "../../components/TurretComponent";
import { HealthComponent } from "../../components/HealthComponent";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { BallistaComponent } from "../../components/BallistaComponent";
import { GenericArrowInfo, createWoodenArrow } from "../projectiles/wooden-arrow";
import { InventoryComponent, consumeItemTypeFromInventory, createNewInventory, getFirstOccupiedItemSlotInInventory, getInventory, getItemFromInventory } from "../../components/InventoryComponent";
import { angleIsInRange, getMaxAngleToCircularHitbox, getMaxAngleToRectangularHitbox, getMinAngleToCircularHitbox, getMinAngleToRectangularHitbox } from "../../ai-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Board from "../../Board";

const VISION_RANGE = 550;
const HITBOX_SIZE = 100 - 0.05;
// @Temporary
// const AIM_ARC_SIZE = Math.PI / 2.3;
const AIM_ARC_SIZE = Math.PI * 2;

export function addBallistaHitboxes(entity: Entity): void {
   entity.addHitbox(new RectangularHitbox(entity, 2, 0, 0, HITBOX_SIZE, HITBOX_SIZE, 0));
}

export function createBallista(position: Point, tribe: Tribe | null, rotation: number): Entity {
   const ballista = new Entity(position, IEntityType.ballista, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   ballista.rotation = rotation;

   addBallistaHitboxes(ballista);
   
   HealthComponentArray.addComponent(ballista, new HealthComponent(50));
   StatusEffectComponentArray.addComponent(ballista, new StatusEffectComponent(StatusEffectConst.poisoned | StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(ballista, new TribeComponent(tribe));
   TurretComponentArray.addComponent(ballista, new TurretComponent(0));
   AIHelperComponentArray.addComponent(ballista, new AIHelperComponent(VISION_RANGE));
   BallistaComponentArray.addComponent(ballista, new BallistaComponent());

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(ballista, inventoryComponent);
   createNewInventory(inventoryComponent, "ammoBoxInventory", 3, 1, false);

   return ballista;
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

   if (getTribeMemberRelationship(tribeComponent, entity) <= EntityRelationship.friendlyBuilding) {
      return false;
   }

   // Make sure the entity is within the vision range
   let hasHitboxInRange = false;
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];
      if (Board.hitboxIsInRange(turret.position, hitbox, VISION_RANGE)) {
         hasHitboxInRange = true;
         break;
      }
   }
   if (!hasHitboxInRange) {
      return false;
   }

   const minAngle = turret.rotation - AIM_ARC_SIZE / 2;
   const maxAngle = turret.rotation + AIM_ARC_SIZE / 2;

   // Make sure at least 1 of the entities' hitboxes is within the arc
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
         return true;
      }
   }

   return false;
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

const attemptAmmoLoad = (ballista: Entity): void => {
   const ballistaComponent = BallistaComponentArray.getComponent(ballista);
   
   const ammoType = getAmmoType(ballista);
   if (ammoType !== null) {
      // Load the ammo
      ballistaComponent.ammoType = ammoType;
      ballistaComponent.ammoRemaining = AMMO_INFO_RECORD[ammoType].ammoMultiplier;

      const inventoryComponent = InventoryComponentArray.getComponent(ballista);
      consumeItemTypeFromInventory(inventoryComponent, "ammoBoxInventory", ammoType, 1);
   }
}

const fire = (ballista: Entity, ammoType: BallistaAmmoType): void => {
   const turretComponent = TurretComponentArray.getComponent(ballista);

   const ammoInfo = AMMO_INFO_RECORD[ammoType];
   
   const arrowInfo: GenericArrowInfo = {
      type: ammoInfo.type,
      damage: ammoInfo.damage,
      knockback: ammoInfo.knockback,
      hitboxWidth: ammoInfo.hitboxWidth,
      hitboxHeight: ammoInfo.hitboxHeight,
      ignoreFriendlyBuildings: true,
      statusEffect: ammoInfo.statusEffect
   };

   // @Incomplete: Spawn slightly offset from the turret's position
   if (ammoType === ItemType.frostcicle) {
      // Frostcicles shoot twin bolts
      for (let i = 0; i < 2; i++) {
         const spawnPosition = ballista.position.copy();
         const bolt = createWoodenArrow(spawnPosition, ballista, arrowInfo);
   
         const direction = turretComponent.aimDirection + ballista.rotation + (i === 0 ? 1 : -1) * 0.02;
         bolt.rotation = direction;
         bolt.velocity.x = ammoInfo.projectileSpeed * Math.sin(direction);
         bolt.velocity.y = ammoInfo.projectileSpeed * Math.cos(direction);
      }
   } else {
      const spawnPosition = ballista.position.copy();
      const bolt = createWoodenArrow(spawnPosition, ballista, arrowInfo);

      const direction = turretComponent.aimDirection + ballista.rotation;
      bolt.rotation = direction;
      bolt.velocity.x = ammoInfo.projectileSpeed * Math.sin(direction);
      bolt.velocity.y = ammoInfo.projectileSpeed * Math.cos(direction);

      if (ammoType === ItemType.rock || ammoType === ItemType.slimeball) {
         bolt.rotation = 2 * Math.PI * Math.random();
      }
   }

   // Consume ammo
   const ballistaComponent = BallistaComponentArray.getComponent(ballista);
   ballistaComponent.ammoRemaining--;

   if (ballistaComponent.ammoRemaining === 0) {
      attemptAmmoLoad(ballista);
   }
}

export function tickBallista(ballista: Entity): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(ballista);
   const turretComponent = TurretComponentArray.getComponent(ballista);
   const ballistaComponent = BallistaComponentArray.getComponent(ballista);

   // Attempt to load ammo if there is none loaded
   // @Speed: ideally shouldn't be done every tick, just when the inventory is changed (ammo is added to the inventory)
   if (ballistaComponent.ammoRemaining === 0) {
      attemptAmmoLoad(ballista);
   }

   if (aiHelperComponent.visibleEntities.length > 0 && ballistaComponent.ammoRemaining > 0) {
      const target = getTarget(ballista, aiHelperComponent.visibleEntities);
      if (target !== null) {
         // If the ballista has just acquired a target, reset the shot cooldown
         if (!turretComponent.hasTarget) {
            const ammoInfo = AMMO_INFO_RECORD[ballistaComponent.ammoType];
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
            fire(ballista, ballistaComponent.ammoType);

            // Reset firing cooldown
            const ammoInfo = AMMO_INFO_RECORD[ballistaComponent.ammoType];
            turretComponent.fireCooldownTicks = ammoInfo.shotCooldownTicks + ammoInfo.reloadTimeTicks;
         }
         return;
      }
   }

   turretComponent.hasTarget = false;
   if (ballistaComponent.ammoType === null) {
      turretComponent.fireCooldownTicks = 0;
   } else {
      const ammoInfo = AMMO_INFO_RECORD[ballistaComponent.ammoType];
      if (turretComponent.fireCooldownTicks <= ammoInfo.shotCooldownTicks) {
         turretComponent.fireCooldownTicks = ammoInfo.shotCooldownTicks;
      } else {
         // Continue reloading even when there are no targets
         turretComponent.fireCooldownTicks--;
      }
   }
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
   const ballistaComponent = BallistaComponentArray.getComponent(ballista);
   if (ballistaComponent.ammoRemaining === 0) {
      return 0;
   }

   const shotCooldownTicks = AMMO_INFO_RECORD[ballistaComponent.ammoType].shotCooldownTicks;
   const turretComponent = TurretComponentArray.getComponent(ballista);
   
   if (turretComponent.fireCooldownTicks > shotCooldownTicks) {
      return 0;
   }

   return 1 - turretComponent.fireCooldownTicks / shotCooldownTicks;
}

export function getBallistaReloadProgress(ballista: Entity): number {
   const ballistaComponent = BallistaComponentArray.getComponent(ballista);
   if (ballistaComponent.ammoRemaining === 0) {
      return 0;
   }

   const shotCooldownTicks = AMMO_INFO_RECORD[ballistaComponent.ammoType].shotCooldownTicks;
   const turretComponent = TurretComponentArray.getComponent(ballista);

   if (turretComponent.fireCooldownTicks < shotCooldownTicks) {
      return 0;
   }
   
   const reloadTimeTicks = AMMO_INFO_RECORD[ballistaComponent.ammoType].reloadTimeTicks;
   return 1 - (turretComponent.fireCooldownTicks - shotCooldownTicks) / reloadTimeTicks;
}