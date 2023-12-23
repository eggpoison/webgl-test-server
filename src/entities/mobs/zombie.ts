import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst, randInt } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../GameObject";
import { AIHelperComponentArray, HealthComponentArray, InventoryComponentArray, ItemComponentArray, StatusEffectComponentArray, TombstoneComponentArray, WanderAIComponentArray, ZombieComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, applyKnockback, damageEntity, healEntity } from "../../components/HealthComponent";
import { ZombieComponent } from "../../components/ZombieComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { getInventory } from "../../components/InventoryComponent";
import Board from "../../Board";
import { StatusEffectComponent, applyStatusEffect, hasStatusEffect } from "../../components/StatusEffectComponent";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, getEntitiesInVisionRange, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { AIHelperComponent, calculateVisibleEntities, updateAIHelperComponent } from "../../components/AIHelperComponent";

const MAX_HEALTH = 20;

const VISION_RANGE = 270;

const ACCELERATION = 200;
const TERMINAL_VELOCITY = 100;

const ACCELERATION_SLOW = 100;
const TERMINAL_VELOCITY_SLOW = 50;

const ATTACK_PURSUE_TIME = 5;

/** Chance for a zombie to spontaneously combust every second */
const SPONTANEOUS_COMBUSTION_CHANCE = 0.5;

// @Cleanup: We don't need to pass the isGolden parameter, can deduce whether the tombstone is golden from the tombstoneID instead
export function createZombie(position: Point, isGolden: boolean, tombstoneID: number): Entity {
   const zombie = new Entity(position, IEntityType.zombie, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(zombie, 0, 0, 32);
   zombie.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(zombie, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(zombie, new StatusEffectComponent());
   const zombieType = isGolden ? 3 : randInt(0, 2);
   ZombieComponentArray.addComponent(zombie, new ZombieComponent(zombieType, tombstoneID));
   WanderAIComponentArray.addComponent(zombie, new WanderAIComponent());
   AIHelperComponentArray.addComponent(zombie, new AIHelperComponent());
   
   return zombie;
}

export function tickZombie(zombie: Entity): void {
   // Update attacking entities
   // @Speed
   const zombieComponent = ZombieComponentArray.getComponent(zombie);
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
   updateAIHelperComponent(zombie, VISION_RANGE);
   const visibleEntities = calculateVisibleEntities(zombie, aiHelperComponent, VISION_RANGE);

   // @Incomplete: Make the chase AI consider both enemies and food in the same loop

   // Chase AI
   {
      let minDist = Number.MAX_SAFE_INTEGER;
      let chasedEntity: Entity | null = null;
      for (let i = 0; i < visibleEntities.length; i++) {
         const entity = visibleEntities[i];
         if (shouldAttackEntity(zombie, entity)) {
            const distance = zombie.position.calculateDistanceBetween(entity.position);
            if (distance < minDist) {
               minDist = distance;
               chasedEntity = entity;
            }
         }
      }
      if (chasedEntity !== null) {
         moveEntityToPosition(zombie, chasedEntity.position.x, chasedEntity.position.y, ACCELERATION, TERMINAL_VELOCITY);
         return;
      }
   }

   // Eat raw beef and fish
   {
      let minDist = Number.MAX_SAFE_INTEGER;
      let closestFoodItem: Entity | null = null;
      for (let i = 0; i < visibleEntities.length; i++) {
         const entity = visibleEntities[i];
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
         moveEntityToPosition(zombie, closestFoodItem.position.x, closestFoodItem.position.y, ACCELERATION, TERMINAL_VELOCITY);
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
      wander(zombie, x, y, ACCELERATION_SLOW, TERMINAL_VELOCITY_SLOW);
   } else {
      stopEntity(zombie);
   }
}

const shouldAttackEntity = (zombie: Entity, entity: Entity): boolean => {
   // If the entity is attacking the zombie, attack back
   const zombieComponent = ZombieComponentArray.getComponent(zombie);
   if (zombieComponent.attackingEntityIDs.hasOwnProperty(entity.id)) {
      return true;
   }

   // Attack tribe members, but only if they aren't wearing a meat suit
   if (entity.type === IEntityType.player || entity.type === IEntityType.tribesman) {
      const inventoryComponent = InventoryComponentArray.getComponent(entity);
      const armourInventory = getInventory(inventoryComponent, "armourSlot");
      if (armourInventory.itemSlots.hasOwnProperty(1)) {
         if (armourInventory.itemSlots[1].type === ItemType.meat_suit) {
            return false;
         }
      }
      return true;
   }

   return entity.type === IEntityType.tribeTotem || entity.type === IEntityType.tribeHut || entity.type === IEntityType.barrel;
}

export function onZombieCollision(zombie: Entity, collidingEntity: Entity): void {
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
      zombieComponent.attackingEntityIDs[attackingEntity.id] = ATTACK_PURSUE_TIME;
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
}