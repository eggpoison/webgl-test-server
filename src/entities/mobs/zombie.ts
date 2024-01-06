import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst, randFloat, randInt } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../Entity";
import { AIHelperComponentArray, HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, StatusEffectComponentArray, TombstoneComponentArray, WanderAIComponentArray, ZombieComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, applyKnockback, damageEntity, healEntity } from "../../components/HealthComponent";
import { ZombieComponent } from "../../components/ZombieComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { InventoryComponent, createNewInventory, getInventory, pickupItemEntity } from "../../components/InventoryComponent";
import Board from "../../Board";
import { StatusEffectComponent, applyStatusEffect, hasStatusEffect } from "../../components/StatusEffectComponent";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { AIHelperComponent } from "../../components/AIHelperComponent";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { attackEntity, calculateRadialAttackTargets } from "../tribes/tribe-member";

const MAX_HEALTH = 20;

const VISION_RANGE = 270;

const ACCELERATION = 275;
const ACCELERATION_SLOW = 150;

const CHASE_PURSUE_TIME = 5;

/** Chance for a zombie to spontaneously combust every second */
const SPONTANEOUS_COMBUSTION_CHANCE = 0.5;

const ATTACK_OFFSET = 40;
const ATTACK_RADIUS = 30;

// @Cleanup: We don't need to pass the isGolden parameter, can deduce whether the tombstone is golden from the tombstoneID instead
export function createZombie(position: Point, isGolden: boolean, tombstoneID: number): Entity {
   const zombie = new Entity(position, IEntityType.zombie, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(zombie, 0, 0, 32);
   zombie.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(zombie, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(zombie, new StatusEffectComponent(0));
   const zombieType = isGolden ? 3 : randInt(0, 2);
   ZombieComponentArray.addComponent(zombie, new ZombieComponent(zombieType, tombstoneID));
   WanderAIComponentArray.addComponent(zombie, new WanderAIComponent());
   AIHelperComponentArray.addComponent(zombie, new AIHelperComponent(VISION_RANGE));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(zombie, inventoryComponent);

   const inventory = createNewInventory(inventoryComponent, "handSlot", 1, 1, true);
   InventoryUseComponentArray.addComponent(zombie, new InventoryUseComponent(inventory));
   
   return zombie;
}

const doMeleeAttack = (zombie: Entity, target: Entity): void => {
   // Find the attack target
   const attackTargets = calculateRadialAttackTargets(zombie, ATTACK_OFFSET, ATTACK_RADIUS);

   // Register the hit
   if (attackTargets.includes(target)) {
      attackEntity(zombie, target, 1, "handSlot");

      // Reset attack cooldown
      const zombieComponent = ZombieComponentArray.getComponent(zombie);
      zombieComponent.attackCooldownTicks = Math.floor(randFloat(1, 2) * SETTINGS.TPS);
   }
}

// @Incomplete: bite wind-up

const doBiteAttack = (zombie: Entity, target: Entity): void => {
   // Lunge at the target
   const lungeDirection = zombie.position.calculateAngleBetween(target.position);
   zombie.velocity.x += 130 * Math.sin(lungeDirection);
   zombie.velocity.y += 130 * Math.cos(lungeDirection);

   // Reset attack cooldown
   const zombieComponent = ZombieComponentArray.getComponent(zombie);
   zombieComponent.attackCooldownTicks = Math.floor(randFloat(3, 4) * SETTINGS.TPS);

   // @Hack
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(zombie);
   inventoryUseComponent.lastAttackTicks = Board.ticks;
}

const doAttack = (zombie: Entity, target: Entity): void => {
   const inventoryComponent = InventoryComponentArray.getComponent(zombie);

   // If holding an item, do a melee attack
   const handInventory = getInventory(inventoryComponent, "handSlot");
   if (handInventory.itemSlots.hasOwnProperty(1)) {
      doMeleeAttack(zombie, target);
   } else {
      doBiteAttack(zombie, target);
   }
}

export function tickZombie(zombie: Entity): void {
   const zombieComponent = ZombieComponentArray.getComponent(zombie);

   // Update attacking entities
   // @Speed
   for (const id of Object.keys(zombieComponent.attackingEntityIDs).map(idString => Number(idString))) {
      zombieComponent.attackingEntityIDs[id] -= 1 / SETTINGS.TPS;
      if (zombieComponent.attackingEntityIDs[id] <= 0) {
         delete zombieComponent.attackingEntityIDs[id];
      }
   }

   // If day time, ignite
   if (!Board.isNight()) {
      // Ignite randomly or stay on fire if already on fire
      const statusEffectComponent = StatusEffectComponentArray.getComponent(zombie);
      if (hasStatusEffect(statusEffectComponent, StatusEffectConst.burning) || Math.random() < SPONTANEOUS_COMBUSTION_CHANCE / SETTINGS.TPS) {
         applyStatusEffect(zombie, StatusEffectConst.burning, 5 * SETTINGS.TPS);
      }
   }

   const aiHelperComponent = AIHelperComponentArray.getComponent(zombie);

   {
      let minDist = Number.MAX_SAFE_INTEGER;
      let target: Entity | null = null;
      for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
         const entity = aiHelperComponent.visibleEntities[i];
         if (shouldAttackEntity(zombie, entity)) {
            const distance = zombie.position.calculateDistanceBetween(entity.position);
            if (distance < minDist) {
               minDist = distance;
               target = entity;
            }
         }
      }

      if (target !== null) {
         if (zombieComponent.attackCooldownTicks > 0) {
            zombieComponent.attackCooldownTicks--;
         } else {
            // Do special attack
            doAttack(zombie, target);
         }
         
         moveEntityToPosition(zombie, target.position.x, target.position.y, ACCELERATION);
         return;
      } else {
         zombieComponent.attackCooldownTicks = Math.floor(2.5 * SETTINGS.TPS);
      }
   }

   // Eat raw beef and fish
   {
      let minDist = Number.MAX_SAFE_INTEGER;
      let closestFoodItem: Entity | null = null;
      for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
         const entity = aiHelperComponent.visibleEntities[i];
         if (entity.type !== IEntityType.itemEntity) {
            continue;
         }

         const itemComponent = ItemComponentArray.getComponent(entity);
         if (itemComponent.itemType === ItemType.raw_beef || itemComponent.itemType === ItemType.raw_fish) {
            const distance = zombie.position.calculateDistanceBetween(entity.position);
            if (distance < minDist) {
               minDist = distance;
               closestFoodItem = entity;
            }
         }
      }
      if (closestFoodItem !== null) {
         moveEntityToPosition(zombie, closestFoodItem.position.x, closestFoodItem.position.y, ACCELERATION);
         if (zombie.isColliding(closestFoodItem)) {
            healEntity(zombie, 3);
            closestFoodItem.remove();
         }
         return;
      }
   }

   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(zombie);
   if (wanderAIComponent.targetPositionX !== -1) {
      if (entityHasReachedPosition(zombie, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
         wanderAIComponent.targetPositionX = -1;
         stopEntity(zombie);
      }
   } else if (shouldWander(zombie, 0.4)) {
      let attempts = 0;
      let targetTile: Tile;
      do {
         targetTile = getWanderTargetTile(zombie, VISION_RANGE);
      } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "grasslands"));

      const x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
      wander(zombie, x, y, ACCELERATION_SLOW);
   } else {
      stopEntity(zombie);
   }
}

