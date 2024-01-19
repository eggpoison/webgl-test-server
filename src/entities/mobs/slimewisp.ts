import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, SETTINGS, StatusEffectConst, TileTypeConst } from "webgl-test-shared";
import Entity, { NO_COLLISION } from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { AIHelperComponentArray, HealthComponentArray, PhysicsComponentArray, SlimewispComponentArray, StatusEffectComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { SlimewispComponent } from "../../components/SlimewispComponent";
import { createSlime } from "./slime";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { AIHelperComponent } from "../../components/AIHelperComponent";
import { PhysicsComponent } from "../../components/PhysicsComponent";

const MAX_HEALTH = 3;
const RADIUS = 16;

const VISION_RANGE = 100;

const ACCELERATION = 100;

export const SLIMEWISP_MERGE_TIME = 2;

export function createSlimewisp(position: Point): Entity {
   const slimewisp = new Entity(position, IEntityType.slimewisp, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   slimewisp.rotation = 2 * Math.PI * Math.random();
   slimewisp.collisionPushForceMultiplier = 0.3;

   const hitbox = new CircularHitbox(slimewisp, 0.5, 0, 0, RADIUS, 0);
   slimewisp.addHitbox(hitbox);

   PhysicsComponentArray.addComponent(slimewisp, new PhysicsComponent(true));
   HealthComponentArray.addComponent(slimewisp, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(slimewisp, new StatusEffectComponent(StatusEffectConst.poisoned));
   SlimewispComponentArray.addComponent(slimewisp, new SlimewispComponent());
   WanderAIComponentArray.addComponent(slimewisp, new WanderAIComponent());
   AIHelperComponentArray.addComponent(slimewisp, new AIHelperComponent(VISION_RANGE));

   return slimewisp;
}

export function tickSlimewisp(slimewisp: Entity): void {
   // Slimewisps move at normal speed on slime blocks
   slimewisp.overrideMoveSpeedMultiplier = slimewisp.tile.type === TileTypeConst.slime || slimewisp.tile.type === TileTypeConst.sludge;

   const aiHelperComponent = AIHelperComponentArray.getComponent(slimewisp);
   
   // Merge with other slimewisps
   for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
      const mergingSlimewisp = aiHelperComponent.visibleEntities[i];
      if (mergingSlimewisp.type === IEntityType.slimewisp) {
         moveEntityToPosition(slimewisp, mergingSlimewisp.position.x, mergingSlimewisp.position.y, ACCELERATION);
   
         // Continue merge
         if (slimewisp.isColliding(mergingSlimewisp) !== NO_COLLISION) {
            const slimewispComponent = SlimewispComponentArray.getComponent(slimewisp);
            slimewispComponent.mergeTimer -= 1 / SETTINGS.TPS;
            if (slimewispComponent.mergeTimer <= 0 && !mergingSlimewisp.isRemoved) {
               // Create a slime between the two wisps
               const slimeSpawnPosition = new Point((slimewisp.position.x + mergingSlimewisp.position.x) / 2, (slimewisp.position.y + mergingSlimewisp.position.y) / 2);
               createSlime(slimeSpawnPosition);
            
               slimewisp.remove();
               mergingSlimewisp.remove();
            }
         }
         return;
      }
   }
   
   // Wander AI
   const wanderAIComponent = WanderAIComponentArray.getComponent(slimewisp);
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

      const x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
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