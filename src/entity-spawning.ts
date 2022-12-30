import { Point, randInt, randItem, SETTINGS } from "webgl-test-shared";
import SPAWN_INFO_RECORD, { EntitySpawnInfo } from "./data/entity-spawn-data";
import Entity from "./entities/Entity";
import ENTITY_CLASS_RECORD from "./entity-class-record";
import { SERVER } from "./server";
import { LocalBiome, LOCAL_BIOME_RECORD } from "./terrain-generation";

/** Maximum distance a spawn event can occur from another entity */
const MAX_SPAWN_DISTANCE = 100;

const spawnInfoConditionsAreMet = (spawnInfo: EntitySpawnInfo): boolean => {
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

const findAvailableLocalBiomes = (spawnInfo: EntitySpawnInfo): Set<LocalBiome> | null => {
   const availableLocalBiomes = new Set<LocalBiome>();

   for (const biomeName of spawnInfo.spawnableBiomes) {
      if (!LOCAL_BIOME_RECORD.hasOwnProperty(biomeName)) continue;
      
      for (const localBiome of LOCAL_BIOME_RECORD[biomeName]!) {
         let entityCount: number;
         if (!localBiome.entityCounts.hasOwnProperty(spawnInfo.entityType)) {
            entityCount = 0;
         } else {
            entityCount = localBiome.entityCounts[spawnInfo.entityType]!;
         }

         const localBiomeDensity = entityCount / localBiome.tiles.size;
         if (localBiomeDensity < spawnInfo.maxLocalBiomeDensity!) {
            availableLocalBiomes.add(localBiome);
         }
      }
   }

   if (availableLocalBiomes.size === 0) return null;
   return availableLocalBiomes;
}

const spawnEntities = (spawnInfo: EntitySpawnInfo, spawnOrigin: Point): void => {
   const entityClass = ENTITY_CLASS_RECORD[spawnInfo.entityType]();
   
   new entityClass(spawnOrigin);

   if (typeof spawnInfo.packSpawningInfo === "undefined") {
      return;
   }

   // 
   // Pack spawning
   // 
   const minX = Math.max(spawnOrigin.x - spawnInfo.packSpawningInfo.spawnRange, 0);
   const maxX = Math.min(spawnOrigin.x + spawnInfo.packSpawningInfo.spawnRange, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);
   const minY = Math.max(spawnOrigin.y - spawnInfo.packSpawningInfo.spawnRange, 0);
   const maxY = Math.min(spawnOrigin.y + spawnInfo.packSpawningInfo.spawnRange, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);

   const spawnCount = typeof spawnInfo.packSpawningInfo.size === "number" ? spawnInfo.packSpawningInfo.size : randInt(...spawnInfo.packSpawningInfo.size);
   for (let i = 0; i < spawnCount - 1; i++) {
      // Generate a spawn position near the spawn origin
      const spawnPosition = new Point(randInt(minX, maxX), randInt(minY, maxY));

      new entityClass(spawnPosition);
   }
}

const chooseRandomLocalBiome = (localBiomes: ReadonlySet<LocalBiome>): LocalBiome => {
   let totalWeight = 0;
   for (const localBiome of localBiomes) {
      totalWeight += localBiome.tiles.size;
   }

   const targetWeight = randInt(1, totalWeight);

   let currentWeight = 0;
   for (const localBiome of localBiomes) {
      currentWeight += localBiome.tiles.size;
      if (currentWeight >= targetWeight) {
         return localBiome;
      }
   }

   throw new Error("Unable to find a local biome!");
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
            if (distance > MAX_SPAWN_DISTANCE) {
               return false;
            }

            checkedEntities.add(entity);
         }
      }  
   }

   return true;
}

const runSpawnEvent = (spawnInfo: EntitySpawnInfo, localBiome: LocalBiome): void => {
   if (!spawnInfoConditionsAreMet(spawnInfo)) return;

   // Pick a random tile in the local biome to spawn at
   const [spawnTileX, spawnTileY] = randItem(Array.from(localBiome.tiles));

   // Calculate a random position in that tile to run the spawn at
   const x = (spawnTileX + Math.random()) * SETTINGS.TILE_SIZE;
   const y = (spawnTileY + Math.random()) * SETTINGS.TILE_SIZE;
   const spawnPosition = new Point(x, y);


   if (spawnPositionIsValid(spawnPosition)) {
      spawnEntities(spawnInfo, spawnPosition);
   }
}

let bigGrassBiome!: LocalBiome;

export function runSpawnAttempt(): void {
   console.log(bigGrassBiome.entityCounts.tombstone);
   
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      if (Math.random() < spawnInfo.spawnRate / SETTINGS.TPS) {
         const availableLocalBiomes = findAvailableLocalBiomes(spawnInfo);
         if (availableLocalBiomes === null) continue;

         const localBiome = chooseRandomLocalBiome(availableLocalBiomes);
         runSpawnEvent(spawnInfo, localBiome);
      }
   }
}

export function spawnInitialEntities(): void {
   let numSpawnAttempts = 0;
   // For each spawn info object, spawn entities until no more can be spawned
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      while (spawnInfoConditionsAreMet(spawnInfo)) {
         const localBiomes = findAvailableLocalBiomes(spawnInfo);
         if (localBiomes === null) {
            break;
         }

         const localBiome = chooseRandomLocalBiome(localBiomes);

         runSpawnEvent(spawnInfo, localBiome);

         if (++numSpawnAttempts >= 999) {
            console.log(spawnInfo);
            throw new Error("we may have an infinite loop on our hands...");
         }
      }
   }

   for (const biome of LOCAL_BIOME_RECORD.grasslands!) {
      if (typeof bigGrassBiome === "undefined") {
         bigGrassBiome = biome;
      } else if (biome.tiles.size > bigGrassBiome.tiles.size) {
         bigGrassBiome = biome;
      }
   }
}