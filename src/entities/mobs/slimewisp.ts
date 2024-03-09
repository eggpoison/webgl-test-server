import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, SettingsConst, SlimeSize, StatusEffectConst, TileTypeConst } from "webgl-test-shared";
import Entity, { NO_COLLISION } from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, SlimewispComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { SlimewispComponent } from "../../components/SlimewispComponent";
import { createSlime } from "./slime";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { AIHelperComponent, AIHelperComponentArray } from "../../components/AIHelperComponent";
import { PhysicsComponent, PhysicsComponentArray } from "../../components/PhysicsComponent";
import Board from "../../Board";

const MAX_HEALTH = 3;
const RADIUS = 16;

const VISION_RANGE = 100;

const ACCELERATION = 100;

export const SLIMEWISP_MERGE_TIME = 2;

export function createSlimewisp(position: Point): Entity {
   const slimewisp = new Entity(position, IEntityType.slimewisp, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   slimewisp.rotation = 2 * Math.PI * Math.random();
   slimewisp.collisionPushForceMultiplier = 0.3;

   const hitbox = new CircularHitbox(slimewisp, 0.5, 0, 0, RADIUS);
   slimewisp.addHitbox(hitbox);

   PhysicsComponentArray.addComponent(slimewisp, new PhysicsComponent(true, false));
   HealthComponentArray.addComponent(slimewisp, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(slimewisp, new StatusEffectComponent(StatusEffectConst.poisoned));
   SlimewispComponentArray.addComponent(slimewisp, new SlimewispComponent());
   WanderAIComponentArray.addComponent(slimewisp, new WanderAIComponent());
   AIHelperComponentArray.addComponent(slimewisp, new AIHelperComponent(VISION_RANGE));

   return slimewisp;
}

export function tickSlimewisp(slimewisp: Entity): void {
   // Slimewisps move at normal speed on slime blocks
   const physicsComponent = PhysicsComponentArray.getComponent(slimewisp.id);
   physicsComponent.overrideMoveSpeedMultiplier = slimewisp.tile.type === TileTypeConst.slime || slimewisp.tile.type === TileTypeConst.sludge;

   const aiHelperComponent = AIHelperComponentArray.getComponent(slimewisp.id);
   
   // Merge with other slimewisps
   for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
      const mergingSlimewisp = aiHelperComponent.visibleEntities[i];
      if (mergingSlimewisp.type === IEntityType.slimewisp) {
         moveEntityToPosition(slimewisp, mergingSlimewisp.position.x, mergingSlimewisp.position.y, ACCELERATION);
   
         // Continue merge
         if (slimewisp.isColliding(mergingSlimewisp) !== NO_COLLISION) {
            const slimewispComponent = SlimewispComponentArray.getComponent(slimewisp.id);
            slimewispComponent.mergeTimer -= SettingsConst.I_TPS;
            if (slimewispComponent.mergeTimer <= 0 && !Board.entityIsFlaggedForRemoval(mergingSlimewisp)) {
               // Create a slime between the two wisps
               const slimeSpawnPosition = new Point((slimewisp.position.x + mergingSlimewisp.position.x) / 2, (slimewisp.position.y + mergingSlimewisp.position.y) / 2);
               createSlime(slimeSpawnPosition, SlimeSize.small, []);
            
               slimewisp.remove();
               mergingSlimewisp.remove();
            }
         }
         return;
      }
   }
   
   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(slimewisp.id);
   if (wanderAIComponent.targetPositionX !== -1) {
      if (entityHasReachedPosition(slimewisp, wanderAIComponent.targetPositionX, wanderAIComponent.targetPositionY)) {
         wanderAIComponent.targetPositionX = -1;
         stopEntity(slimewisp);
      }
   } else if (shouldWander(slimewisp, 99999)) {
      let attempts = 0;
      let targetTile: Tile;
      do {
         targetTile = getWanderTargetTile(slimewisp, VISION_RANGE);
      } while (++attempts <= 50 && (targetTile.isWall || targetTile.biomeName !== "swamp"));

      const x = (targetTile.x + Math.random()) * SettingsConst.TILE_SIZE;
      const y = (targetTile.y + Math.random()) * SettingsConst.TILE_SIZE;
      wander(slimewisp, x, y, ACCELERATION);
   } else {
      stopEntity(slimewisp);
   }
}

export function onSlimewispRemove(slimewisp: Entity): void {
   PhysicsComponentArray.removeComponent(slimewisp);
   HealthComponentArray.removeComponent(slimewisp);
   StatusEffectComponentArray.removeComponent(slimewisp);
   SlimewispComponentArray.removeComponent(slimewisp);
   WanderAIComponentArray.removeComponent(slimewisp);
   AIHelperComponentArray.removeComponent(slimewisp);
}