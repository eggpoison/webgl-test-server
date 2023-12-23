import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, SETTINGS } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, SlimewispComponentArray, WanderAIComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { WanderAIComponent } from "../../components/WanderAIComponent";
import { entityHasReachedPosition, getEntitiesInVisionRange, moveEntityToPosition, stopEntity } from "../../ai-shared";
import { shouldWander, getWanderTargetTile, wander } from "../../ai/wander-ai";
import Tile from "../../Tile";
import { SlimewispComponent } from "../../components/SlimewispComponent";
import { createSlime } from "./slime";

const MAX_HEALTH = 3;
const RADIUS = 16;

const VISION_RANGE = 100;

const ACCELERATION = 50;
const TERMINAL_VELOCITY = 25;

export const SLIMEWISP_MERGE_TIME = 2;

export function createSlimewisp(position: Point): Entity {
   const slimewisp = new Entity(position, IEntityType.slimewisp, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(slimewisp, 0, 0, RADIUS);
   slimewisp.addHitbox(hitbox);

   HealthComponentArray.addComponent(slimewisp, new HealthComponent(MAX_HEALTH));
   SlimewispComponentArray.addComponent(slimewisp, new SlimewispComponent());
   WanderAIComponentArray.addComponent(slimewisp, new WanderAIComponent());
   
   return slimewisp;
}

export function tickSlimewisp(slimewisp: Entity): void {
   const visibleEntities = getEntitiesInVisionRange(slimewisp.position.x, slimewisp.position.y, VISION_RANGE);

   // @Cleanup: don't do here
   let idx = visibleEntities.indexOf(slimewisp);
   while (idx !== -1) {
      visibleEntities.splice(idx, 1);
      idx = visibleEntities.indexOf(slimewisp);
   }
   
   // Merge with other slimewisps
   let minDist = Number.MAX_SAFE_INTEGER;
   let mergingSlimewisp: Entity | null = null;
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];
      if (entity.type !== IEntityType.slimewisp) {
         continue;
      }

      const distance = slimewisp.position.calculateDistanceBetween(entity.position);
      if (distance < minDist) {
         minDist = distance;
         mergingSlimewisp = entity;
      }
   }
   if (mergingSlimewisp !== null) {
      moveEntityToPosition(slimewisp, mergingSlimewisp.position.x, mergingSlimewisp.position.y, ACCELERATION, TERMINAL_VELOCITY);

      // Continue merge
      if (slimewisp.isColliding(mergingSlimewisp)) {
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

      wander(slimewisp, targetTile, ACCELERATION, TERMINAL_VELOCITY);
   } else {
      stopEntity(slimewisp);
   }
}