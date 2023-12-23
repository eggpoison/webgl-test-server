import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Mutable, PlayerCauseOfDeath, Point, SETTINGS, SlimeOrbData, SlimeSize, TileTypeConst, lerp, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { AIHelperComponentArray, HealthComponentArray, SlimeComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, damageEntity, getEntityHealth, healEntity } from "../../components/HealthComponent";
import { SlimeComponent } from "../../components/SlimeComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { entityHasReachedPosition, getEntitiesInVisionRange, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { createItemsOverEntity } from "../../entity-shared";
import Board from "../../Board";
import { AIHelperComponent, calculateVisibleEntities, updateAIHelperComponent } from "../../components/AIHelperComponent";

const RADII: ReadonlyArray<number> = [32, 44, 60];
const MAX_HEALTH: ReadonlyArray<number> = [10, 15, 25];
const CONTACT_DAMAGE: ReadonlyArray<number> = [1, 2, 3];
const SPEED_MULTIPLIERS: ReadonlyArray<number> = [2.5, 1.75, 1];
const MERGE_WEIGHTS: ReadonlyArray<number> = [2, 5, 11];
const SLIME_DROP_AMOUNTS: ReadonlyArray<[minDropAmount: number, maxDropAmount: number]> = [
   [1, 2], // small slime
   [3, 5], // medium slime
   [6, 9] // large slime
];
const MAX_MERGE_WANT: ReadonlyArray<number> = [15, 40, 75];

const VISION_RANGES = [200, 250, 300];

const ACCELERATION = 60;
const TERMINAL_VELOCITY = 30;

export const SLIME_MERGE_TIME = 7.5;

const ANGER_DIFFUSE_MULTIPLIER = 0.15;
const MAX_ANGER_PROPAGATION_CHAIN_LENGTH = 5;
const MAX_ENTITIES_IN_RANGE_FOR_MERGE = 7;

const HEALING_ON_SLIME_PER_SECOND = 0.5;
const HEALING_PROC_INTERVAL = 0.1;

export interface MovingOrbData extends Mutable<SlimeOrbData> {
   angularVelocity: number;
}

export interface SlimeEntityAnger {
   angerAmount: number;
   readonly target: Entity;
}

interface AngerPropagationInfo {
   chainLength: number;
   readonly propagatedEntityIDs: Set<number>;
}

