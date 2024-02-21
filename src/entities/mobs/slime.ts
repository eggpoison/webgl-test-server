import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Mutable, PlayerCauseOfDeath, Point, SETTINGS, SlimeOrbData, SlimeSize, StatusEffectConst, TileTypeConst, lerp, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, PhysicsComponentArray, SlimeComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity, getEntityHealth, healEntity } from "../../components/HealthComponent";
import { SlimeComponent } from "../../components/SlimeComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { entityHasReachedPosition, getEntitiesInVisionRange, moveEntityToPosition, stopEntity, turnAngle } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { createItemsOverEntity } from "../../entity-shared";
import Board from "../../Board";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { createSlimeSpit } from "../projectiles/slime-spit";
import { SERVER } from "../../server";
import { PhysicsComponent } from "../../components/PhysicsComponent";
import { wasTribeMemberKill } from "../tribes/tribe-member";

const RADII: ReadonlyArray<number> = [32, 44, 60];
const MAX_HEALTH: ReadonlyArray<number> = [10, 20, 35];
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

const ACCELERATION = 150;

export const SLIME_MERGE_TIME = 7.5;

const ANGER_DIFFUSE_MULTIPLIER = 0.15;
const MAX_ANGER_PROPAGATION_CHAIN_LENGTH = 5;
const MAX_ENTITIES_IN_RANGE_FOR_MERGE = 7;

const HEALING_ON_SLIME_PER_SECOND = 0.5;
const HEALING_PROC_INTERVAL = 0.1;

const SPIT_COOLDOWN_TICKS = 4 * SETTINGS.TPS;
export const SPIT_CHARGE_TIME_TICKS = Math.floor(0.5 * SETTINGS.TPS);

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

