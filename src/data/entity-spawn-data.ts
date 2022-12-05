import { BiomeName, EntityType } from "webgl-test-shared";

export type EntitySpawnInfo = {
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   readonly spawnableTiles: Array<[number, number]>;
   /** Affects the chance of the mob type being chosen to spawn */
   readonly weight: number;
   readonly packSpawningInfo?: {
      readonly size: number | [number, number];
      /** Number of tiles the entities can spawn from the spawn origin */
      readonly spawnRange: number;
   }
   /** If present, specifies when the entity is able to be spawned */
   readonly time?: "night" | "day";
}

export type SpawnInfoRecord = Partial<Record<EntityType, EntitySpawnInfo>>;

export const PASSIVE_MOB_SPAWN_INFO_RECORD: SpawnInfoRecord = {
   cow: {
      spawnableBiomes: ["grasslands"],
      spawnableTiles: [],
      packSpawningInfo: {
         size: [1, 4],
         spawnRange: 4,
      },
      weight: 1
   }
};

export const HOSTILE_MOB_SPAWN_INFO_RECORD: SpawnInfoRecord = {};

export const RESOURCE_SPAWN_INFO_RECORD: SpawnInfoRecord = {};

export const TOMBSTONE_SPAWN_INFO_RECORD: SpawnInfoRecord = {
   tombstone: {
      spawnableBiomes: ["grasslands"],
      spawnableTiles: [],
      weight: 1,
      time: "night"
   }
};