export function createSlime(position: Point, size: SlimeSize = SlimeSize.small): Entity {
   const slime = new Entity(position, IEntityType.slime, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(slime, 0, 0, RADII[size]);
   slime.addHitbox(hitbox);

   HealthComponentArray.addComponent(slime, new HealthComponent(MAX_HEALTH[size]));
   StatusEffectComponentArray.addComponent(slime, new StatusEffectComponent());
   SlimeComponentArray.addComponent(slime, new SlimeComponent(size, MERGE_WEIGHTS[size]));
   WanderAIComponentArray.addComponent(slime, new WanderAIComponent());
   AIHelperComponentArray.addComponent(slime, new AIHelperComponent());

   return slime;
}

const getAngerTarget = (slime: Entity): Entity | null => {
   const slimeComponent = SlimeComponentArray.getComponent(slime);
   if (slimeComponent.angeredEntities.length === 0) {
      return null;
   }

   // Target the entity which the slime is angry with the most
   let maxAnger = 0;
   let target!: Entity;
   for (const angerInfo of slimeComponent.angeredEntities) {
      if (angerInfo.angerAmount > maxAnger) {
         maxAnger = angerInfo.angerAmount;
         target = angerInfo.target;
      }
   }
   
   return target;
}

/**
 * Determines whether the slime wants to merge with the other slime.
 */
const wantsToMerge = (slime1: Entity, slime2: Entity): boolean => {
   const slimeComponent1 = SlimeComponentArray.getComponent(slime1);
   const slimeComponent2 = SlimeComponentArray.getComponent(slime2);
   
   // Don't try to merge with larger slimes
   if (slimeComponent1.size > slimeComponent2.size) return false;

   return slimeComponent1.mergeWant >= MAX_MERGE_WANT[slimeComponent1.size];
}

export function tickSlime(slime: Entity): void {
   // Slimes move at normal speed on slime blocks
   slime.overrideMoveSpeedMultiplier = slime.tile.type === TileTypeConst.slime;

   const slimeComponent = SlimeComponentArray.getComponent(slime);
   const visionRange = VISION_RANGES[slimeComponent.size];
   const speedMultiplier = SPEED_MULTIPLIERS[slimeComponent.size];

   slimeComponent.mergeWant += 1 / SETTINGS.TPS;
   if (slimeComponent.mergeWant >= MAX_MERGE_WANT[slimeComponent.size]) {
      slimeComponent.mergeWant = MAX_MERGE_WANT[slimeComponent.size];
   }

   for (let i = 0; i < slimeComponent.orbs.length; i++) {
      const orb = slimeComponent.orbs[i];

      // Randomly move around the orbs
      if (Math.random() < 0.3 / SETTINGS.TPS) {
         orb.angularVelocity = randFloat(-3, 3);
      }

      // Update orb angular velocity & rotation
      orb.rotation += orb.angularVelocity / SETTINGS.TPS;
      orb.angularVelocity -= 3 / SETTINGS.TPS;
      if (orb.angularVelocity < 0) {
         orb.angularVelocity = 0;
      }
   }

   // Remove anger at an entity if the entity is dead
   for (let i = 0; i < slimeComponent.angeredEntities.length; i++) {
      const angerInfo = slimeComponent.angeredEntities[i];
      if (angerInfo.target.isRemoved) {
         slimeComponent.angeredEntities.splice(i, 1);
         i--;
      }
   }

   // Decrease anger
   for (let i = slimeComponent.angeredEntities.length - 1; i >= 0; i--) {
      const angerInfo = slimeComponent.angeredEntities[i];
      angerInfo.angerAmount -= 1 / SETTINGS.TPS * ANGER_DIFFUSE_MULTIPLIER;
      if (angerInfo.angerAmount <= 0) {
         slimeComponent.angeredEntities.splice(i, 1);
      }
   }

   // Heal when standing on slime blocks
   if (slime.tile.type === TileTypeConst.slime) {
      if (Board.tickIntervalHasPassed(HEALING_PROC_INTERVAL)) {
         healEntity(slime, HEALING_ON_SLIME_PER_SECOND * HEALING_PROC_INTERVAL);
      }
   }
   
   // Chase entities the slime is angry at
   const angerTarget = getAngerTarget(slime);
   if (angerTarget !== null) {
      slimeComponent.eyeRotation = slime.position.calculateAngleBetween(angerTarget.position);
      moveEntityToPosition(slime, angerTarget.position.x, angerTarget.position.y, ACCELERATION * speedMultiplier, TERMINAL_VELOCITY * speedMultiplier);
      return;
   }

   const aiHelperComponent = AIHelperComponentArray.getComponent(slime);
   updateAIHelperComponent(slime, visionRange);
   const visibleEntities = calculateVisibleEntities(slime, aiHelperComponent, visionRange);

   // Chase entities intruding on the slimes' land
   {
      let minDist = Number.MAX_SAFE_INTEGER;
      let closestEnemy: Entity | null = null;
      for (let i = 0; i < visibleEntities.length; i++) {
         const entity = visibleEntities[i];
         if (entity.type === IEntityType.slime || entity.type === IEntityType.slimewisp || entity.tile.biomeName !== "swamp") {
            continue;
         }

         // Don't attack entities which can't be damaged
         if (!HealthComponentArray.hasComponent(entity)) {
            continue;
         }

         const distance = slime.position.calculateDistanceBetween(entity.position);
         if (distance < minDist) {
            minDist = distance;
            closestEnemy = entity;
         }
      }
      if (closestEnemy !== null) {
         slimeComponent.eyeRotation = slime.position.calculateAngleBetween(closestEnemy.position);
         moveEntityToPosition(slime, closestEnemy.position.x, closestEnemy.position.y, ACCELERATION * speedMultiplier, TERMINAL_VELOCITY * speedMultiplier);
         return;
      }
   }

   // Merge with other slimes
   if (visibleEntities.length > MAX_ENTITIES_IN_RANGE_FOR_MERGE) {
      let minDist = Number.MAX_SAFE_INTEGER;
      let mergeTarget: Entity | null = null;
      for (let i = 0; i < visibleEntities.length; i++) {
         const entity = visibleEntities[i];
         if (entity.type !== IEntityType.slime || !wantsToMerge(slime, entity)) {
            continue;
         }

         const distance = slime.position.calculateDistanceBetween(entity.position);
         if (distance < minDist) {
            minDist = distance;
            mergeTarget = entity;
         }
      }
      if (mergeTarget !== null) {
         slimeComponent.eyeRotation = slime.position.calculateAngleBetween(mergeTarget.position);
         moveEntityToPosition(slime, mergeTarget.position.x, mergeTarget.position.y, ACCELERATION * speedMultiplier, TERMINAL_VELOCITY * speedMultiplier);
         return;
      }
   }

   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(slime);
   if (wanderAIComponent.targetPositionX !== -1) {
      if (entityHasReachedPosition(slime, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
         wanderAIComponent.targetPositionX = -1;
         stopEntity(slime);
      }
   } else if (shouldWander(slime, 0.5)) {
      let attempts = 0;
      let targetTile: Tile;
      do {
         targetTile = getWanderTargetTile(slime, visionRange);
      } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "swamp"));

      const x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
      wander(slime, x, y, ACCELERATION * speedMultiplier, TERMINAL_VELOCITY * speedMultiplier);
   } else {
      stopEntity(slime);
   }
}

