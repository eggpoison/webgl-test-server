import { BiomeName, EntityType } from "webgl-test-shared";

export type EntitySpawnInfo = {
   /** The type of entity to spawn */
   readonly entityType: EntityType;
   /** Array of all biomes which the entity is able to be spawned in */
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   /** Average number of spawn attempts per tile that happen in the local biome each second */
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
      spawnRate: 0.01,
      packSpawningInfo: {
         size: [2, 5],
         spawnRange: 200
      },
      maxLocalBiomeDensity: 0.01
   },
   {
      entityType: "tree",
      spawnableBiomes: ["grasslands"],
      spawnRate: 0.01,
      maxLocalBiomeDensity: 0.015
   },
   {
      entityType: "tombstone",
      spawnableBiomes: ["grasslands"],
      spawnRate: 0.005,
      maxLocalBiomeDensity: 0.003,
      spawnTimeRanges: [[0, 3], [19, 24]]
   },
   {
      entityType: "boulder",
      spawnableBiomes: ["mountains"],
      spawnRate: 0.005,
      maxLocalBiomeDensity: 0.05
   }
];

export default SPAWN_INFO_RECORD;