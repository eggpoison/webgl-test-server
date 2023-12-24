import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, PlayerCauseOfDeath, Point, SETTINGS, TileTypeConst, customTickIntervalHasPassed, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../GameObject";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { AIHelperComponentArray, EscapeAIComponentArray, FishComponentArray, HealthComponentArray, InventoryComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, getEntitiesInVisionRange, runHerdAI, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import Board, { tileRaytraceMatchesTileTypes } from "../../Board";
import { FishComponent } from "../../components/FishComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { EscapeAIComponent, updateEscapeAIComponent } from "../../components/EscapeAIComponent";
import { chooseEscapeEntity, registerAttackingEntity, runFromAttackingEntity } from "../../ai/escape-ai";
import { getInventory } from "../../components/InventoryComponent";
import { AIHelperComponent, calculateVisibleEntities, updateAIHelperComponent } from "../../components/AIHelperComponent";

const MAX_HEALTH = 5;

const FISH_WIDTH = 7 * 4;
const FISH_HEIGHT = 14 * 4;

const ACCELERATION = 40;

const TURN_RATE = 0.5;
const SEPARATION_INFLUENCE = 0.7;
const ALIGNMENT_INFLUENCE = 0.5;
const COHESION_INFLUENCE = 0.3;
const MIN_SEPARATION_DISTANCE = 40;

const HERD_PREDICTION_TIME_SECONDS = 0.5;

const VISION_RANGE = 200;

const TILE_VALIDATION_PADDING = 20;

const LUNGE_FORCE = 200;
const LUNGE_INTERVAL = 1;

