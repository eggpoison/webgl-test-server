import { EntityType, Point, randFloat, randInt, SETTINGS, TileTypeConst } from "webgl-test-shared";
import Entity from "./entities/Entity";
import ENTITY_CLASS_RECORD from "./entity-classes";
import Board from "./Board";
import Yeti, { yetiSpawnPositionIsValid } from "./entities/mobs/Yeti";
import { addEntityToCensus, getEntityCount, getTileTypeCount } from "./census";
import OPTIONS from "./options";
import SRandom from "./SRandom";

const PACK_SPAWN_RANGE = 200;

export interface EntitySpawnInfo {
   /** The type of entity to spawn */
   readonly entityType: EntityType;
   /** Array of all tile types in which the entity is able to be spawned in */
   readonly spawnableTiles: ReadonlyArray<TileTypeConst>;
   /** Average number of spawn attempts that happen each second per chunk. */
   readonly spawnRate: number;
   /** Maximum global density per tile the entity type can have. */
   readonly maxDensity: number;
   readonly minPackSize: number;
   readonly maxPackSize: number;
   readonly onlySpawnsInNight: boolean;
}

const SPAWN_INFO_RECORD: ReadonlyArray<EntitySpawnInfo> = [
   {
      entityType: "cow",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.01,
      maxDensity: 0.01,
      minPackSize: 2,
      maxPackSize: 5,
      onlySpawnsInNight: false
   },
   {
      entityType: "berry_bush",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.001,
      maxDensity: 0.0025,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "tree",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.01,
      maxDensity: 0.015,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "tombstone",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.01,
      maxDensity: 0.003,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: true
   },
   {
      entityType: "boulder",
      spawnableTiles: [TileTypeConst.rock],
      spawnRate: 0.005,
      maxDensity: 0.025,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "cactus",
      spawnableTiles: [TileTypeConst.sand],
      spawnRate: 0.005,
      maxDensity: 0.03,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "yeti",
      spawnableTiles: [TileTypeConst.snow],
      spawnRate: 0.004,
      maxDensity: 0.008,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   // {
   //    entityType: "ice_spikes",
   //    spawnableTiles: [TileTypeConst.ice, TileTypeConst.permafrost],
   //    spawnRate: 0.015,
   //    maxDensity: 0.06,
   //    // spawnRate: 0.015 * 50,
   //    // maxDensity: 0.06 * 50
   // },
   {
      entityType: "slimewisp",
      spawnableTiles: [TileTypeConst.slime],
      spawnRate: 0.2,
      maxDensity: 0.3,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "krumblid",
      spawnableTiles: [TileTypeConst.sand],
      spawnRate: 0.005,
      maxDensity: 0.015,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "frozen_yeti",
      spawnableTiles: [TileTypeConst.fimbultur],
      spawnRate: 0.004,
      maxDensity: 0.008,
      minPackSize: 1,
      maxPackSize: 1,
      onlySpawnsInNight: false
   },
   {
      entityType: "fish",
      spawnableTiles: [TileTypeConst.water],
      spawnRate: 0.015,
      maxDensity: 0.03,
      minPackSize: 3,
      maxPackSize: 4,
      onlySpawnsInNight: false
   }
];

/** Minimum distance a spawn event can occur from another entity */
export const MIN_SPAWN_DISTANCE = 150;
const MIN_SPAWN_DISTANCE_SQUARED = MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE;

const customSpawnConditionsAreMet = (spawnInfo: EntitySpawnInfo, spawnOriginX: number, spawnOriginY: number) => {
   switch (spawnInfo.entityType) {
      case "yeti": {
         return yetiSpawnPositionIsValid(spawnOriginX, spawnOriginY);
      }
   }

   return true;
}

const spawnConditionsAreMet = (spawnInfo: EntitySpawnInfo): boolean => {
   let numEligibleTiles = 0;
   for (const tileType of spawnInfo.spawnableTiles) {
      numEligibleTiles += getTileTypeCount(tileType);
   }
   
   // If there are no tiles upon which the entity is able to be spawned, the spawn conditions aren't valid
   if (numEligibleTiles === 0) return false;
   
   // Check if the entity density is right
   const entityCount = getEntityCount(spawnInfo.entityType);
   const density = entityCount / numEligibleTiles;
   if (density > spawnInfo.maxDensity) {
      return false;
   }

   // Make sure the spawn time is right
   if (spawnInfo.onlySpawnsInNight && !Board.isNight()) {
      return false;
   }
   
   return true;
}

const spawnEntities = (spawnInfo: EntitySpawnInfo, spawnOriginX: number, spawnOriginY: number): void => {
   // @Incomplete @Cleanup: Make all cows spawn with the same type,
   // and make fish spawn with the same colour
   
   // const cowSpecies = randInt(0, 1);
   
   const entityClass = ENTITY_CLASS_RECORD[spawnInfo.entityType]();
   
   const entity = new entityClass(new Point(spawnOriginX, spawnOriginY), true);
   addEntityToCensus(entity);

   // Pack spawning
 
   const minX = Math.max(spawnOriginX - PACK_SPAWN_RANGE, 0);
   const maxX = Math.min(spawnOriginX + PACK_SPAWN_RANGE, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);
   const minY = Math.max(spawnOriginY - PACK_SPAWN_RANGE, 0);
   const maxY = Math.min(spawnOriginY + PACK_SPAWN_RANGE, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);

   let totalSpawnAttempts = 0;

   let spawnCount: number;
   if (OPTIONS.inBenchmarkMode) {
      spawnCount = SRandom.randInt(spawnInfo.minPackSize, spawnInfo.maxPackSize) - 1;
   } else {
      spawnCount = randInt(spawnInfo.minPackSize, spawnInfo.maxPackSize) - 1;
   }

   for (let i = 0; i < spawnCount - 1;) {
      // @Speed: Garbage collection, and doing a whole bunch of unnecessary continues here
      
      // Generate a spawn position near the spawn origin
      const spawnPositionX = randFloat(minX, maxX);
      const spawnPositionY = randFloat(minY, maxY);

      const tile = Board.getTile(Math.floor(spawnPositionX / SETTINGS.TILE_SIZE), Math.floor(spawnPositionY / SETTINGS.TILE_SIZE));
      if (!spawnInfo.spawnableTiles.includes(tile.type)) {
         continue;
      }

      if (spawnPositionIsValid(spawnPositionX, spawnPositionY)) {
         const spawnPosition = new Point(randInt(minX, maxX), randInt(minY, maxY));
         const entity = new entityClass(spawnPosition, true);
         addEntityToCensus(entity);
         i++;
      }

      if (++totalSpawnAttempts === 99) {
         break;
      }
   }
}

export function spawnPositionIsValid(positionX: number, positionY: number): boolean {
   const minChunkX = Math.max(Math.min(Math.floor((positionX - MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor((positionX + MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor((positionY - MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor((positionY + MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

   const checkedEntities = new Set<Entity>();
   
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.entities) {
            if (checkedEntities.has(entity)) continue;
            
            const distanceSquared = Math.pow(positionX - entity.position.x, 2) + Math.pow(positionY - entity.position.y, 2);
            if (distanceSquared <= MIN_SPAWN_DISTANCE_SQUARED) {
               return false;
            }

            checkedEntities.add(entity);
         }
      }
   }

   return true;
}

const runSpawnEvent = (spawnInfo: EntitySpawnInfo): void => {
   // Pick a random tile to spawn at
   const tileX = randInt(0, SETTINGS.BOARD_SIZE * SETTINGS.CHUNK_SIZE - 1);
   const tileY = randInt(0, SETTINGS.BOARD_SIZE * SETTINGS.CHUNK_SIZE - 1);
   const tile = Board.getTile(tileX, tileY);

   // If the tile is a valid tile for the spawn info, continue with the spawn event
   if (spawnInfo.spawnableTiles.includes(tile.type)) {
      // Calculate a random position in that tile to run the spawn at
      const x = (tileX + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (tileY + Math.random()) * SETTINGS.TILE_SIZE;

      if (spawnPositionIsValid(x, y) && customSpawnConditionsAreMet(spawnInfo, x, y)) {
         spawnEntities(spawnInfo, x, y);
      }
   }
}

export function runSpawnAttempt(): void {
   if (!OPTIONS.spawnEntities) {
      return;
   }

   for (const spawnInfo of SPAWN_INFO_RECORD) {
      if (!spawnConditionsAreMet(spawnInfo)) {
         continue;
      }

      let numSpawnEvents = SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE * spawnInfo.spawnRate / SETTINGS.TPS;
      if (Math.random() < numSpawnEvents % 1) {
         numSpawnEvents = Math.ceil(numSpawnEvents);
      } else {
         numSpawnEvents = Math.floor(numSpawnEvents);
      }
      for (let i = 0; i < numSpawnEvents; i++) {
         runSpawnEvent(spawnInfo);
         if (!spawnConditionsAreMet(spawnInfo)) {
            break;
         }
      }
   }
}

export function spawnInitialEntities(): void {
   if (!OPTIONS.spawnEntities) {
      return;
   }

   let numSpawnAttempts: number;

   // For each spawn info object, spawn entities until no more can be spawned
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      numSpawnAttempts = 0;
      while (spawnConditionsAreMet(spawnInfo)) {
         runSpawnEvent(spawnInfo);

         if (++numSpawnAttempts >= 9999) {
            console.warn("Exceeded maximum number of spawn attempts for " + spawnInfo.entityType + " with " + getEntityCount(spawnInfo.entityType) + " entities.");
            break;
         }
      }
   }
}