export function createSlime(position: Point, size: SlimeSize = SlimeSize.small, startingOrbs: Array<MovingOrbData> = []): Entity {
   const slime = new Entity(position, IEntityType.slime, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   slime.rotation = 2 * Math.PI * Math.random();
   slime.collisionPushForceMultiplier = 0.5;

   const mass = 1 + size * 0.5;
   const hitbox = new CircularHitbox(slime, mass, 0, 0, RADII[size], 0);
   slime.addHitbox(hitbox);

   PhysicsComponentArray.addComponent(slime, new PhysicsComponent(true));
   HealthComponentArray.addComponent(slime, new HealthComponent(MAX_HEALTH[size]));
   StatusEffectComponentArray.addComponent(slime, new StatusEffectComponent(StatusEffectConst.poisoned));
   SlimeComponentArray.addComponent(slime, new SlimeComponent(size, MERGE_WEIGHTS[size], startingOrbs));
   WanderAIComponentArray.addComponent(slime, new WanderAIComponent());
   AIHelperComponentArray.addComponent(slime, new AIHelperComponent(VISION_RANGES[size]));

   return slime;
}

const updateAngerTarget = (slime: Entity): Entity | null => {
   const slimeComponent = SlimeComponentArray.getComponent(slime);

   // Target the entity which the slime is angry with the most
   let maxAnger = 0;
   let target: Entity;
   for (let i = 0; i < slimeComponent.angeredEntities.length; i++) {
      const angerInfo = slimeComponent.angeredEntities[i];

      // Remove anger at an entity if the entity is dead
      if (angerInfo.target.isRemoved) {
         slimeComponent.angeredEntities.splice(i, 1);
         i--;
      }

      // Decrease anger
      angerInfo.angerAmount -= 1 / SETTINGS.TPS * ANGER_DIFFUSE_MULTIPLIER;
      if (angerInfo.angerAmount <= 0) {
         slimeComponent.angeredEntities.splice(i, 1);
      }
      
      if (angerInfo.angerAmount > maxAnger) {
         maxAnger = angerInfo.angerAmount;
         target = angerInfo.target;
      }
   }

   if (maxAnger === 0) {
      return null;
   }
   
   return target!;
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

const spit = (slime: Entity, slimeComponent: SlimeComponent): void => {
   const x = slime.position.x + RADII[slimeComponent.size] * Math.sin(slime.rotation);
   const y = slime.position.y + RADII[slimeComponent.size] * Math.cos(slime.rotation);
   const spit = createSlimeSpit(new Point(x, y), slimeComponent.size === SlimeSize.medium ? 0 : 1);

   spit.velocity.x = 500 * Math.sin(slime.rotation);
   spit.velocity.y = 500 * Math.cos(slime.rotation);

   slimeComponent.lastSpitTicks = Board.ticks;
}

export function tickSlime(slime: Entity): void {
   // Slimes move at normal speed on slime blocks
   slime.overrideMoveSpeedMultiplier = slime.tile.type === TileTypeConst.slime || slime.tile.type === TileTypeConst.sludge;

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

   // Heal when standing on slime blocks
   if (slime.tile.type === TileTypeConst.slime) {
      if (Board.tickIntervalHasPassed(HEALING_PROC_INTERVAL)) {
         healEntity(slime, HEALING_ON_SLIME_PER_SECOND * HEALING_PROC_INTERVAL, slime.id);
      }
   }

   // @Cleanup: Lot of copy and paste between the next 3 sections
   
   // Chase entities the slime is angry at
   const angerTarget = updateAngerTarget(slime);
   if (angerTarget !== null) {
      const targetDirection = slime.position.calculateAngleBetween(angerTarget.position);
      slimeComponent.eyeRotation = turnAngle(slimeComponent.eyeRotation, targetDirection, 5 * Math.PI);
      slime.turn(targetDirection, 2 * Math.PI);

      if (slimeComponent.size > SlimeSize.small && (Board.ticks - slimeComponent.lastSpitTicks) >= SPIT_COOLDOWN_TICKS) {
         stopEntity(slime);
         
         // Spit attack
         if (++slimeComponent.spitChargeProgress >= SPIT_CHARGE_TIME_TICKS) {
            spit(slime, slimeComponent);
         }
         return;
      }
      
      // @Cleanup: Why do we need this?
      slimeComponent.spitChargeProgress = 0;

      slime.acceleration.x = ACCELERATION * speedMultiplier * Math.sin(slime.rotation);
      slime.acceleration.y = ACCELERATION * speedMultiplier * Math.cos(slime.rotation);
      return;
   }
   slimeComponent.lastSpitTicks = Board.ticks;
   slimeComponent.spitChargeProgress = 0;

   const aiHelperComponent = AIHelperComponentArray.getComponent(slime);

   // Chase entities intruding on the slimes' land
   {
      let minDist = Number.MAX_SAFE_INTEGER;
      let closestEnemy: Entity | null = null;
      for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
         const entity = aiHelperComponent.visibleEntities[i];
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
         const targetDirection = slime.position.calculateAngleBetween(closestEnemy.position);
         slimeComponent.eyeRotation = turnAngle(slimeComponent.eyeRotation, targetDirection, 5 * Math.PI);
         moveEntityToPosition(slime, closestEnemy.position.x, closestEnemy.position.y, ACCELERATION * speedMultiplier);
         return;
      }
   }

   // Merge with other slimes
   if (aiHelperComponent.visibleEntities.length > MAX_ENTITIES_IN_RANGE_FOR_MERGE) {
      let minDist = Number.MAX_SAFE_INTEGER;
      let mergeTarget: Entity | null = null;
      for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
         const entity = aiHelperComponent.visibleEntities[i];
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
         const targetDirection = slime.position.calculateAngleBetween(mergeTarget.position);
         slimeComponent.eyeRotation = turnAngle(slimeComponent.eyeRotation, targetDirection, 5 * Math.PI);
         moveEntityToPosition(slime, mergeTarget.position.x, mergeTarget.position.y, ACCELERATION * speedMultiplier);
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
      wander(slime, x, y, ACCELERATION * speedMultiplier);
   } else {
      stopEntity(slime);
   }
}

const createNewOrb = (orbs: Array<MovingOrbData>, size: SlimeSize): void => {
   orbs.push({
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
      const orbs = new Array<MovingOrbData>();

      // Add orbs from the 2 existing slimes
      for (const orb of slimeComponent1.orbs) {
         createNewOrb(orbs, orb.size);
      }
      for (const orb of slimeComponent2.orbs) {
         createNewOrb(orbs, orb.size);
      }

      createNewOrb(orbs, slimeComponent1.size);
      createNewOrb(orbs, slimeComponent2.size);
      
      const slimeSpawnPosition = new Point((slime1.position.x + slime2.position.x) / 2, (slime1.position.y + slime2.position.y) / 2);
      createSlime(slimeSpawnPosition, slimeComponent1.size + 1, orbs);
      
      slime1.remove();
   } else {
      // @Incomplete: THis allows small slimes to eat larger slimes. Very bad.
      
      // Add the other slime's health
      healEntity(slime1, getEntityHealth(slime2), slime1.id)

      createNewOrb(slimeComponent1.orbs, slimeComponent2.size);

      slimeComponent1.mergeWant = 0;
   }
   
   slime2.remove();
}

export function onSlimeCollision(slime: Entity, collidingEntity: Entity): void {
   // Merge with slimes
   if (collidingEntity.type === IEntityType.slime) {
      if (wantsToMerge(slime, collidingEntity)) {
         const slimeComponent = SlimeComponentArray.getComponent(slime);
         slimeComponent.mergeTimer -= 1 / SETTINGS.TPS;
         if (slimeComponent.mergeTimer <= 0) {
            mergeSlimes(slime, collidingEntity);
         }
      }
      return;
   }
   
   if (collidingEntity.type === IEntityType.slimewisp) return;
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      if (!canDamageEntity(healthComponent, "slime")) {
         return;
      }

      const slimeComponent = SlimeComponentArray.getComponent(slime);
      const damage = CONTACT_DAMAGE[slimeComponent.size];

      damageEntity(collidingEntity, damage, slime, PlayerCauseOfDeath.slime, "slime");
      SERVER.registerEntityHit({
         entityPositionX: collidingEntity.position.x,
         entityPositionY: collidingEntity.position.y,
         hitEntityID: collidingEntity.id,
         damage: damage,
         knockback: 0,
         angleFromAttacker: slime.position.calculateAngleBetween(collidingEntity.position),
         attackerID: slime.id,
         flags: 0
      });
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
   if (wasTribeMemberKill(attackingEntity)) {
      const slimeComponent = SlimeComponentArray.getComponent(slime);
      createItemsOverEntity(slime, ItemType.slimeball, randInt(...SLIME_DROP_AMOUNTS[slimeComponent.size]));
   }
}

export function onSlimeRemove(slime: Entity): void {
   PhysicsComponentArray.removeComponent(slime);
   HealthComponentArray.removeComponent(slime);
   StatusEffectComponentArray.removeComponent(slime);
   SlimeComponentArray.removeComponent(slime);
   WanderAIComponentArray.removeComponent(slime);
   AIHelperComponentArray.removeComponent(slime);
}