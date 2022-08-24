/*

PASSIVE MOB SPAWNING:

Goals:
- Passive mobs should be fairly scarce, max count based on the number of chunks

Every tick has a random chance to run a spawn attempt for a random passive mob type

When a spawn attempt occurs, various random tiles will be picked throughout the map.
Each eligible tile has a small chance to run a spawn

SPAWN PACKET:
- Spawn positions: Array of positions [int, int][]
- Entity type: int

*/

import { BiomeName, ENTITY_INFO_RECORD, SETTINGS, Point, EntityBehaviour, EntityInfo, EntityType } from "webgl-test-shared";
import ENTITY_CLASS_RECORD from "./entity-class-record";
import { SERVER } from "./server";
import { getTilesByBiome } from "./terrain-generation";

type EntitySpawnInfo = {
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   spawnableTiles: null | ReadonlyArray<[number, number]>;
}

const ENTITY_SPAWN_INFO_RECORD: Partial<Record<EntityType, EntitySpawnInfo>> = {
   cow: {
      spawnableBiomes: ["grasslands"],
      spawnableTiles: null
   }
};

/** Called once the tiles have been generated */
export function generateEntitySpawnableTiles(): void {
   for (const [type, spawnInfo] of Object.entries(ENTITY_SPAWN_INFO_RECORD) as Array<[EntityType, EntitySpawnInfo]>) {
      // Populate the spawnable tiles
      let spawnableTiles = new Array<[number, number]>();
      for (const biome of spawnInfo.spawnableBiomes) {
         const biomeSpawnableTiles = getTilesByBiome(biome);
         spawnableTiles = spawnableTiles.concat(biomeSpawnableTiles);
      }

      // Assign it to the spawnableTiles property
      ENTITY_SPAWN_INFO_RECORD[type]!.spawnableTiles = spawnableTiles;
   }
}

// Categorise all entity info
const ENTITY_BEHAVIOUR_RECORD: Record<EntityBehaviour, Array<EntityType>> = {
   passive: [],
   neutral: [],
   hostile: []
};
for (const [type, info] of Object.entries(ENTITY_INFO_RECORD) as Array<[EntityType, EntityInfo]>) {
   if (info.category === "mob") {
      ENTITY_BEHAVIOUR_RECORD[info.behaviour].push(type);
   }
}

const getRandomEntityType = (behaviour: EntityBehaviour): EntityType => {
   const entityInfos = ENTITY_BEHAVIOUR_RECORD[behaviour];
   return entityInfos[Math.floor(Math.random() * entityInfos.length)];
}

const PASSIVE_MOB_CAP = SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE * 0.75;

const calculatePassiveMobSpawnCount = (): number => {
   const passiveMobCount = PASSIVE_MOB_CAP * 0.9;
   const capFullness = passiveMobCount / PASSIVE_MOB_CAP;
   const spawnCount = (-capFullness * capFullness + 1) / 2.5 * PASSIVE_MOB_CAP;
   return spawnCount;
}

const spawnPassiveMobs = (): void => {
   // The mob to attempt to spawn
   const mobType = getRandomEntityType("passive");

   if (!ENTITY_SPAWN_INFO_RECORD.hasOwnProperty(mobType)) {
      throw new Error(`No entity spawn info for mob with ID ${mobType}`);
   }

   // Get info about the entity
   const spawnInfo = ENTITY_SPAWN_INFO_RECORD[mobType]!;
   const mobClass = ENTITY_CLASS_RECORD[mobType]();

   const eligibleTiles = spawnInfo.spawnableTiles!.slice();

   const spawnCount = calculatePassiveMobSpawnCount();
   for (let i = 0; i < spawnCount; i++) {
      const idx = Math.floor(Math.random() * eligibleTiles.length);
      const tileCoords = eligibleTiles[idx];

      // Generate the position from the tile coordinates
      const x = (tileCoords[0] + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (tileCoords[1] + Math.random()) * SETTINGS.TILE_SIZE;

      // Spawn the entity
      const spawnPosition = new Point(x, y);
      const entity = new mobClass(spawnPosition);
      SERVER.board.addEntity(entity);

      eligibleTiles.splice(idx, 1);
   }
}

export function runSpawnAttempt(): void {
   const PASSIVE_MOB_SPAWN_CHANCE = 0.1;
   if (Math.random() <= PASSIVE_MOB_SPAWN_CHANCE / SETTINGS.TPS) {
      spawnPassiveMobs();
   }
}