export function createFish(position: Point): Entity {
   const fish = new Entity(position, IEntityType.fish, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(fish, 0, 0, FISH_WIDTH, FISH_HEIGHT);
   fish.addHitbox(hitbox);

   HealthComponentArray.addComponent(fish, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(fish, new StatusEffectComponent());
   WanderAIComponentArray.addComponent(fish, new WanderAIComponent());
   EscapeAIComponentArray.addComponent(fish, new EscapeAIComponent());
   FishComponentArray.addComponent(fish, new FishComponent(randInt(0, 3)));
   AIHelperComponentArray.addComponent(fish, new AIHelperComponent());
   
   fish.rotation = 2 * Math.PI * Math.random();
   
   return fish;
}

const isValidWanderPosition = (x: number, y: number): boolean => {
   const minTileX = Math.max(Math.floor((x - TILE_VALIDATION_PADDING) / SETTINGS.TILE_SIZE), 0);
   const maxTileX = Math.min(Math.floor((x + TILE_VALIDATION_PADDING) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1);
   const minTileY = Math.max(Math.floor((y - TILE_VALIDATION_PADDING) / SETTINGS.TILE_SIZE), 0);
   const maxTileY = Math.min(Math.floor((y + TILE_VALIDATION_PADDING) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1);

   for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
         const tile = Board.getTile(tileX, tileY);
         if (tile.biomeName !== "river") {
            return false;
         }
      }
   }

   return true;
}

const move = (fish: Entity, direction: number): void => {
   if (fish.tile.type === TileTypeConst.water) {
      // 
      // Swim on water
      // 

      fish.acceleration.x = 40 * Math.sin(direction);
      fish.acceleration.y = 40 * Math.cos(direction);
      fish.rotation = direction;
   } else {
      // 
      // Lunge on land
      // 

      stopEntity(fish);

      const fishComponent = FishComponentArray.getComponent(fish);
      if (customTickIntervalHasPassed(fishComponent.secondsOutOfWater * SETTINGS.TPS, LUNGE_INTERVAL)) {
         fish.velocity.x += LUNGE_FORCE * Math.sin(direction);
         fish.velocity.y += LUNGE_FORCE * Math.cos(direction);
         if (direction !== fish.rotation) {
            fish.rotation = direction;
            fish.hitboxesAreDirty = true;
         }
      }
   }
}

export function tickFish(fish: Entity): void {
   fish.overrideMoveSpeedMultiplier = fish.tile.type === TileTypeConst.water;

   const fishComponent = FishComponentArray.getComponent(fish);

   if (fish.tile.type !== TileTypeConst.water) {
      fishComponent.secondsOutOfWater += 1 / SETTINGS.TPS;
      if (fishComponent.secondsOutOfWater >= 5 && customTickIntervalHasPassed(fishComponent.secondsOutOfWater * SETTINGS.TPS, 1.5)) {
         damageEntity(fish, 1, 0, null, null, PlayerCauseOfDeath.lack_of_oxygen, 0);
      }
   } else {
      fishComponent.secondsOutOfWater = 0;
   }
   
   const aiHelperComponent = AIHelperComponentArray.getComponent(fish);
   updateAIHelperComponent(fish, VISION_RANGE);
   const visibleEntities = calculateVisibleEntities(fish, aiHelperComponent, VISION_RANGE);

   // If the leader dies or is out of vision range, stop following them
   if (fishComponent.leader !== null && (fishComponent.leader.isRemoved || !visibleEntities.includes(fishComponent.leader))) {
      fishComponent.leader = null;
   }

   // Look for a leader
   if (fishComponent.leader === null) {
      for (let i = 0; i < visibleEntities.length; i++) {
         const entity = visibleEntities[i];
         if (entity.type === IEntityType.player || entity.type === IEntityType.tribesman) {
            const inventoryComponent = InventoryComponentArray.getComponent(entity);
            const armourSlotInventory = getInventory(inventoryComponent, "armourSlot");
            if (armourSlotInventory.itemSlots.hasOwnProperty(1) && armourSlotInventory.itemSlots[1].type === ItemType.fishlord_suit) {
               // New leader
               fishComponent.leader = entity;
               break;

               // @Incomplete
               // if (entity !== this.leader) {
               //    if (this.leader !== null && typeof this.leader !== "undefined") {
               //       this.leader.removeEvent("hurt", this.onLeaderHurt);
               //    }
   
               //    entity.createEvent("hurt", this.onLeaderHurt);
               
               //    this.leader = entity;
               // }
            }
         }
      }
   }

   // If a tribe member is wearing a fishlord suit, follow them
   if (fishComponent.leader !== null) {
      if (fishComponent.attackTarget === null) {
         // Follow leader
         move(fish, fish.position.calculateAngleBetween(fishComponent.leader.position));
      } else {
         // Attack the target
         move(fish, fish.position.calculateAngleBetween(fishComponent.attackTarget.position));
         if (fish.isColliding(fishComponent.attackTarget) && HealthComponentArray.hasComponent(fishComponent.attackTarget)) {
            const healthComponent = HealthComponentArray.getComponent(fishComponent.attackTarget);
            const hitDirection = fish.position.calculateAngleBetween(fishComponent.attackTarget.position);
            damageEntity(fishComponent.attackTarget, 2, 100, hitDirection, fish, PlayerCauseOfDeath.fish, 0, "fish");
            addLocalInvulnerabilityHash(healthComponent, "fish", 0.3);
         }
      }
      return;
   }
   
   // Flail on the ground when out of water
   if (fish.tile.type !== TileTypeConst.water) {
      fishComponent.flailTimer += 1 / SETTINGS.TPS;
      if (fishComponent.flailTimer >= 0.75) {
         const flailDirection = 2 * Math.PI * Math.random();
   
         fish.velocity.x += 200 * Math.sin(flailDirection);
         fish.velocity.y += 200 * Math.cos(flailDirection);
   
         fish.rotation = flailDirection + randFloat(-0.5, 0.5);
         fish.hitboxesAreDirty = true;
   
         fishComponent.flailTimer = 0;
      }

      stopEntity(fish);
      return;
   }

   // Escape AI
   const escapeAIComponent = EscapeAIComponentArray.getComponent(fish);
   updateEscapeAIComponent(escapeAIComponent, 3 * SETTINGS.TPS);
   if (escapeAIComponent.attackingEntityIDs.length > 0) {
      const escapeEntity = chooseEscapeEntity(fish, visibleEntities);
      if (escapeEntity !== null) {
         runFromAttackingEntity(fish, escapeEntity, 200);
         return;
      }
   }

   // Herd AI
   // @Incomplete: Make fish steer away from land
   const herdMembers = new Array<Entity>();
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];
      if (entity.type === IEntityType.fish) {
         herdMembers.push(entity);
      }
   }
   if (herdMembers.length >= 1) {
      runHerdAI(fish, herdMembers, VISION_RANGE, TURN_RATE, MIN_SEPARATION_DISTANCE, SEPARATION_INFLUENCE, ALIGNMENT_INFLUENCE, COHESION_INFLUENCE);
      fish.acceleration.x = 100 * Math.sin(fish.rotation);
      fish.acceleration.y = 100 * Math.cos(fish.rotation);
      return;
   }

   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(fish);
   if (wanderAIComponent.targetPositionX !== -1) {
      if (entityHasReachedPosition(fish, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
         wanderAIComponent.targetPositionX = -1;
         stopEntity(fish);
      }
   } else if (shouldWander(fish, 0.5)) {
      let attempts = 0;
      let targetTile: Tile;
      do {
         targetTile = getWanderTargetTile(fish, VISION_RANGE);
      } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "river"));

      if (attempts > 50) {
         stopEntity(fish);
         return;
      }
      
      // Find a position not too close to land
      let x: number;
      let y: number;
      do {
         x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
         y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
      } while (!isValidWanderPosition(x, y));

      // Find a path which doesn't cross land
      attempts = 0;
      while (++attempts <= 10 && !tileRaytraceMatchesTileTypes(fish.position.x, fish.position.y, x, y, [TileTypeConst.water])) {
         x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
         y = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
      }

      if (attempts <= 10) {
         wander(fish, x, y, ACCELERATION);
      } else {
         stopEntity(fish);
      }
   } else {
      stopEntity(fish);
   }
}

export function onFishHurt(fish: Entity, attackingEntity: Entity): void {
   registerAttackingEntity(fish, attackingEntity);
}

export function onFishDeath(fish: Entity): void {
   createItemsOverEntity(fish, ItemType.raw_fish, 1);
}

export function onFishRemove(fish: Entity): void {
   HealthComponentArray.removeComponent(fish);
   StatusEffectComponentArray.removeComponent(fish);
   WanderAIComponentArray.removeComponent(fish);
   EscapeAIComponentArray.removeComponent(fish);
   FishComponentArray.removeComponent(fish);
   AIHelperComponentArray.removeComponent(fish);
}