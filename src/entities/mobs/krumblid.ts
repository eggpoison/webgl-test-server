import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SETTINGS, randInt } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { EscapeAIComponentArray, FollowAIComponentArray, HealthComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, getEntitiesInVisionRange, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { FollowAIComponent, canFollow, followEntity, updateFollowAIComponent } from "../../components/FollowAIComponent";
import Board from "../../Board";
import { chooseEscapeEntity, registerAttackingEntity, runFromAttackingEntity } from "../../ai/escape-ai";
import { EscapeAIComponent, updateEscapeAIComponent } from "../../components/EscapeAIComponent";

const MAX_HEALTH = 15;
const KRUMBLID_SIZE = 48;
const VISION_RANGE = 224;

const MIN_FOLLOW_COOLDOWN = 7;
const MAX_FOLLOW_COOLDOWN = 9;

export function createKrumblid(position: Point): Entity {
   const krumblid = new Entity(position, IEntityType.krumblid, COLLISION_BITS.other, DEFAULT_COLLISION_MASK & ~COLLISION_BITS.cactus);

   const hitbox = new CircularHitbox(krumblid, 0, 0, KRUMBLID_SIZE / 2);
   krumblid.addHitbox(hitbox);

   HealthComponentArray.addComponent(krumblid, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(krumblid, new StatusEffectComponent());
   WanderAIComponentArray.addComponent(krumblid, new WanderAIComponent());
   FollowAIComponentArray.addComponent(krumblid, new FollowAIComponent(randInt(MIN_FOLLOW_COOLDOWN, MAX_FOLLOW_COOLDOWN)));
   EscapeAIComponentArray.addComponent(krumblid, new EscapeAIComponent());

   return krumblid;
}

export function tickKrumblid(krumblid: Entity): void {
   const visibleEntities = getEntitiesInVisionRange(krumblid.position.x, krumblid.position.y, VISION_RANGE);

   // @Cleanup: don't do here
   let idx = visibleEntities.indexOf(krumblid);
   while (idx !== -1) {
      visibleEntities.splice(idx, 1);
      idx = visibleEntities.indexOf(krumblid);
   }
   
   // Escape AI
   const escapeAIComponent = EscapeAIComponentArray.getComponent(krumblid);
   updateEscapeAIComponent(escapeAIComponent, 5 * SETTINGS.TPS);
   if (escapeAIComponent.attackingEntityIDs.length > 0) {
      const escapeEntity = chooseEscapeEntity(krumblid, visibleEntities);
      if (escapeEntity !== null) {
         runFromAttackingEntity(krumblid, escapeEntity, 200, 200);
         return;
      }
   }
   
   // Follow AI: Make the krumblid like to hide in cacti
   const followAIComponent = FollowAIComponentArray.getComponent(krumblid);
   updateFollowAIComponent(krumblid, visibleEntities, 5);
   if (followAIComponent.followTargetID !== ID_SENTINEL_VALUE) {
      // Continue following the entity
      const followedEntity = Board.entityRecord[followAIComponent.followTargetID];
      moveEntityToPosition(krumblid, followedEntity.position.x, followedEntity.position.y, 100, 50);
      return;
   } else if (canFollow(followAIComponent)) {
      for (let i = 0; i < visibleEntities.length; i++) {
         const entity = visibleEntities[i];
         if (entity.type === IEntityType.player) {
            // Follow the entity
            followEntity(krumblid, entity, 100, 50, randInt(MIN_FOLLOW_COOLDOWN, MAX_FOLLOW_COOLDOWN));
            return;
         }
      }
   }

   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(krumblid);
   if (wanderAIComponent.targetPositionX !== -1) {
      if (entityHasReachedPosition(krumblid, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
         wanderAIComponent.targetPositionX = -1;
         stopEntity(krumblid);
      }
   } else if (shouldWander(krumblid, 0.25)) {
      let attempts = 0;
      let targetTile: Tile;
      do {
         targetTile = getWanderTargetTile(krumblid, VISION_RANGE);
      } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "desert"));

      wander(krumblid, targetTile, 100, 50);
   } else {
      stopEntity(krumblid);
   }
}

export function onKrumblidHurt(cow: Entity, attackingEntity: Entity): void {
   registerAttackingEntity(cow, attackingEntity);
}

export function onKrumblidDeath(krumblid: Entity): void {
   createItemsOverEntity(krumblid, ItemType.leather, randInt(2, 3));
}