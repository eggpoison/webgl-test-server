import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SettingsConst, randInt } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { EscapeAIComponentArray, FollowAIComponentArray, HealthComponentArray, PhysicsComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { FollowAIComponent, canFollow, followEntity, updateFollowAIComponent } from "../../components/FollowAIComponent";
import Board from "../../Board";
import { chooseEscapeEntity, registerAttackingEntity, runFromAttackingEntity } from "../../ai/escape-ai";
import { EscapeAIComponent, updateEscapeAIComponent } from "../../components/EscapeAIComponent";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { PhysicsComponent } from "../../components/PhysicsComponent";

const MAX_HEALTH = 15;
const KRUMBLID_SIZE = 48;
const VISION_RANGE = 224;

const MIN_FOLLOW_COOLDOWN = 7;
const MAX_FOLLOW_COOLDOWN = 9;

export function createKrumblid(position: Point): Entity {
   const krumblid = new Entity(position, IEntityType.krumblid, COLLISION_BITS.default, DEFAULT_COLLISION_MASK & ~COLLISION_BITS.cactus);
   krumblid.rotation = 2 * Math.PI * Math.random();

   const hitbox = new CircularHitbox(krumblid, 0.75, 0, 0, KRUMBLID_SIZE / 2);
   krumblid.addHitbox(hitbox);

   PhysicsComponentArray.addComponent(krumblid, new PhysicsComponent(true));
   HealthComponentArray.addComponent(krumblid, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(krumblid, new StatusEffectComponent(0));
   WanderAIComponentArray.addComponent(krumblid, new WanderAIComponent());
   FollowAIComponentArray.addComponent(krumblid, new FollowAIComponent(randInt(MIN_FOLLOW_COOLDOWN, MAX_FOLLOW_COOLDOWN)));
   EscapeAIComponentArray.addComponent(krumblid, new EscapeAIComponent());
   AIHelperComponentArray.addComponent(krumblid, new AIHelperComponent(VISION_RANGE));

   return krumblid;
}

export function tickKrumblid(krumblid: Entity): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(krumblid);
   
   // Escape AI
   const escapeAIComponent = EscapeAIComponentArray.getComponent(krumblid);
   updateEscapeAIComponent(escapeAIComponent, 5 * SettingsConst.TPS);
   if (escapeAIComponent.attackingEntityIDs.length > 0) {
      const escapeEntity = chooseEscapeEntity(krumblid, aiHelperComponent.visibleEntities);
      if (escapeEntity !== null) {
         runFromAttackingEntity(krumblid, escapeEntity, 500);
         return;
      }
   }
   
   // Follow AI: Make the krumblid like to hide in cacti
   const followAIComponent = FollowAIComponentArray.getComponent(krumblid);
   updateFollowAIComponent(krumblid, aiHelperComponent.visibleEntities, 5);
   if (followAIComponent.followTargetID !== ID_SENTINEL_VALUE) {
      // Continue following the entity
      const followedEntity = Board.entityRecord[followAIComponent.followTargetID];
      moveEntityToPosition(krumblid, followedEntity.position.x, followedEntity.position.y, 200);
      return;
   } else if (canFollow(followAIComponent)) {
      for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
         const entity = aiHelperComponent.visibleEntities[i];
         if (entity.type === IEntityType.player) {
            // Follow the entity
            followEntity(krumblid, entity, 200, randInt(MIN_FOLLOW_COOLDOWN, MAX_FOLLOW_COOLDOWN));
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

      const x = (targetTile.x + Math.random()) * SettingsConst.TILE_SIZE;
      const y = (targetTile.y + Math.random()) * SettingsConst.TILE_SIZE;
      wander(krumblid, x, y, 200);
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

export function onKrumblidRemove(krumblid: Entity): void {
   PhysicsComponentArray.removeComponent(krumblid);
   HealthComponentArray.removeComponent(krumblid);
   StatusEffectComponentArray.removeComponent(krumblid);
   WanderAIComponentArray.removeComponent(krumblid);
   FollowAIComponentArray.removeComponent(krumblid);
   EscapeAIComponentArray.removeComponent(krumblid);
   AIHelperComponentArray.removeComponent(krumblid);
}