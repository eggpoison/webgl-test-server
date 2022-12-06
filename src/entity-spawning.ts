import { EntityType, Point, randFloat, randInt, randItem, SETTINGS } from "webgl-test-shared";
import { TOMBSTONE_SPAWN_INFO_RECORD, EntitySpawnInfo, HOSTILE_MOB_SPAWN_INFO_RECORD, PASSIVE_MOB_SPAWN_INFO_RECORD, RESOURCE_SPAWN_INFO_RECORD, SpawnInfoRecord } from "./data/entity-spawn-data";
import ENTITY_CLASS_RECORD from "./entity-class-record";
import { SERVER } from "./server";
import { getTilesByBiome } from "./terrain-generation/terrain-generation";

/*
Goals of the spawning system:
- Keep entities and resources at a specific 'density' (not too many or too little entities per area in space)
- No abrupt spawning - when an entity dies it shouldn't be immediately replaced
- Passive mobs have to be rarer than hostile mobs
- Flexible system to easily allow for changes to spawn criteria or new entities being spawned

Passive mobs being rare than hostile mobs is achieved by having passive mobs less likely to be spawned than hostile mobs in an entity spawn attempt
*/

type SpawnerObjectInfo = {
   readonly spawnInfoRecord: SpawnInfoRecord;
   /** The average number of times that a spawn attempt will succeed in a second */
   readonly spawnAttemptSuccessRate: number;
   /** The target density of its entity types in the world (number of entities that should be present per chunk) */
   readonly targetWorldEntityDensity?: number;
}

class SpawnerObject {
   private readonly spawnInfoRecord: SpawnInfoRecord;
   private readonly spawnAttemptSuccessRate: number;
   private readonly targetWorldEntityDensity: number | null;

   /** Current amount of entities that the spawner is able to spawn */
   private currentEntityCount: number = 0;
   /** Maximum number of entities, based on the target world entity density */
   private readonly entityCap: number | null = null;

   private readonly countedEntityTypes: ReadonlySet<EntityType>;

   constructor({ spawnInfoRecord, spawnAttemptSuccessRate, targetWorldEntityDensity }: SpawnerObjectInfo) {
      this.spawnInfoRecord = spawnInfoRecord;
      this.spawnAttemptSuccessRate = spawnAttemptSuccessRate;

      if (typeof targetWorldEntityDensity !== "undefined") {
         this.targetWorldEntityDensity = targetWorldEntityDensity;
         this.entityCap = targetWorldEntityDensity * SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE;
      } else {
         this.targetWorldEntityDensity = null;
      }

      // Get the counted entity types
      const countedEntityTypes = new Set<EntityType>();
      for (const entityType of Object.keys(spawnInfoRecord) as ReadonlyArray<EntityType>) {
         countedEntityTypes.add(entityType);
      }
      this.countedEntityTypes = countedEntityTypes;
   }

   public updateEntityCount(entityTypeCounts: Partial<{ [T in EntityType]: number }>): void {
      this.currentEntityCount = 0;
      for (const [entityType, count] of Object.entries(entityTypeCounts) as ReadonlyArray<[EntityType, number]>) {
         if (this.countedEntityTypes.has(entityType)) {
            this.currentEntityCount += count;
         }
      }
   }

   public runSpawnAttempt(): void {
      // If there is a world entity density limit, make sure it is accounted for
      if (this.targetWorldEntityDensity !== null) {
         const entityDensity = this.currentEntityCount / SETTINGS.BOARD_SIZE / SETTINGS.BOARD_SIZE;
         if (entityDensity > this.targetWorldEntityDensity) {
            return;
         }
      }

      // Make sure entity cap isn't exceeded
      if (!(this.entityCap === null || this.currentEntityCount < this.entityCap)) {
         return;
      }

      if (Math.random() < this.spawnAttemptSuccessRate / SETTINGS.TPS) {
         this.spawnEntities();
      }
   }

