import { BiomeName, EntityType } from "webgl-test-shared";
import { getTilesByBiome } from "../terrain-generation/terrain-generation";

export type EntitySpawnInfo = {
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   readonly spawnableTiles: Array<[number, number]>;
   readonly packSize: number | [number, number];
   /** Number of tiles the entities can spawn from the spawn origin */
   readonly packSpawnRange: number;
   /** Affects the chance of the mob type being chosen to spawn */
   readonly weight: number;
   readonly time?: "night" | "day";
}

const ENTITY_SPAWN_INFO_RECORD: Partial<Record<EntityType, EntitySpawnInfo>> = {
   cow: {
      spawnableBiomes: ["grasslands"],
      spawnableTiles: [],
      packSize: [1, 4],
      packSpawnRange: 4,
      weight: 1
   },
   zombie: {
      spawnableBiomes: ["grasslands"],
      spawnableTiles: [],
      packSize: [2, 3],
      packSpawnRange: 3,
      weight: 1,
      time: "night"
   }
};

export default ENTITY_SPAWN_INFO_RECORD;