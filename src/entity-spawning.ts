import { EntityType, Point, randInt, SETTINGS, TileTypeConst } from "webgl-test-shared";
import Entity from "./entities/Entity";
import ENTITY_CLASS_RECORD from "./entity-classes";
import Board from "./Board";
import Yeti from "./entities/mobs/Yeti";
import { addEntityToCensus, getEntityCount, getTileTypeCount } from "./census";
import OPTIONS from "./options";
import SRandom from "./SRandom";

export type EntitySpawnInfo = {
   /** The type of entity to spawn */
   readonly entityType: EntityType;
   /** Array of all tile types in which the entity is able to be spawned in */
   readonly spawnableTiles: ReadonlyArray<TileTypeConst>;
   /** Average number of spawn attempts that happen each second per chunk. */
   readonly spawnRate: number;
   /**
    * If present, details how a pack of entities should be spawned.
    * Doesn't affect the conditions for the entity's spawn.
   */
   readonly packSpawningInfo?: {
      readonly size: number | [number, number];
      /** Maximum istance from the spawn origin that the entities can spawn */
      readonly spawnRange: number;
   }
   /** Maximum global density per tile the entity type can have. */
   readonly maxDensity: number;
   /** Time ranges when the entity is able to be spawned. Only one time range has to be satisfied for the entity to be able to spawn. */
   readonly spawnTimeRanges?: ReadonlyArray<[minSpawnTime: number, maxSpawnTime: number]>;
   /** Optional function which determines whether a given position is suitable to spawn the entity at according to some custom criteria. */
   readonly spawnValidationFunction?: (position: Point) => boolean;
}

const SPAWN_INFO_RECORD: ReadonlyArray<EntitySpawnInfo> = [
   {
      entityType: "cow",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.01,
      maxDensity: 0.01,
      packSpawningInfo: {
         size: [2, 5],
         spawnRange: 200
      }
   },
   {
      entityType: "berry_bush",
      spawnableTiles: [TileTypeConst.grass],
      // spawnRate: 0.001,
      // maxDensity: 0.0025
      spawnRate: 0.005,
      maxDensity: 0.005,
   },
   {
      entityType: "tree",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.01,
      maxDensity: 0.015
   },
   {
      entityType: "tombstone",
      spawnableTiles: [TileTypeConst.grass],
      spawnRate: 0.01,
      maxDensity: 0.003,
      spawnTimeRanges: [[0, 3], [19, 24]] // 7pm to 3am
   },
   {
      entityType: "boulder",
      spawnableTiles: [TileTypeConst.rock],
      spawnRate: 0.005,
      maxDensity: 0.025
   },
   {
      entityType: "cactus",
      spawnableTiles: [TileTypeConst.sand],
      spawnRate: 0.005,
      maxDensity: 0.03
   },
   {
      entityType: "yeti",
      spawnableTiles: [TileTypeConst.snow],
      spawnRate: 0.004,
      maxDensity: 0.008,
      spawnValidationFunction: Yeti.spawnValidationFunction
   },
   {
      entityType: "ice_spikes",
      spawnableTiles: [TileTypeConst.ice, TileTypeConst.permafrost],
      spawnRate: 0.015,
      maxDensity: 0.06,
      // spawnRate: 0.015 * 50,
      // maxDensity: 0.06 * 50
   },
   {
      entityType: "slimewisp",
      // @Temporary
      // spawnableTiles: ["slime"],
      spawnableTiles: [TileTypeConst.slime, TileTypeConst.sludge],
      spawnRate: 0.2,
      maxDensity: 0.3
   },
   {
      entityType: "krumblid",
      spawnableTiles: [TileTypeConst.sand],
      spawnRate: 0.005,
      maxDensity: 0.015
   },
   {
      entityType: "frozen_yeti",
      spawnableTiles: [TileTypeConst.fimbultur],
      spawnRate: 0.004,
      maxDensity: 0.008
   },
   {
      entityType: "fish",
      spawnableTiles: [TileTypeConst.water],
      spawnRate: 0.015,
      maxDensity: 0.03,
      packSpawningInfo: {
         size: [3, 4],
         spawnRange: 200
      }
   }
];

