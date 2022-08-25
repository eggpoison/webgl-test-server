import { BiomeName, EntityType } from "webgl-test-shared";
import { getTilesByBiome } from "../terrain-generation";

export type EntitySpawnInfo = {
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   spawnableTiles?: ReadonlyArray<[number, number]>;
   readonly packSize: number | [number, number];
   /** Number of tiles the entities can spawn from the spawn origin */
   readonly packSpawnRange: number;
}

const ENTITY_SPAWN_INFO_RECORD: Partial<Record<EntityType, EntitySpawnInfo>> = {
   cow: {
      spawnableBiomes: ["grasslands"],
      packSize: [1, 4],
      packSpawnRange: 3
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

export default ENTITY_SPAWN_INFO_RECORD;