   protected spawnEntities(): void {
      // Find which entity types are able to be spawned
      let spawnableEntityTypes = new Set<EntityType>();
      for (const [entityType, spawnInfo] of Object.entries(this.spawnInfoRecord) as ReadonlyArray<[EntityType, EntitySpawnInfo]>) {

         if (this.entityTypeCanBeSpawned(entityType)) {
            spawnableEntityTypes.add(entityType);
         }
      }

      // Don't spawn anything if there's nothing to spawn
      if (spawnableEntityTypes.size === 0) {
         return;
      }

      // Pick a (weighted) random entity type based on those available to spawn
      const entityTypeToSpawn = this.getWeightedRandomEntityType(spawnableEntityTypes);

      this.spawnEntity(entityTypeToSpawn);
   }

   /** Picks a random entity type based off their weights */
   private getWeightedRandomEntityType(entityTypes: ReadonlySet<EntityType>): EntityType {
      let totalWeight = 0;
      for (const entityType of entityTypes) {
         const spawnInfo = this.spawnInfoRecord[entityType]!;
         totalWeight += spawnInfo.weight;
      }
   
      const selectedWeight = randInt(1, totalWeight);
   
      totalWeight = 0;
      let selectedEntityType!: EntityType;
      for (const entityType of entityTypes) {
         const spawnInfo = this.spawnInfoRecord[entityType]!;
         totalWeight += spawnInfo.weight;
         if (selectedWeight <= totalWeight) {
            selectedEntityType = entityType;
            break;
         }
      }
   
      return selectedEntityType;
   }

   /**
    * Spawns a given entity type in a random position
    * @returns The number of entities spawned
    */
   private spawnEntity(entityType: EntityType): number {
      const spawnInfo = this.spawnInfoRecord[entityType]!;

      // Pick a random location to spawn the entity at
      const tileSpawnLocation = randItem(spawnInfo.spawnableTiles);
      const originSpawnPosition = new Point((tileSpawnLocation[0] + 0.5) * SETTINGS.TILE_SIZE, (tileSpawnLocation[1] + 0.5) * SETTINGS.TILE_SIZE);

      let packAmount = 1;

      if (typeof spawnInfo.packSpawningInfo === "undefined") {
         const entityClass = ENTITY_CLASS_RECORD[entityType]();
         new entityClass(originSpawnPosition);
      } else {
         packAmount = typeof spawnInfo.packSpawningInfo.size === "number" ? spawnInfo.packSpawningInfo.size : randInt(...spawnInfo.packSpawningInfo.size);
         
         // Generate spawn positions
         const spawnPositions = new Set<Point>();

         // The origin spawn position is always a spawn position
         spawnPositions.add(originSpawnPosition);

         while (spawnPositions.size < packAmount) {
            const xOffset = spawnInfo.packSpawningInfo.spawnRange * SETTINGS.TILE_SIZE * randFloat(-1, 1);
            const yOffset = spawnInfo.packSpawningInfo.spawnRange * SETTINGS.TILE_SIZE * randFloat(-1, 1);
            const testPosition = originSpawnPosition.add(new Point(xOffset, yOffset));

            // If the position is valid, add it to the spawn positions
            if (testPosition.x >= 0 && testPosition.x <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE && testPosition.y >= 0 && testPosition.y <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) {
               spawnPositions.add(testPosition);
            }
         }

         // Spawn the entities
         const entityClass = ENTITY_CLASS_RECORD[entityType]();
         for (const spawnPosition of spawnPositions) {
            new entityClass(spawnPosition);
         }
      }

      return packAmount;
   }

   public spawnInitialEntities(): void {
      let spawnableEntityTypes = new Set<EntityType>();

      for (const entityType of Object.keys(this.spawnInfoRecord) as ReadonlyArray<EntityType>) {
         if (this.entityTypeCanBeSpawned(entityType)) {
            spawnableEntityTypes.add(entityType);
         }
      }

      const MAX_SPAWN_ATTEMPTS = 500;
      let spawnAttempts = 0;

      let spawnCount = 0;
      while (spawnableEntityTypes.size > 0 && (this.entityCap === null || spawnCount < this.entityCap)) {
         const entityTypeToSpawn = this.getWeightedRandomEntityType(spawnableEntityTypes);

         spawnCount += this.spawnEntity(entityTypeToSpawn);

         // Check if the entity type can't be spawned anymore
         if (!this.entityTypeCanBeSpawned(entityTypeToSpawn)) {
            spawnableEntityTypes.delete(entityTypeToSpawn);
         }
         
         if (++spawnAttempts >= MAX_SPAWN_ATTEMPTS) {
            throw new Error("we may have an infinite loop on our hands");
         }
      }
   }