const shouldAttackEntity = (zombie: Entity, entity: Entity): boolean => {
   if (!HealthComponentArray.hasComponent(entity)) {
      return false;
   }
   
   // If the entity is attacking the zombie, attack back
   const zombieComponent = ZombieComponentArray.getComponent(zombie);
   if (zombieComponent.attackingEntityIDs.hasOwnProperty(entity.id)) {
      return true;
   }

   // Attack tribe members, but only if they aren't wearing a meat suit
   if (entity.type === IEntityType.player || entity.type === IEntityType.tribeWorker || entity.type === IEntityType.tribeWarrior) {
      const inventoryComponent = InventoryComponentArray.getComponent(entity);
      const armourInventory = getInventory(inventoryComponent, "armourSlot");
      if (armourInventory.itemSlots.hasOwnProperty(1)) {
         if (armourInventory.itemSlots[1].type === ItemType.meat_suit) {
            return false;
         }
      }
      return true;
   }

   return entity.type === IEntityType.tribeTotem || entity.type === IEntityType.workerHut || entity.type === IEntityType.warriorHut || entity.type === IEntityType.barrel || entity.type === IEntityType.researchBench;
}

export function onZombieCollision(zombie: Entity, collidingEntity: Entity): void {
   // Pick up item entities
   if (collidingEntity.type === IEntityType.itemEntity) {
      pickupItemEntity(zombie, collidingEntity);
   }
   
   // Hurt enemies on collision
   if (shouldAttackEntity(zombie, collidingEntity)) {
      const hitDirection = zombie.position.calculateAngleBetween(collidingEntity.position);
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);

      const healthBeforeAttack = healthComponent.health;

      // Damage and knock back the player
      damageEntity(collidingEntity, 2, 150, hitDirection, zombie, PlayerCauseOfDeath.zombie, 0, "zombie");
      addLocalInvulnerabilityHash(healthComponent, "zombie", 0.3);

      // Push the zombie away from the entity
      if (healthComponent.health < healthBeforeAttack) {
         applyKnockback(zombie, 100, hitDirection + Math.PI);
      }
   }
}

export function onZombieHurt(zombie: Entity, attackingEntity: Entity): void {
   if (attackingEntity.type !== IEntityType.iceSpikes && attackingEntity.type !== IEntityType.cactus) {
      const zombieComponent = ZombieComponentArray.getComponent(zombie);
      zombieComponent.attackingEntityIDs[attackingEntity.id] = CHASE_PURSUE_TIME;
   }
}

export function onZombieDeath(zombie: Entity): void {
   const zombieComponent = ZombieComponentArray.getComponent(zombie);
   if (zombieComponent.tombstoneID !== ID_SENTINEL_VALUE && Board.entityRecord.hasOwnProperty(zombieComponent.tombstoneID)) {
      const tombstone = Board.entityRecord[zombieComponent.tombstoneID];
      const tombstoneComponent = TombstoneComponentArray.getComponent(tombstone);
      tombstoneComponent.numZombies--;
   }
}

export function onZombieRemove(zombie: Entity): void {
   HealthComponentArray.removeComponent(zombie);
   StatusEffectComponentArray.removeComponent(zombie);
   ZombieComponentArray.removeComponent(zombie);
   WanderAIComponentArray.removeComponent(zombie);
   AIHelperComponentArray.removeComponent(zombie);
   InventoryComponentArray.removeComponent(zombie);
}