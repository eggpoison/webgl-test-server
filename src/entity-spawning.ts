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

import { BiomeName, ENTITY_INFO_RECORD, EntityType, SETTINGS, Point } from "webgl-test-shared";
import ENTITY_CLASS_RECORD from "./entity-class-record";
import { SERVER } from "./server";
import { getTilesByBiome } from "./terrain-generation";

type EntitySpawnInfo = {
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   spawnableTiles: null | ReadonlyArray<[number, number]>;
}

const ENTITY_SPAWN_INFO_RECORD: Record<number, EntitySpawnInfo> = {
   // Cow
   0: {
      spawnableBiomes: ["grasslands"],
      spawnableTiles: null
   }
};

/** Called once the tiles have been generated */
export function generateEntitySpawnableTiles(): void {
   const entries = Object.entries(ENTITY_SPAWN_INFO_RECORD) as unknown as Array<[number, EntitySpawnInfo]>;
   for (const [id, spawnInfo] of entries) {
      // Populate the spawnable tiles
      let spawnableTiles = new Array<[number, number]>();
      for (const biome of spawnInfo.spawnableBiomes) {
         const biomeSpawnableTiles = getTilesByBiome(biome);
         spawnableTiles = spawnableTiles.concat(biomeSpawnableTiles);
      }

      // Assign it to the spawnableTiles property
      ENTITY_SPAWN_INFO_RECORD[id].spawnableTiles = spawnableTiles;
   }
}

// Categorise all entity info
const ENTITY_TYPE_RECORD: Record<EntityType, Array<number>> = {
   passive: [],
   neutral: [],
   hostile: [],
   resource: []
};
for (const info of ENTITY_INFO_RECORD) {
   ENTITY_TYPE_RECORD[info.type].push(info.id);
}

const getRandomEntityID = (type: EntityType): number => {
   const entityInfos = ENTITY_TYPE_RECORD[type];
   return entityInfos[Math.floor(Math.random() * entityInfos.length)];
}

const PASSIVE_MOB_CAP = SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE * 0.75;

const spawnPassiveMobs = (): void => {
   // The mob to attempt to spawn
   const mobID = getRandomEntityID("passive");

   if (!ENTITY_SPAWN_INFO_RECORD.hasOwnProperty(mobID)) {
      throw new Error(`No entity spawn info for mob with ID ${mobID}`);
   }

   // Get info about the entity
   const spawnInfo = ENTITY_SPAWN_INFO_RECORD[mobID];
   const mobClass = ENTITY_CLASS_RECORD[mobID]();

   const eligibleTiles = spawnInfo.spawnableTiles!.slice();

   const spawnPositions = new Array<[number, number]>();

   const passiveMobCount = PASSIVE_MOB_CAP * 0.9;
   const capFullness = passiveMobCount / PASSIVE_MOB_CAP;
   const spawnCount = (-capFullness * capFullness + 1) / 2.5 * PASSIVE_MOB_CAP;
   for (let i = 0; i < spawnCount; i++) {
      const idx = Math.floor(Math.random() * eligibleTiles.length);
      const tileCoords = eligibleTiles[idx];

      // Generate the position from the tile coordinates
      const x = (tileCoords[0] + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (tileCoords[1] + Math.random()) * SETTINGS.TILE_SIZE;

      // Spawn the entity
      const spawnPosition = new Point(x, y);
      const entity = new mobClass(spawnPosition);
      SERVER.addEntity(entity);

      eligibleTiles.splice(idx, 1);
   }
}

export function runSpawnAttempt(): void {
   const PASSIVE_MOB_SPAWN_CHANCE = 0.1;
   if (Math.random() <= PASSIVE_MOB_SPAWN_CHANCE / SETTINGS.TPS) {
      spawnPassiveMobs();
   }
}