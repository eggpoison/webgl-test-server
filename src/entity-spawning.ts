import { CowSpecies, EntityInfoClientArgs, EntityType, ENTITY_INFO_RECORD, Point, randInt, randItem, SETTINGS } from "webgl-test-shared";
import ENTITY_SPAWN_INFO_RECORD, { EntitySpawnInfo } from "./data/entity-spawn-data";
import { MobType } from "./entities/Mob";
import ENTITY_CLASS_RECORD from "./entity-class-record";
import { SERVER } from "./server";
import { getTilesByBiome } from "./terrain-generation/terrain-generation";

// Expected number of times that a spawn attempt will occur in a second
const PASSIVE_MOB_SPAWN_ATTEMPT_CHANCE = 0.3;
const HOSTILE_MOB_SPAWN_ATTEMPT_CHANCE = 0.3;

// Mob rate of spawn. 0 = no spawns, 1 = maximum spawn rate
const PASSIVE_MOB_SPAWN_RATE = 0.3;
const HOSTILE_MOB_SPAWN_RATE = 0.3;

// Maximum number of mobs that can be in existence. Accounts for entity "density"
const PASSIVE_MOB_CAP = 0.0001 * SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE * SETTINGS.TILE_SIZE * SETTINGS.TILE_SIZE;
const HOSTILE_MOB_CAP = 0.00015 * SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE * SETTINGS.TILE_SIZE * SETTINGS.TILE_SIZE;

let passiveMobCount: number = 0;
let hostileMobCount: number = 0;

const ENTITY_CLASS_PARAMS_RECORD: Partial<{ [T in EntityType]: () => Parameters<EntityInfoClientArgs[T]> }> = {
   cow: (): [species: CowSpecies] => {
      const species: CowSpecies = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;
      return [species];
   },
   zombie: (): [zombieType: number] => {
      const zombieType = Math.floor(Math.random() * 3);
      return [zombieType];
   }
}

let passiveSpawnableMobTypes = new Array<MobType>();
let hostileSpawnableMobTypes = new Array<MobType>();

/** Organises the spawn data into a more usable form to improve performance (realistically this won't affect performance in the slightest but it feels like a sin not to) */
export function precomputeSpawnData(): void {
   // Precompute spawnable mob types
   for (const entityType of Object.keys(ENTITY_SPAWN_INFO_RECORD) as ReadonlyArray<EntityType>) {
      const entityInfo = ENTITY_INFO_RECORD[entityType];
      if (entityInfo.category === "mob") {
         switch (entityInfo.behaviour) {
            case "passive": {
               passiveSpawnableMobTypes.push(entityType as MobType);
               break;
            }
            case "hostile": {
               hostileSpawnableMobTypes.push(entityType as MobType);
               break;
            }
         }
      }
   }

   // Precompute spawn locations
   const entries = Object.entries(ENTITY_SPAWN_INFO_RECORD) as ReadonlyArray<[EntityType, EntitySpawnInfo]>;
   for (const [entityType, spawnInfo] of entries) {
      for (const biome of spawnInfo.spawnableBiomes) {
         const spawnableTiles = getTilesByBiome(biome);
         for (const tileCoords of spawnableTiles) {
            ENTITY_SPAWN_INFO_RECORD[entityType]!.spawnableTiles.push(tileCoords);   
         }
      }
   }
}

const getWeightedRandomMobType = (mobTypes: ReadonlyArray<MobType>): EntityType => {
   let totalWeight = 0;
   for (const entityType of mobTypes) {
      const spawnInfo = ENTITY_SPAWN_INFO_RECORD[entityType]!;
      totalWeight += spawnInfo.weight;
   }

   const selectedWeight = randInt(1, totalWeight);

   totalWeight = 0;
   let selectedEntityType!: EntityType;
   for (const entityType of mobTypes) {
      const spawnInfo = ENTITY_SPAWN_INFO_RECORD[entityType]!;
      totalWeight += spawnInfo.weight;
      if (selectedWeight <= totalWeight) {
         selectedEntityType = entityType;
         break;
      }
   }

   return selectedEntityType;
}

/** Holds a census to count the total entities and their categories for use in mob spawning */
const holdCensus = (): void => {
   for (const entity of Object.values(SERVER.board.entities)) {
      const entityInfo = ENTITY_INFO_RECORD[entity.type];
      if (entityInfo.category === "mob") {
         switch (entityInfo.behaviour) {
            case "passive": {
               passiveMobCount++;
               break;
            }
            case "hostile": {
               hostileMobCount++;
               break;
            }
         }
      }
   }
}