const createNewOrb = (slimeComponent: SlimeComponent, size: SlimeSize): void => {
   slimeComponent.orbs.push({
      size: size,
      rotation: 2 * Math.PI * Math.random(),
      offset: Math.random(),
      angularVelocity: 0
   });
}

const mergeSlimes = (slime1: Entity, slime2: Entity): void => {
   if (slime2.isRemoved) return;

   const slimeComponent1 = SlimeComponentArray.getComponent(slime1);
   const slimeComponent2 = SlimeComponentArray.getComponent(slime2);
   slimeComponent1.mergeWeight += slimeComponent2.mergeWeight;

   slimeComponent1.mergeTimer = SLIME_MERGE_TIME;

   if (slimeComponent1.size < SlimeSize.large && slimeComponent1.mergeWeight >= MERGE_WEIGHTS[slimeComponent1.size + 1]) {
      const slime = createSlime(new Point((slime1.position.x + slime2.position.x) / 2, (slime1.position.y + slime2.position.y) / 2), slimeComponent1.size + 1);
      const slimeComponent = SlimeComponentArray.getComponent(slime);

      // Add orbs from the 2 existing slimes
      for (const orb of slimeComponent1.orbs) {
         createNewOrb(slimeComponent, orb.size);
      }
      for (const orb of slimeComponent2.orbs) {
         createNewOrb(slimeComponent, orb.size);
      }

      createNewOrb(slimeComponent, slimeComponent1.size);
      createNewOrb(slimeComponent, slimeComponent2.size);
      
      slime1.remove();
   } else {
      // Add the other slime's health
      healEntity(slime1, getEntityHealth(slime2))

      createNewOrb(slimeComponent1, slimeComponent2.size);

      slimeComponent1.mergeWant = 0;
   }
   
   slime2.remove();
}

