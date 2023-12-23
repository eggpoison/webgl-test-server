import { IEntityType, Point, SETTINGS, circleAndRectangleDoIntersectWithOffset, circulesDoIntersectWithOffset } from "webgl-test-shared";
import Chunk from "../Chunk";
import Entity from "../GameObject";
import { AIHelperComponentArray } from "./ComponentArray";
import Board from "../Board";
import Hitbox from "../hitboxes/Hitbox";
import CircularHitbox from "../hitboxes/CircularHitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

export class AIHelperComponent {
   public visibleChunkBounds = [999, 999, 999, 999];
   public visibleChunks = new Array<Chunk>();

   public readonly potentialVisibleEntities = new Array<Entity>();
   /** The number of times each potential visible game object appears in the mob's visible chunks */
   public readonly potentialVisibleEntityAppearances = new Array<number>();
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
   
   if (minChunkX === aiHelperComponent.visibleChunkBounds[0] && maxChunkX === aiHelperComponent.visibleChunkBounds[1] && minChunkY === aiHelperComponent.visibleChunkBounds[2] && maxChunkY === aiHelperComponent.visibleChunkBounds[3]) {
      return;
   }

   aiHelperComponent.visibleChunkBounds[0] = minChunkX;
   aiHelperComponent.visibleChunkBounds[1] = maxChunkX;
   aiHelperComponent.visibleChunkBounds[2] = minChunkY;
   aiHelperComponent.visibleChunkBounds[3] = maxChunkY;

   const newVisibleChunks = new Array<Chunk>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         newVisibleChunks.push(chunk);
      }
   }

   // Find all chunks which aren't present in the new chunks and remove them
   for (const chunk of aiHelperComponent.visibleChunks) {
      if (newVisibleChunks.indexOf(chunk) === -1) {
         // Remove previously visible chunk
         chunk.viewingEntities.splice(chunk.viewingEntities.indexOf(entity), 1);
         aiHelperComponent.visibleChunks.splice(aiHelperComponent.visibleChunks.indexOf(chunk), 1);

         // Remove game objects in the chunk from the potentially visible list
         const numGameObjects = chunk.entities.length;
         for (let i = 0; i < numGameObjects; i++) {
            const gameObject = chunk.entities[i];
            const idx = aiHelperComponent.potentialVisibleEntities.indexOf(gameObject);
            aiHelperComponent.potentialVisibleEntityAppearances[idx]--;
            if (aiHelperComponent.potentialVisibleEntityAppearances[idx] === 0) {
               aiHelperComponent.potentialVisibleEntities.splice(idx, 1);
               aiHelperComponent.potentialVisibleEntityAppearances.splice(idx, 1);
            }
         }
      }
   }

   // Add all new chunks
   for (const chunk of newVisibleChunks) {
      if (aiHelperComponent.visibleChunks.indexOf(chunk) === -1) {
         // Add new visible chunk
         chunk.viewingEntities.push(entity);
         aiHelperComponent.visibleChunks.push(chunk);

         // Add existing game objects to the potentially visible list
         const numGameObjects = chunk.entities.length;
         for (let i = 0; i < numGameObjects; i++) {
            const gameObject = chunk.entities[i];
            const idx = aiHelperComponent.potentialVisibleEntities.indexOf(gameObject);
            if (idx === -1) {
               aiHelperComponent.potentialVisibleEntities.push(gameObject);
               aiHelperComponent.potentialVisibleEntityAppearances.push(1);
            } else {
               aiHelperComponent.potentialVisibleEntityAppearances[idx]++;
            }
         }
      }
   }
}

const entityIsVisible = (entity: Entity, checkEntity: Entity, visionRange: number): boolean => {
   const xDiff = entity.position.x - checkEntity.position.x;
   const yDiff = entity.position.y - checkEntity.position.y;
   if (xDiff * xDiff + yDiff * yDiff <= visionRange * visionRange) {
      return true;
   }

   // If the mob can see any of the game object's hitboxes, it is visible
   for (let j = 0; j < checkEntity.hitboxes.length; j++) {
      const hitbox = checkEntity.hitboxes[j];
      if (hitboxIsVisible(entity, hitbox, visionRange)) {
         return true;
      }
   }

   return false;
}

export function calculateVisibleEntities(entity: Entity, aiHelperComponent: AIHelperComponent, visionRange: number): Array<Entity> {
   const visibleEntities = new Array<Entity>();

   for (let i = 0; i < aiHelperComponent.potentialVisibleEntities.length; i++) {
      const currentEntity = aiHelperComponent.potentialVisibleEntities[i];
      if (entityIsVisible(entity, currentEntity, visionRange)) {
         visibleEntities.push(currentEntity);
      }
   }

   visibleEntities.splice(visibleEntities.indexOf(entity), 1);

   return visibleEntities;
}