const calculatePassiveMobSpawnCount = (mobSpawnType: "passive" | "hostile"): number => {
   let mobCount: number;
   let mobCap: number;
   let mobSpawnRate: number;
   switch (mobSpawnType) {
      case "passive": {
         mobCount = passiveMobCount;
         mobCap = PASSIVE_MOB_CAP;
         mobSpawnRate = PASSIVE_MOB_SPAWN_RATE;
         break;
      }
      case "hostile": {
         mobCount = hostileMobCount;
         mobCap = HOSTILE_MOB_CAP;
         mobSpawnRate = HOSTILE_MOB_SPAWN_RATE;
         break;
      }
   }

   const capFullness = mobCount / mobCap;
   const spawnCount = -((capFullness * capFullness - 1) / (1 / mobSpawnRate)) * mobCap;
   return spawnCount;
}

const spawnMobs = (mobSpawnType: "passive" | "hostile"): void => {
   // Calculate mob types able to spawn
   let spawnableMobTypes: Array<MobType>;
   if (mobSpawnType === "passive") {
      spawnableMobTypes = passiveSpawnableMobTypes.slice();
   } else {
      spawnableMobTypes = hostileSpawnableMobTypes.slice();
   }
   for (let idx = spawnableMobTypes.length - 1; idx >= 0; idx--) {
      const mobType = spawnableMobTypes[idx];
      const spawnInfo = ENTITY_SPAWN_INFO_RECORD[mobType]!;
      if (typeof spawnInfo.time !== "undefined") {
         if ((spawnInfo.time === "day" && SERVER.isNight()) || (spawnInfo.time === "night" && !SERVER.isNight())) {
            spawnableMobTypes.splice(idx, 1);
         }
      } 
   }
   if (spawnableMobTypes.length === 0) return;

   let remainingSpawnCount = calculatePassiveMobSpawnCount(mobSpawnType);
   while (remainingSpawnCount > 0) {
      // Choose a random passive mob type to spawn
      const mobType = getWeightedRandomMobType(spawnableMobTypes);
      const spawnInfo = ENTITY_SPAWN_INFO_RECORD[mobType]!;
      
      // Pick a random tile to be the origin
      const originTileCoords = randItem(spawnInfo.spawnableTiles);
      
      const mobClass = ENTITY_CLASS_RECORD[mobType]();
      const classParams = ENTITY_CLASS_PARAMS_RECORD[mobType]!();

      const spawnCount = typeof spawnInfo.packSize === "number" ? spawnInfo.packSize : randInt(...spawnInfo.packSize);
      for (let i = 0; i < spawnCount; i++) {
         // Find a random tile to spawn in
         const xOffset = randInt(-spawnInfo.packSpawnRange, spawnInfo.packSpawnRange);
         const yOffset = randInt(-spawnInfo.packSpawnRange, spawnInfo.packSpawnRange);
         const tileX = Math.min(Math.max(originTileCoords[0] + xOffset, 0), SETTINGS.BOARD_DIMENSIONS - 1);
         const tileY = Math.min(Math.max(originTileCoords[1] + yOffset, 0), SETTINGS.BOARD_DIMENSIONS - 1);

         // Find a random position in that tiles
         const x = (tileX + Math.random()) * SETTINGS.TILE_SIZE;
         const y = (tileY + Math.random()) * SETTINGS.TILE_SIZE;

         // Spawn the mob
         new mobClass(new Point(x, y), ...classParams);
      }

      remainingSpawnCount -= spawnCount;
   }
}

/** Attempts to spawn entities */
export function runSpawnAttempt(): void {
   holdCensus();

   // Passive mob spawning
   if (passiveMobCount < PASSIVE_MOB_CAP && Math.random() < PASSIVE_MOB_SPAWN_ATTEMPT_CHANCE / SETTINGS.TPS) {
      spawnMobs("passive");
   }

   // Hostile mob spawning
   if (hostileMobCount < HOSTILE_MOB_CAP && Math.random() < HOSTILE_MOB_SPAWN_ATTEMPT_CHANCE / SETTINGS.TPS) {
      spawnMobs("hostile");
   }
}