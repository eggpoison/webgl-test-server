import { BiomeName, CowSpecies } from "webgl-test-shared";
import { MobType } from "../entities/Mob";
import { getTilesByBiome } from "../terrain-generation/terrain-generation";

export type EntitySpawnInfo = {
   readonly spawnableBiomes: ReadonlyArray<BiomeName>;
   spawnableTiles?: ReadonlyArray<[number, number]>;
   readonly packSize: number | [number, number];
   /** Number of tiles the entities can spawn from the spawn origin */
   readonly packSpawnRange: number;
   readonly classParams?: () => ReadonlyArray<unknown>;
}

const ENTITY_SPAWN_INFO_RECORD: Partial<Record<MobType, EntitySpawnInfo>> = {
   cow: {
      spawnableBiomes: ["grasslands"],
      packSize: [1, 4],
      packSpawnRange: 2,
      classParams: () => {
         const species: CowSpecies = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;
         return [species];
      }
   }
};

/** Called once the tiles have been generated */
export function generateEntitySpawnableTiles(): void {
   for (const [type, spawnInfo] of Object.entries(ENTITY_SPAWN_INFO_RECORD) as Array<[MobType, EntitySpawnInfo]>) {
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