   private entityTypeCanBeSpawned(entityType: EntityType): boolean {
      const spawnInfo = this.spawnInfoRecord[entityType]!;
      
      if (typeof spawnInfo.time !== "undefined") {
         if ((spawnInfo.time === "day" && SERVER.isNight()) || (spawnInfo.time === "night" && !SERVER.isNight())) {
            return false;
         }
      }

      return true;
   }
}

const spawners = new Set<SpawnerObject>();
// Passive mob spawner
spawners.add(new SpawnerObject({
   spawnInfoRecord: PASSIVE_MOB_SPAWN_INFO_RECORD,
   spawnAttemptSuccessRate: 0.3,
   targetWorldEntityDensity: 0.5
}));
// Hostile mob spawner
spawners.add(new SpawnerObject({
   spawnInfoRecord: HOSTILE_MOB_SPAWN_INFO_RECORD,
   spawnAttemptSuccessRate: 0.3,
   targetWorldEntityDensity: 1
}));
// Resource spawner
spawners.add(new SpawnerObject({
   spawnInfoRecord: RESOURCE_SPAWN_INFO_RECORD,
   spawnAttemptSuccessRate: 0.3
}));
// Tombstone spawner
spawners.add(new SpawnerObject({
   spawnInfoRecord: TOMBSTONE_SPAWN_INFO_RECORD,
   spawnAttemptSuccessRate: 0.1,
   targetWorldEntityDensity: 0.2
}));

/** Spawns initial entities until no more can be spawned */
export function spawnInitialEntities(): void {
   for (const spawner of spawners) {
      spawner.spawnInitialEntities();
   }
}

/** Attempts to spawn entities */
export function runSpawnAttempt(): void {
   // Count the amounts of each entity type
   const entityTypeCounts: Partial<{ [T in EntityType]: number }> = {};
   const countedMobIDs = new Set<number>();
   for (const entity of Object.values(SERVER.board.entities)) {
      // If the entity has already been accounted for, skip it
      if (countedMobIDs.has(entity.id)) continue;

      // If the entity type hasn't been counted yet, add it to the record
      if (!entityTypeCounts.hasOwnProperty(entity.type)) {
         entityTypeCounts[entity.type] = 1;
      } else {
         // Otherwise add to the existing count
         entityTypeCounts[entity.type]!++;
      }

      countedMobIDs.add(entity.id);
   }

   for (const spawner of spawners) {
      // Send the new entity counts to the spawner
      spawner.updateEntityCount(entityTypeCounts);
      // Run spawn attempt
      spawner.runSpawnAttempt();
   }
}

const precomputeSpawnInfoRecordSpawnLocations = (spawnInfoRecord: SpawnInfoRecord): void => {
   const entries = Object.entries(spawnInfoRecord) as ReadonlyArray<[EntityType, EntitySpawnInfo]>;
   for (const [entityType, spawnInfo] of entries) {
      for (const biome of spawnInfo.spawnableBiomes) {
         const spawnableTiles = getTilesByBiome(biome);
         for (const tileCoords of spawnableTiles) {
            spawnInfoRecord[entityType]!.spawnableTiles.push(tileCoords);   
         }
      }
   }
}

/** Precomputes the potential spawn locations of different entity types to improve performance (realistically this won't affect performance in the slightest but it feels like a sin not to) */
export function precomputeSpawnLocations(): void {
   precomputeSpawnInfoRecordSpawnLocations(PASSIVE_MOB_SPAWN_INFO_RECORD);
   precomputeSpawnInfoRecordSpawnLocations(HOSTILE_MOB_SPAWN_INFO_RECORD);
   precomputeSpawnInfoRecordSpawnLocations(RESOURCE_SPAWN_INFO_RECORD);
   precomputeSpawnInfoRecordSpawnLocations(TOMBSTONE_SPAWN_INFO_RECORD);
}