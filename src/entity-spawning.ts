import { BiomeName, Point, randInt, randItem, SETTINGS } from "webgl-test-shared";
import SPAWN_INFO_RECORD, { EntitySpawnInfo } from "./data/entity-spawn-data";
import Cow from "./entities/Cow";
import Entity from "./entities/Entity";
import ENTITY_CLASS_RECORD from "./entity-class-record";
import { SERVER } from "./server";
import { LocalBiome, LOCAL_BIOME_RECORD } from "./terrain-generation";

/** Maximum distance a spawn event can occur from another entity */
const MAX_SPAWN_DISTANCE = 100;

const spawnInfoConditionsAreMet = (spawnInfo: EntitySpawnInfo, localBiome: LocalBiome): boolean => {
   // Check if the entity density is right
   let entityCount: number;
   if (!localBiome.entityCounts.hasOwnProperty(spawnInfo.entityType)) {
      entityCount = 0;
   } else {
      entityCount = localBiome.entityCounts[spawnInfo.entityType]!;
   }

   const localBiomeDensity = entityCount / localBiome.tileCoordinates.size;
   if (localBiomeDensity >= spawnInfo.maxLocalBiomeDensity!) {
      return false;
   }

   // Check time ranges are valid
   if (typeof spawnInfo.spawnTimeRanges !== "undefined") {
      let spawnTimeIsValid = false;
      for (const [minSpawnTime, maxSpawnTime] of spawnInfo.spawnTimeRanges) {
         if (SERVER.time >= minSpawnTime && SERVER.time <= maxSpawnTime) {
            spawnTimeIsValid = true;
            break;
         }
      }
      if (!spawnTimeIsValid) return false;
   }
   
   return true;
}

const findLocalBiomes = (biomeNames: ReadonlyArray<BiomeName>): Set<LocalBiome> => {
   const localBiomes = new Set<LocalBiome>();

   for (const biomeName of biomeNames) {
      if (!LOCAL_BIOME_RECORD.hasOwnProperty(biomeName)) continue;
      
      for (const localBiome of LOCAL_BIOME_RECORD[biomeName]!) {
         localBiomes.add(localBiome);
      }
   }

   return localBiomes;
}

const spawnEntities = (spawnInfo: EntitySpawnInfo, spawnOrigin: Point): void => {
   const cowSpecies = randInt(0, 1);
   
   const entityClass = ENTITY_CLASS_RECORD[spawnInfo.entityType]();
   
   const baseEntity = new entityClass(spawnOrigin);
   if (spawnInfo.entityType === "cow") {
      (baseEntity as Cow).species = cowSpecies;
   }

   if (typeof spawnInfo.packSpawningInfo === "undefined") {
      return;
   }

   // Pack spawning
 
   const minX = Math.max(spawnOrigin.x - spawnInfo.packSpawningInfo.spawnRange, 0);
   const maxX = Math.min(spawnOrigin.x + spawnInfo.packSpawningInfo.spawnRange, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);
   const minY = Math.max(spawnOrigin.y - spawnInfo.packSpawningInfo.spawnRange, 0);
   const maxY = Math.min(spawnOrigin.y + spawnInfo.packSpawningInfo.spawnRange, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);

   let totalSpawnAttempts = 0;

   const spawnCount = typeof spawnInfo.packSpawningInfo.size === "number" ? spawnInfo.packSpawningInfo.size : randInt(...spawnInfo.packSpawningInfo.size);
   for (let i = 0; i < spawnCount - 1;) {
      // Generate a spawn position near the spawn origin
      const spawnPosition = new Point(randInt(minX, maxX), randInt(minY, maxY));

      if (spawnPositionIsValid(spawnPosition)) {
         const entity = new entityClass(spawnPosition);  
         if (spawnInfo.entityType === "cow") {
            (entity as Cow).species = cowSpecies;
         }
         SERVER.board.addEntityFromJoinBuffer(entity);

         i++;
      }

      if (++totalSpawnAttempts === 99) {
         break;
      }
   }
}

const spawnPositionIsValid = (position: Point): boolean => {
   const minChunkX = Math.max(Math.min(Math.floor(position.x - MAX_SPAWN_DISTANCE / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor(position.x + MAX_SPAWN_DISTANCE / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor(position.y - MAX_SPAWN_DISTANCE / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor(position.y + MAX_SPAWN_DISTANCE / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

   const checkedEntities = new Set<Entity>();
   
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = SERVER.board.getChunk(chunkX, chunkY);
         for (const entity of chunk.getEntities()) {
            if (checkedEntities.has(entity)) continue;
            
            const distance = position.calculateDistanceBetween(entity.position);
            if (distance <= MAX_SPAWN_DISTANCE) {
               return false;
            }

            checkedEntities.add(entity);
         }
      }
   }

   return true;
}

const runSpawnEvent = (spawnInfo: EntitySpawnInfo, localBiome: LocalBiome): void => {
   // Pick a random tile in the local biome to spawn at
   const [spawnTileX, spawnTileY] = randItem(Array.from(localBiome.tileCoordinates));

   // Calculate a random position in that tile to run the spawn at
   const x = (spawnTileX + Math.random()) * SETTINGS.TILE_SIZE;
   const y = (spawnTileY + Math.random()) * SETTINGS.TILE_SIZE;
   const spawnPosition = new Point(x, y);

   if (spawnPositionIsValid(spawnPosition)) {
      spawnEntities(spawnInfo, spawnPosition);
   }
}

export function runSpawnAttempt(): void {
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      const localBiomes = findLocalBiomes(spawnInfo.spawnableBiomes);
      for (const localBiome of localBiomes) {
         let spawnChance = spawnInfo.spawnRate * localBiome.tileCoordinates.size / SETTINGS.TPS;
         while (spawnInfoConditionsAreMet(spawnInfo, localBiome) && Math.random() < spawnChance) {
            runSpawnEvent(spawnInfo, localBiome);
            
            spawnChance--;
         }
      }
   }
}

export function spawnInitialEntities(): void {
   let numSpawnAttempts = 0;

   // For each spawn info object, spawn entities until no more can be spawned
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      const localBiomes = findLocalBiomes(spawnInfo.spawnableBiomes);
      for (const localBiome of localBiomes) {
         while (spawnInfoConditionsAreMet(spawnInfo, localBiome)) {
            runSpawnEvent(spawnInfo, localBiome);

            if (++numSpawnAttempts >= 999) {
               console.log(spawnInfo);
               throw new Error("we may have an infinite loop on our hands...");
            }
         }
      }
   }
}

/**
 * Runs a census of all entities to make sure everything is counted correctly
 */
export function runEntityCensus(): void {
   for (const localBiomeSet of Object.values(LOCAL_BIOME_RECORD)) {
      for (const localBiome of localBiomeSet) {
         // Clear the previous local biome count
         localBiome.entityCounts = {};

         // Find all entities on the tile
         for (const [tileX, tileY] of localBiome.tileCoordinates) {
            const chunkX = Math.floor(tileX / SETTINGS.CHUNK_SIZE);
            const chunkY = Math.floor(tileY / SETTINGS.CHUNK_SIZE);

            const chunk = SERVER.board.getChunk(chunkX, chunkY);
            for (const entity of chunk.getEntities()) {
               if (entity.currentTile.x === tileX && entity.currentTile.y === tileY) {
                  // Increment the entity count
                  if (!localBiome.entityCounts.hasOwnProperty(entity.type)) {
                     localBiome.entityCounts[entity.type] = 1;
                  } else {
                     localBiome.entityCounts[entity.type]!++;
                  }
               }
            }
         }
      }
   }
}