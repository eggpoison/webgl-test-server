import { EntityType, Point, randInt, SETTINGS, TileType } from "webgl-test-shared";
import Cow from "./entities/mobs/Cow";
import Entity from "./entities/Entity";
import ENTITY_CLASS_RECORD from "./entity-classes";
import { SERVER } from "./server";

export type EntitySpawnInfo = {
   /** The type of entity to spawn */
   readonly entityType: EntityType;
   /** Array of all tile types in which the entity is able to be spawned in */
   readonly spawnableTiles: ReadonlyArray<TileType>;
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
}

const SPAWN_INFO_RECORD: ReadonlyArray<EntitySpawnInfo> = [
   {
      entityType: "cow",
      spawnableTiles: ["grass"],
      spawnRate: 0.01,
      maxDensity: 0.01,
      packSpawningInfo: {
         size: [2, 5],
         spawnRange: 200
      }
   },
   {
      entityType: "berry_bush",
      spawnableTiles: ["grass"],
      spawnRate: 0.001,
      maxDensity: 0.003
   },
   {
      entityType: "tree",
      spawnableTiles: ["grass"],
      spawnRate: 0.01,
      maxDensity: 0.015
   },
   {
      entityType: "tombstone",
      spawnableTiles: ["grass"],
      spawnRate: 0.01,
      maxDensity: 0.003,
      spawnTimeRanges: [[0, 3], [19, 24]] // 7pm to 3am
   },
   {
      entityType: "boulder",
      spawnableTiles: ["rock"],
      spawnRate: 0.005,
      maxDensity: 0.025
   },
   {
      entityType: "cactus",
      spawnableTiles: ["sand"],
      spawnRate: 0.005,
      maxDensity: 0.03
   }
];

const entityTypeCounts: Partial<Record<EntityType, number>> = {};

const tileTypeCounts: Partial<Record<TileType, number>> = {};

export function addEntityToCensus(entityType: EntityType): void {
   if (!entityTypeCounts.hasOwnProperty(entityType)) {
      entityTypeCounts[entityType] = 1;
   } else {
      entityTypeCounts[entityType]!++;
   }
}

export function removeEntityFromCensus(entityType: EntityType): void {
   if (!entityTypeCounts.hasOwnProperty(entityType)) {
      console.log(entityType);
      console.warn(`Entity type "${entityType}" is not in the census.`);
      console.trace();
   }

   entityTypeCounts[entityType]!--;
   if (entityTypeCounts[entityType]! === 0) {
      delete entityTypeCounts[entityType];
   }
}

export function addTileToCensus(tileType: TileType): void {
   if (!tileTypeCounts.hasOwnProperty(tileType)) {
      tileTypeCounts[tileType] = 1;
   } else {
      tileTypeCounts[tileType]!++;
   }
}

export function removeTileFromCensus(tileType: TileType): void {
   if (!tileTypeCounts.hasOwnProperty(tileType)) {
      throw new Error("Tile type is not in the census.")
   }

   tileTypeCounts[tileType]!--;
   if (tileTypeCounts[tileType]! === 0) {
      delete tileTypeCounts[tileType];
   }
}

const getTileTypeCount = (tileType: TileType): number => {
   if (!tileTypeCounts.hasOwnProperty(tileType)) {
      return 0;
   }

   return tileTypeCounts[tileType]!;
}

/** Maximum distance a spawn event can occur from another entity */
const MAX_SPAWN_DISTANCE = 100;

const spawnConditionsAreMet = (spawnInfo: EntitySpawnInfo): boolean => {
   // Check if the entity density is right

   let numEligibleTiles = 0;
   for (const tileType of spawnInfo.spawnableTiles) {
      numEligibleTiles += getTileTypeCount(tileType);
   }

   // If there are no tiles upon which the entity is able to be spawned, the spawn conditions aren't valid
   if (numEligibleTiles === 0) return false;

   if (!entityTypeCounts.hasOwnProperty(spawnInfo.entityType)) {
      entityTypeCounts[spawnInfo.entityType] = 0;
   }

   const density = entityTypeCounts[spawnInfo.entityType]! / numEligibleTiles;
   if (density > spawnInfo.maxDensity) {
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

const spawnEntities = (spawnInfo: EntitySpawnInfo, spawnOrigin: Point): void => {
   if (!spawnPositionIsValid(spawnOrigin)) return;

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

const runSpawnEvent = (spawnInfo: EntitySpawnInfo): void => {
   // Pick a random tile to spawn at
   const tileX = randInt(0, SETTINGS.BOARD_SIZE * SETTINGS.CHUNK_SIZE - 1);
   const tileY = randInt(0, SETTINGS.BOARD_SIZE * SETTINGS.CHUNK_SIZE - 1);
   const tile = SERVER.board.getTile(tileX, tileY);

   // If the tile is a valid tile for the spawn info, continue with the spawn event
   if (spawnInfo.spawnableTiles.includes(tile.type)) {
      // Calculate a random position in that tile to run the spawn at
      const x = (tileX + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (tileY + Math.random()) * SETTINGS.TILE_SIZE;
      const spawnPosition = new Point(x, y);
   
      spawnEntities(spawnInfo, spawnPosition);
   }
}

export function runSpawnAttempt(): void {
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      if (spawnConditionsAreMet(spawnInfo)) {
         for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
            for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
               if (Math.random() < spawnInfo.spawnRate / SETTINGS.TPS) {
                  runSpawnEvent(spawnInfo);
               }
            }
         }
      }
   }
}

export function spawnInitialEntities(): void {
   let numSpawnAttempts = 0;

   // For each spawn info object, spawn entities until no more can be spawned
   for (const spawnInfo of SPAWN_INFO_RECORD) {
      while (spawnConditionsAreMet(spawnInfo)) {
         runSpawnEvent(spawnInfo);

         if (++numSpawnAttempts >= 9999) {
            console.log(spawnInfo);
            throw new Error("we may have an infinite loop on our hands...");
         }
      }
   }
}

export function runEntityCensus(): void {
   for (const key of Object.keys(entityTypeCounts) as ReadonlyArray<EntityType>) {
      delete entityTypeCounts[key];
   }
   
   for (const entity of Object.values(SERVER.board.entities)) {
      addEntityToCensus(entity.type);
   }
}