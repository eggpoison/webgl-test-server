import { BiomeName, EntityType } from "webgl-test-shared";

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

export default ENTITY_SPAWN_INFO_RECORD;