/** Minimum distance a spawn event can occur from another entity */
export const MIN_SPAWN_DISTANCE = 150;

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

   // Check time ranges are valid
   if (typeof spawnInfo.spawnTimeRanges !== "undefined") {
      let spawnTimeIsValid = false;
      for (const [minSpawnTime, maxSpawnTime] of spawnInfo.spawnTimeRanges) {
         if (Board.time >= minSpawnTime && Board.time <= maxSpawnTime) {
            spawnTimeIsValid = true;
            break;
         }
      }
      if (!spawnTimeIsValid) return false;
   }
   
   return true;
}

const spawnEntities = (spawnInfo: EntitySpawnInfo, spawnOrigin: Point): void => {
   if (!spawnPositionIsValid(spawnOrigin)) {
      return;
   }

   if (typeof spawnInfo.spawnValidationFunction !== "undefined" && !spawnInfo.spawnValidationFunction(spawnOrigin)) {
      return;
   }

   // @Incomplete @Cleanup: Make all cows spawn with the same type,
   // and make fish spawn with the same colour
   
   // const cowSpecies = randInt(0, 1);
   
   const entityClass = ENTITY_CLASS_RECORD[spawnInfo.entityType]();
   
   const entity = new entityClass(spawnOrigin, true);
   addEntityToCensus(entity);

   if (typeof spawnInfo.packSpawningInfo === "undefined") {
      return;
   }

   // Pack spawning
 
   const minX = Math.max(spawnOrigin.x - spawnInfo.packSpawningInfo.spawnRange, 0);
   const maxX = Math.min(spawnOrigin.x + spawnInfo.packSpawningInfo.spawnRange, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);
   const minY = Math.max(spawnOrigin.y - spawnInfo.packSpawningInfo.spawnRange, 0);
   const maxY = Math.min(spawnOrigin.y + spawnInfo.packSpawningInfo.spawnRange, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);

   let totalSpawnAttempts = 0;

   let spawnCount: number;
   if (typeof spawnInfo.packSpawningInfo.size === "number") {
      spawnCount = spawnInfo.packSpawningInfo.size;
   } else {
      if (OPTIONS.inBenchmarkMode) {
         spawnCount = SRandom.randInt(spawnInfo.packSpawningInfo.size[0], spawnInfo.packSpawningInfo.size[1]);
      } else {
         spawnCount = randInt(spawnInfo.packSpawningInfo.size[0], spawnInfo.packSpawningInfo.size[1]);
      }
   }
   for (let i = 0; i < spawnCount - 1;) {
      // @Speed: Garbage collection, and doing a whole bunch of unnecessary continues here
      
      // Generate a spawn position near the spawn origin
      const spawnPosition = new Point(randInt(minX, maxX), randInt(minY, maxY));

      const tile = Board.getTile(Math.floor(spawnPosition.x / SETTINGS.TILE_SIZE), Math.floor(spawnPosition.y / SETTINGS.TILE_SIZE));
      if (!spawnInfo.spawnableTiles.includes(tile.type)) {
         continue;
      }

      if (spawnPositionIsValid(spawnPosition)) {
         const entity = new entityClass(spawnPosition, true);
         addEntityToCensus(entity);
         i++;
      }

      if (++totalSpawnAttempts === 99) {
         break;
      }
   }
}

export function spawnPositionIsValid(position: Point): boolean {
   const minChunkX = Math.max(Math.min(Math.floor((position.x - MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor((position.x + MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor((position.y - MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor((position.y + MIN_SPAWN_DISTANCE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

   const checkedEntities = new Set<Entity>();
   
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.entities) {
            if (checkedEntities.has(entity)) continue;
            
            const distance = position.calculateDistanceBetween(entity.position);
            if (distance <= MIN_SPAWN_DISTANCE) {
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
      // @Speed: Garbage collection
      const spawnPosition = new Point(x, y);

      spawnEntities(spawnInfo, spawnPosition);
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