/*

PASSIVE MOB SPAWNING:

Goals:
- Passive mobs should be fairly scar ce, max count based on the number of chunks

Every call has a random chance to run a passive mob spawn attempt for a random passive mob type

When a spawn attempt occurs, various random tiles will be picked throughout the map.
Each eligible tile has a small chance to run a spawn

*/

import { ENTITY_INFO_RECORD, SETTINGS, Point, EntityBehaviour, EntityInfo, EntityType, randItem, randInt } from "webgl-test-shared";
import ENTITY_CLASS_RECORD from "../entity-class-record";
import { SERVER } from "../server";
import ENTITY_SPAWN_INFO_RECORD from "./spawn-data";

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

/** Max number of passive mobs that can exist */
const PASSIVE_MOB_CAP = SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE * 1.5;

/** Increase to make mobs spawn faster. 0 = no spawn, 1 = max spawn rate */
const PASSIVE_MOB_SPAWN_RATE = 0.3;

const calculatePassiveMobSpawnCount = (passiveMobCount: number): number => {
   const capFullness = passiveMobCount / PASSIVE_MOB_CAP;
   const spawnCount = -((capFullness * capFullness - 1) / (1 / PASSIVE_MOB_SPAWN_RATE)) * PASSIVE_MOB_CAP;
   return spawnCount;
}

export function spawnPassiveMobs(passiveMobCount: number): void {
   // Don't bother calculating the spawn amount if the amount of passive mobs has surpassed the cap
   if (passiveMobCount >= PASSIVE_MOB_CAP) return;

   let remainingSpawnCount = calculatePassiveMobSpawnCount(passiveMobCount);
   while (remainingSpawnCount > 0) {
      // Choose a random passive mob type to spawn
      const mobType = getRandomEntityType("passive");
   
      // Find the tiles that the mob type can spawn on
      const spawnInfo = ENTITY_SPAWN_INFO_RECORD[mobType]!;
      const eligibleSpawnTileCooordinates = spawnInfo.spawnableTiles!.slice();
      
      // Pick a random tile to be the origin
      const originTileCoords = randItem(eligibleSpawnTileCooordinates);
      
      const mobClass = ENTITY_CLASS_RECORD[mobType]();
      const classParams = typeof spawnInfo.classParams !== "undefined" ? spawnInfo.classParams() : [];

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
         const entity = new mobClass(new Point(x, y), ...classParams);
         SERVER.board.loadEntity(entity);
      }

      remainingSpawnCount -= spawnCount;
   }
}