export function onSlimeCollision(slime: Entity, collidingEntity: Entity): void {
   // Merge with slimes
   if (collidingEntity.type === IEntityType.slime) {
      const slimeComponent = SlimeComponentArray.getComponent(slime);
      slimeComponent.mergeTimer -= 1 / SETTINGS.TPS;
      if (slimeComponent.mergeTimer <= 0) {
         mergeSlimes(slime, collidingEntity);
      }
      return;
   }
   
   if (collidingEntity.type === IEntityType.slimewisp) return;
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const slimeComponent = SlimeComponentArray.getComponent(slime);
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);

      damageEntity(collidingEntity, CONTACT_DAMAGE[slimeComponent.size], 0, null, slime, PlayerCauseOfDeath.slime, 0, "slime");
      addLocalInvulnerabilityHash(healthComponent, "slime", 0.3);
   }
}

const addEntityAnger = (slime: Entity, entity: Entity, amount: number, propagationInfo: AngerPropagationInfo): void => {
   const slimeComponent = SlimeComponentArray.getComponent(slime);

   let alreadyIsAngry = false;
   for (const entityAnger of slimeComponent.angeredEntities) {
      if (entityAnger.target === entity) {
         const angerOverflow = Math.max(entityAnger.angerAmount + amount - 1, 0);

         entityAnger.angerAmount = Math.min(entityAnger.angerAmount + amount, 1);

         if (angerOverflow > 0) {
            propagateAnger(slime, entity, angerOverflow, propagationInfo);
         }

         alreadyIsAngry = true;
         break;
      }
   }

   if (!alreadyIsAngry) {
      slimeComponent.angeredEntities.push({
         angerAmount: amount,
         target: entity
      });
   }
}

const propagateAnger = (slime: Entity, angeredEntity: Entity, amount: number, propagationInfo: AngerPropagationInfo = { chainLength: 0, propagatedEntityIDs: new Set() }): void => {
   const slimeComponent = SlimeComponentArray.getComponent(slime);

   const visionRange = VISION_RANGES[slimeComponent.size];
   // @Speed
   const visibleEntities = getEntitiesInVisionRange(slime.position.x, slime.position.y, visionRange);

   // @Cleanup: don't do here
   let idx = visibleEntities.indexOf(slime);
   while (idx !== -1) {
      visibleEntities.splice(idx, 1);
      idx = visibleEntities.indexOf(slime);
   }
   
   // Propagate the anger
   for (const entity of visibleEntities) {
      if (entity.type === IEntityType.slime && !propagationInfo.propagatedEntityIDs.has(entity.id)) {
         const distance = slime.position.calculateDistanceBetween(entity.position);
         const distanceFactor = distance / visionRange;

         propagationInfo.propagatedEntityIDs.add(slime.id);
         
         propagationInfo.chainLength++;

         if (propagationInfo.chainLength <= MAX_ANGER_PROPAGATION_CHAIN_LENGTH) {
            const propogatedAnger = lerp(amount * 1, amount * 0.4, Math.sqrt(distanceFactor));
            addEntityAnger(entity, angeredEntity, propogatedAnger, propagationInfo);
         }

         propagationInfo.chainLength--;
      }
   }
}

export function onSlimeHurt(slime: Entity, attackingEntity: Entity): void {
   if (attackingEntity.type === IEntityType.iceSpikes || attackingEntity.type === IEntityType.cactus) return;

   addEntityAnger(slime, attackingEntity, 1, { chainLength: 0, propagatedEntityIDs: new Set() });
   propagateAnger(slime, attackingEntity, 1);
}

export function onSlimeDeath(slime: Entity, attackingEntity: Entity): void {
   if (attackingEntity.type === IEntityType.player || attackingEntity.type === IEntityType.tribesman) {
      const slimeComponent = SlimeComponentArray.getComponent(slime);
      createItemsOverEntity(slime, ItemType.slimeball, randInt(...SLIME_DROP_AMOUNTS[slimeComponent.size]));
   }
}

export function onSlimeRemove(slime: Entity): void {
   HealthComponentArray.removeComponent(slime);
   StatusEffectComponentArray.removeComponent(slime);
   SlimeComponentArray.removeComponent(slime);
   WanderAIComponentArray.removeComponent(slime);
   AIHelperComponentArray.removeComponent(slime);
}