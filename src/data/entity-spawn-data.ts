import { BiomeName, EntityType } from "webgl-test-shared";

export type EntitySpawnInfo = {
   /** The type of entity to spawn */
   readonly entityType: EntityType;
   /** Array of all biomes which the entity is able to be spawned in */
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   /** Average number of times that the entity will have a spawn event occur */
   readonly spawnRate: number;
   /**
    * If present, details how a pack of entities should be spawned
    * Doesn't affect the conditions for the entity's spawn.
   */
   readonly packSpawningInfo?: {
      readonly size: number | [number, number];
      /** Maximum istance from the spawn origin that the entities can spawn */
      readonly spawnRange: number;
   }
   /** Maximum density per tile the entity can have in its local biome */
   readonly maxLocalBiomeDensity: number;
   /** Time ranges when the entity is able to be spawned. Only one time range has to be satisfied for the entity to be able to spawn. */
   readonly spawnTimeRanges?: ReadonlyArray<[minSpawnTime: number, maxSpawnTime: number]>;
}

const SPAWN_INFO_RECORD: ReadonlyArray<EntitySpawnInfo> = [
   {
      entityType: "cow",
      spawnableBiomes: ["grasslands"],
      spawnRate: 0.1,
      packSpawningInfo: {
         size: [2, 5],
         spawnRange: 200
      },
      maxLocalBiomeDensity: 0.01
   },
   {
      entityType: "tree",
      spawnableBiomes: ["grasslands"],
      spawnRate: 0.2,
      maxLocalBiomeDensity: 0.015
   },
   {
      entityType: "tombstone",
      spawnableBiomes: ["grasslands"],
      spawnRate: 0.2,
      maxLocalBiomeDensity: 0.005,
      spawnTimeRanges: [[0, 3], [19, 24]]
   }
];

export default SPAWN_INFO_RECORD;