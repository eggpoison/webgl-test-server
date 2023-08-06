import { Point, SETTINGS, Vector, lerp, randItem } from "webgl-test-shared";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Board from "./Board";
import Tile from "./tiles/Tile";

const FLESH_SWORD_VISION_RANGE = 250;

const FLESH_SWORD_WANDER_MOVE_SPEED = 35;
const FLESH_SWORD_ESCAPE_MOVE_SPEED = 50;

const FLESH_SWORD_WANDER_RATE = 0.3;

const getVisibleEntities = (droppedItem: DroppedItem): ReadonlyArray<Entity> => {
   const minChunkX = Math.max(Math.min(Math.floor((droppedItem.position.x - FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor((droppedItem.position.x + FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor((droppedItem.position.y - FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor((droppedItem.position.y + FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

   const entitiesInVisionRange = new Array<Entity>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.getEntities()) {
            // Don't add existing entities
            if (entitiesInVisionRange.includes(entity)) continue;

            if (Math.pow(droppedItem.position.x - entity.position.x, 2) + Math.pow(droppedItem.position.y - entity.position.y, 2) <= Math.pow(FLESH_SWORD_VISION_RANGE, 2)) {
               entitiesInVisionRange.push(entity);
            }
         }
      }  
   }

   return entitiesInVisionRange;
}

/** Returns the entity the flesh sword should run away from, or null if there are none */
const getRunTarget = (droppedItem: DroppedItem, visibleEntities: ReadonlyArray<Entity>): Entity | null => {
   let closestRunTargetDistance = Number.MAX_SAFE_INTEGER;
   let runTarget: Entity | null = null;

   for (const entity of visibleEntities) {
      if (entity.type === "player" || entity.type === "tribesman") {
         const distance = droppedItem.position.calculateDistanceBetween(entity.position);
         if (distance < closestRunTargetDistance) {
            closestRunTargetDistance = distance;
            runTarget = entity;
         }
      }
   }

   return runTarget;
}

const getTileWanderTargets = (droppedItem: DroppedItem): Array<Tile> => {
   const wanderTargets = new Array<Tile>();

   const minTileX = Math.max(Math.min(Math.floor((droppedItem.position.x - FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
   const maxTileX = Math.max(Math.min(Math.floor((droppedItem.position.x + FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
   const minTileY = Math.max(Math.min(Math.floor((droppedItem.position.y - FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
   const maxTileY = Math.max(Math.min(Math.floor((droppedItem.position.y + FLESH_SWORD_VISION_RANGE) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);

   for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
         // Don't try to wander to wall tiles
         const tile = Board.getTile(tileX, tileY);
         if (tile.isWall) continue;

         
         const position = new Point((tileX + Math.random()) * SETTINGS.TILE_SIZE, (tileY + Math.random()) * SETTINGS.TILE_SIZE);
         const distance = droppedItem.position.calculateDistanceBetween(position);
         if (distance <= FLESH_SWORD_VISION_RANGE) {
            wanderTargets.push(tile);
         }
      }
   }

   return wanderTargets;
}

const hasReachedTargetPosition = (droppedItem: DroppedItem, targetPosition: Point): boolean => {
   if (droppedItem.velocity === null) return true;
   
   const relativeTargetPosition = droppedItem.position.copy();
   relativeTargetPosition.subtract(targetPosition);

   const dotProduct = droppedItem.velocity.convertToPoint().calculateDotProduct(relativeTargetPosition);
   return dotProduct > 0;
}

interface FleshSwordInfo {
   internalWiggleTicks: number;
   tileTargetPosition: Point | null;
}

const FLESH_SWORD_INFO: Record<number, FleshSwordInfo> = {};

export function runFleshSwordAI(droppedItem: DroppedItem) {
   if (!FLESH_SWORD_INFO.hasOwnProperty(droppedItem.id)) {
      throw new Error("Dropped item isn't a flesh sword.");
   }

   const info = FLESH_SWORD_INFO[droppedItem.id];

   // Position the flesh sword wants to move to
   let targetPosition: Point | undefined;
   let moveSpeed: number | undefined;
   let wiggleSpeed: number | undefined;

   const visibleEntities = getVisibleEntities(droppedItem);

   const runTarget = getRunTarget(droppedItem, visibleEntities);

   // Run away from the run target
   if (runTarget !== null) {
      const angleFromTarget = droppedItem.position.calculateAngleBetween(runTarget.position);

      targetPosition = droppedItem.position.copy();
      targetPosition.add(new Vector(100, angleFromTarget + Math.PI).convertToPoint());
      
      const distance = droppedItem.position.calculateDistanceBetween(runTarget.position);
      let dist = distance / FLESH_SWORD_VISION_RANGE;
      dist = Math.pow(1 - dist, 2);
      wiggleSpeed = lerp(1, 4, dist);
      moveSpeed = FLESH_SWORD_ESCAPE_MOVE_SPEED * lerp(1, 3.5, dist);

      info.tileTargetPosition = null;
   } else {
      if (info.tileTargetPosition !== null) {
         if (hasReachedTargetPosition(droppedItem, info.tileTargetPosition)) {
            info.tileTargetPosition = null;
         } else {
            targetPosition = info.tileTargetPosition;
            moveSpeed = FLESH_SWORD_WANDER_MOVE_SPEED;
            wiggleSpeed = 1;
         }
      } else {
         // Chance to try to wander to a nearby tile
         if (Math.random() < FLESH_SWORD_WANDER_RATE / SETTINGS.TPS) {
            const tileWanderTargets = getTileWanderTargets(droppedItem);
   
            let targetTile!: Tile;
   
            // If any of the tiles are in a swamp, move to them
            for (const tile of tileWanderTargets) {
               if (tile.biomeName === "swamp") {
                  targetTile = tile;
                  break;
               }
            }
   
            // Otherwise just pick a random tile to go to
            if (typeof targetTile === "undefined") {
               targetTile = randItem(tileWanderTargets);
            }
   
            const x = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE
            const y = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE
            targetPosition = new Point(x, y);
            moveSpeed = FLESH_SWORD_WANDER_MOVE_SPEED;
            wiggleSpeed = 1;
            
            info.tileTargetPosition = targetPosition;
         }
      }
   }

   if (typeof targetPosition !== "undefined") {
      info.internalWiggleTicks += wiggleSpeed!;
      
      const directMoveAngle = droppedItem.position.calculateAngleBetween(targetPosition);

      const moveAngleOffset = Math.sin(info.internalWiggleTicks / SETTINGS.TPS * 10) * Math.PI * 0.2;

      const moveAngle = directMoveAngle + moveAngleOffset;
      droppedItem.rotation = moveAngle - Math.PI/4;
      droppedItem.velocity = new Vector(moveSpeed!, moveAngle);
   }
}

export function addFleshSword(droppedItem: DroppedItem): void {
   FLESH_SWORD_INFO[droppedItem.id] = {
      internalWiggleTicks: 0,
      tileTargetPosition: null
   };
}

export function removeFleshSword(droppedItem: DroppedItem): void {
   delete FLESH_SWORD_INFO[droppedItem.id];
}