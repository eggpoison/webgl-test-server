import { COLLISION_BITS, CowSpecies, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SETTINGS, TileInfoConst, TileTypeConst, randInt } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { AIHelperComponentArray, BerryBushComponentArray, CowComponentArray, EscapeAIComponentArray, FollowAIComponentArray, HealthComponentArray, ItemComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent, getEntityHealth, healEntity } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { chaseAndEatItemEntity, entityHasReachedPosition, moveEntityToPosition, runHerdAI, stopEntity } from "../../ai-shared";
import { getWanderTargetTile, shouldWander, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { chooseEscapeEntity, registerAttackingEntity, runFromAttackingEntity } from "../../ai/escape-ai";
import { EscapeAIComponent, updateEscapeAIComponent } from "../../components/EscapeAIComponent";
import Board from "../../Board";
import { AIHelperComponent } from "../../components/AIHelperComponent";
import { FollowAIComponent, canFollow, followEntity, updateFollowAIComponent } from "../../components/FollowAIComponent";
import { CowComponent, updateCowComponent } from "../../components/CowComponent";
import { dropBerry } from "../resources/berry-bush";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

const MAX_HEALTH = 10;
const VISION_RANGE = 256;

const MIN_GRAZE_COOLDOWN = 30 * SETTINGS.TPS;
const MAX_GRAZE_COOLDOWN = 60 * SETTINGS.TPS;

const MIN_FOLLOW_COOLDOWN = 15 * SETTINGS.TPS;
const MAX_FOLLOW_COOLDOWN = 30 * SETTINGS.TPS;

export const COW_GRAZE_TIME_TICKS = 5 * SETTINGS.TPS;

const TURN_RATE = 0.4;
const MIN_SEPARATION_DISTANCE = 150;
const SEPARATION_INFLUENCE = 0.7;
const ALIGNMENT_INFLUENCE = 0.5;
const COHESION_INFLUENCE = 0.3;

export function createCow(position: Point): Entity {
   const species: CowSpecies = randInt(0, 1);
   
   const cow = new Entity(position, IEntityType.cow, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(cow, 0, 0, 50, 100, 0);
   cow.addHitbox(hitbox);

   HealthComponentArray.addComponent(cow, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(cow, new StatusEffectComponent(0));
   AIHelperComponentArray.addComponent(cow, new AIHelperComponent(VISION_RANGE));
   WanderAIComponentArray.addComponent(cow, new WanderAIComponent());
   EscapeAIComponentArray.addComponent(cow, new EscapeAIComponent());
   FollowAIComponentArray.addComponent(cow, new FollowAIComponent(randInt(MIN_FOLLOW_COOLDOWN, MAX_FOLLOW_COOLDOWN)));
   CowComponentArray.addComponent(cow, new CowComponent(species, randInt(MIN_GRAZE_COOLDOWN, MAX_GRAZE_COOLDOWN)));

   return cow;
}

const graze = (cow: Entity, cowComponent: CowComponent): void => {
   stopEntity(cow);
   if (++cowComponent.grazeProgressTicks >= COW_GRAZE_TIME_TICKS) {
      // Eat grass
      const previousTile = cow.tile;
      const newTileInfo: TileInfoConst = {
         type: TileTypeConst.dirt,
         biomeName: previousTile.biomeName,
         isWall: false
      };
      Board.replaceTile(previousTile.x, previousTile.y, newTileInfo.type, newTileInfo.biomeName, newTileInfo.isWall, 0);

      healEntity(cow, 3);
      cowComponent.grazeCooldownTicks = randInt(MIN_GRAZE_COOLDOWN, MAX_GRAZE_COOLDOWN);
   }
}

const findHerdMembers = (cowComponent: CowComponent, visibleEntities: ReadonlyArray<Entity>): ReadonlyArray<Entity> => {
   const herdMembers = new Array<Entity>();
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];
      if (entity.type === IEntityType.cow) {
         const otherCowComponent = CowComponentArray.getComponent(entity);
         if (otherCowComponent.species === cowComponent.species) {
            herdMembers.push(entity);
         }
      }
   }
   return herdMembers;
}

export function tickCow(cow: Entity): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(cow);

   const cowComponent = CowComponentArray.getComponent(cow);
   updateCowComponent(cowComponent);

   // Graze dirt to recover health
   if (cowComponent.grazeCooldownTicks === 0 && cow.tile.type === TileTypeConst.grass) {
      graze(cow, cowComponent);
      return;
   } else {
      cowComponent.grazeProgressTicks = 0;
   }
   
   // Escape AI
   const escapeAIComponent = EscapeAIComponentArray.getComponent(cow);
   updateEscapeAIComponent(escapeAIComponent, 5 * SETTINGS.TPS);
   if (escapeAIComponent.attackingEntityIDs.length > 0) {
      const escapeEntity = chooseEscapeEntity(cow, aiHelperComponent.visibleEntities);
      if (escapeEntity !== null) {
         runFromAttackingEntity(cow, escapeEntity, 350);
         return;
      }
   }

   // Eat berries
   for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
      const itemEntity = aiHelperComponent.visibleEntities[i];
      if (itemEntity.type === IEntityType.itemEntity) {
         const itemComponent = ItemComponentArray.getComponent(itemEntity);
         if (itemComponent.itemType === ItemType.berry) {
            const wasEaten = chaseAndEatItemEntity(cow, itemEntity, 200);
            if (wasEaten) {
               healEntity(cow, 3);
               break;
            }
            return;
         }
      }
   }

   // If the target berry bush was killed, don't try to shake it
   if (cowComponent.targetBushID !== ID_SENTINEL_VALUE && !Board.entityRecord.hasOwnProperty(cowComponent.targetBushID)) {
      cowComponent.targetBushID = ID_SENTINEL_VALUE;
   }

   // Shake berries off berry bushes
   if (getEntityHealth(cow) < MAX_HEALTH) {
      if (cowComponent.targetBushID === ID_SENTINEL_VALUE) {
         // Attempt to find a berry bush
         let target: Entity | null = null;
         let minDistance = Number.MAX_SAFE_INTEGER;
         for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
            const berryBush = aiHelperComponent.visibleEntities[i];
            if (berryBush.type !== IEntityType.berryBush) {
               continue;
            }
   
            // Don't shake bushes without berries
            const berryBushComponent = BerryBushComponentArray.getComponent(berryBush);
            if (berryBushComponent.numBerries === 0) {
               continue;
            }

            const distance = cow.position.calculateDistanceBetween(berryBush.position);
            if (distance < minDistance) {
               minDistance = distance;
               target = berryBush;
            }
         }
   
         if (target !== null) {
            cowComponent.targetBushID = target.id;
         }
      }
      if (cowComponent.targetBushID !== ID_SENTINEL_VALUE) {
         const berryBush = Board.entityRecord[cowComponent.targetBushID];
   
         moveEntityToPosition(cow, berryBush.position.x, berryBush.position.y, 200);
   
         // If the target entity is directly in front of the cow, start eatin it
         const testPositionX = cow.position.x + 60 * Math.sin(cow.rotation);
         const testPositionY = cow.position.y + 60 * Math.cos(cow.rotation);
         if (Board.positionIsInBoard(testPositionX, testPositionY)) {
            const testEntities = Board.getEntitiesAtPosition(testPositionX, testPositionY);
            if (testEntities.has(berryBush)) {
               cowComponent.bushShakeTimer++;
               if (cowComponent.bushShakeTimer >= 1.5 * SETTINGS.TPS) {
                  dropBerry(berryBush);
                  cowComponent.bushShakeTimer = 0;
                  cowComponent.targetBushID = ID_SENTINEL_VALUE;
               }
            } else {
               cowComponent.bushShakeTimer = 0;
            }
         } else {
            cowComponent.bushShakeTimer = 0;
         }
   
         return;
      }
   }

   // Follow AI
   const followAIComponent = FollowAIComponentArray.getComponent(cow);
   updateFollowAIComponent(cow, aiHelperComponent.visibleEntities, 7)
   if (followAIComponent.followTargetID !== ID_SENTINEL_VALUE) {
      // Continue following the entity
      const followedEntity = Board.entityRecord[followAIComponent.followTargetID];
      moveEntityToPosition(cow, followedEntity.position.x, followedEntity.position.y, 200);
      return;
   } else if (canFollow(followAIComponent)) {
      for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
         const entity = aiHelperComponent.visibleEntities[i];
         if (entity.type === IEntityType.player) {
            // Follow the entity
            followEntity(cow, entity, 200, randInt(MIN_FOLLOW_COOLDOWN, MAX_FOLLOW_COOLDOWN));
            return;
         }
      }
   }
   
   // Herd AI
   // @Incomplete: Steer the herd away from non-grasslands biomes
   const herdMembers = findHerdMembers(cowComponent, aiHelperComponent.visibleEntities);
   if (herdMembers.length >= 2 && herdMembers.length <= 6) {
      runHerdAI(cow, herdMembers, VISION_RANGE, TURN_RATE, MIN_SEPARATION_DISTANCE, SEPARATION_INFLUENCE, ALIGNMENT_INFLUENCE, COHESION_INFLUENCE);
      cow.acceleration.x = 200 * Math.sin(cow.rotation);
      cow.acceleration.y = 200 * Math.cos(cow.rotation);
      return;
   }

   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(cow);
   if (wanderAIComponent.targetPositionX !== -1) {
      if (entityHasReachedPosition(cow, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
         wanderAIComponent.targetPositionX = -1;
         stopEntity(cow);
      }
   } else if (shouldWander(cow, 0.6)) {
      let attempts = 0;
      let targetTile: Tile;
      do {
         targetTile = getWanderTargetTile(cow, VISION_RANGE);
      } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "grasslands"));

      const x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
      wander(cow, x, y, 200)
   } else {
      stopEntity(cow);
   }
}

export function onCowHurt(cow: Entity, attackingEntity: Entity): void {
   registerAttackingEntity(cow, attackingEntity);
}

export function onCowDeath(cow: Entity): void {
   createItemsOverEntity(cow, ItemType.raw_beef, randInt(1, 2));
   createItemsOverEntity(cow, ItemType.leather, randInt(0, 2));
}

export function onCowRemove(cow: Entity): void {
   HealthComponentArray.removeComponent(cow);
   StatusEffectComponentArray.removeComponent(cow);
   AIHelperComponentArray.removeComponent(cow);
   WanderAIComponentArray.removeComponent(cow);
   EscapeAIComponentArray.removeComponent(cow);
   FollowAIComponentArray.removeComponent(cow);
   CowComponentArray.removeComponent(cow);
}