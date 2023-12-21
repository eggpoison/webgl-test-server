import { Point, SETTINGS, circleAndRectangleDoIntersectWithOffset, circulesDoIntersectWithOffset } from "webgl-test-shared";
import Chunk from "../Chunk";
import Entity from "../GameObject";
import { AIHelperComponentArray } from "./ComponentArray";
import Board from "../Board";
import Hitbox from "../hitboxes/Hitbox";
import CircularHitbox from "../hitboxes/CircularHitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

export class AIHelperComponent {
   public visibleEntities = new Array<Entity>();
   public visibleChunks = new Array<Chunk>();
}

const hitboxIsVisible = (entity: Entity, hitbox: Hitbox, visionRange: number): boolean => {
   // @Speed: This check is slow
   if (hitbox.hasOwnProperty("radius")) {
      // Circular hitbox
      // @Speed
      return circulesDoIntersectWithOffset(entity.position, new Point(0, 0), visionRange, hitbox.object.position, hitbox.offset, (hitbox as CircularHitbox).radius);
   } else {
      // Rectangular hitbox
      // @Speed
      return circleAndRectangleDoIntersectWithOffset(entity.position, new Point(0, 0), visionRange, hitbox.object.position, hitbox.offset, (hitbox as RectangularHitbox).width, (hitbox as RectangularHitbox).height, (hitbox as RectangularHitbox).rotation);
   }
}

export function updateAIHelperComponent(entity: Entity, visionRange: number): void {
   const aiHelperComponent = AIHelperComponentArray.getComponent(entity);
      
   const minChunkX = Math.max(Math.min(Math.floor((entity.position.x - visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor((entity.position.x + visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor((entity.position.y - visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor((entity.position.y + visionRange) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);

   const thisChunkX = Math.max(Math.min(Math.floor(entity.position.x / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
   const thisChunkY = Math.max(Math.min(Math.floor(entity.position.y / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
   
   aiHelperComponent.visibleChunks = new Array<Chunk>();
   const potentialVisibleEntities = new Array<Entity>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         // Check if the chunk is actually in the vision range
         // Find the closest point of the chunk border to the mob
         let closestChunkPointX: number;
         let closestChunkPointY: number;
         if (chunkX === thisChunkX) {
            closestChunkPointX = entity.position.x;
         } else {
            closestChunkPointX = entity.position.x < (chunkX + 0.5) * SETTINGS.CHUNK_UNITS ? chunkX * SETTINGS.CHUNK_UNITS : (chunkX + 1) * SETTINGS.CHUNK_UNITS;
         }
         if (chunkY === thisChunkY) {
            closestChunkPointY = entity.position.y;
         } else {
            closestChunkPointY = entity.position.y < (chunkY + 0.5) * SETTINGS.CHUNK_UNITS ? chunkY * SETTINGS.CHUNK_UNITS : (chunkY + 1) * SETTINGS.CHUNK_UNITS;
         }

         if (Math.pow(closestChunkPointX - entity.position.x, 2) + Math.pow(closestChunkPointY - entity.position.y, 2) <= visionRange * visionRange) {
            const chunk = Board.getChunk(chunkX, chunkY);
            aiHelperComponent.visibleChunks.push(chunk);
            for (const entity of chunk.entities) {
               if (potentialVisibleEntities.indexOf(entity) === -1) {
                  potentialVisibleEntities.push(entity);
               }
            }
         }
      }
   }

   // @Speed: Garbage collection, and likely uses a whole ton of malloc under the hood
   aiHelperComponent.visibleEntities = [];

   for (let i = 0; i < potentialVisibleEntities.length; i++) {
      const gameObject = potentialVisibleEntities[i];
      
      if (Math.pow(entity.position.x - gameObject.position.x, 2) + Math.pow(entity.position.y - gameObject.position.y, 2) <= visionRange * visionRange) {
         aiHelperComponent.visibleEntities.push(gameObject);
         continue;
      }

      // If the mob can see any of the game object's hitboxes, it is visible
      const numHitboxes = gameObject.hitboxes.length;
      for (let j = 0; j < numHitboxes; j++) {
         const hitbox = gameObject.hitboxes[j];
         if (hitboxIsVisible(entity, hitbox, visionRange)) {
            aiHelperComponent.visibleEntities.push(gameObject);
            break;
         }
      }
   }

   aiHelperComponent.visibleEntities.splice(aiHelperComponent.visibleEntities.indexOf(entity), 1);
}