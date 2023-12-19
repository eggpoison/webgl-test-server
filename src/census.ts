import { BiomeName, EntityTypeConst, TileType, TileTypeConst } from "webgl-test-shared";
import Tile from "./Tile";
import ENTITY_CLASS_RECORD from "./entity-classes";
import Entity from "./GameObject";

const entityCounts = new Array<EntityTypeConst>();
for (let i = 0; i < Object.keys(ENTITY_CLASS_RECORD).length; i++) {
   entityCounts.push(0);
}

interface TileCensus {
   types: Partial<Record<TileType, Array<Tile>>>;
   biomes: Partial<Record<BiomeName, Array<Tile>>>;
}

const tileCensus: TileCensus = {
   types: {},
   biomes: {}
};

/** Stores the IDs of all entities that are being tracked in the census */
const trackedEntityIDs = new Set<number>();

export function addEntityToCensus(entity: Entity): void {
   entityCounts[entity.type]++;
   trackedEntityIDs.add(entity.id);
}

export function removeEntityFromCensus(entity: Entity): void {
   if (!trackedEntityIDs.has(entity.id)) return;
   
   if (entityCounts[entity.type] <= 0) {
      console.log(entityCounts);
      console.warn(`Entity type "${entity.type}" is not in the census.`);
      console.trace();
      throw new Error();
   }

   entityCounts[entity.type]--;
   trackedEntityIDs.delete(entity.id);
}

export function getEntityCount(entityType: EntityTypeConst): number {
   return entityCounts[entityType];
}

export function addTileToCensus(tile: Tile): void {
   if (!tileCensus.types.hasOwnProperty(tile.type)) {
      tileCensus.types[tile.type] = [tile];
   } else {
      tileCensus.types[tile.type]!.push(tile);
   }

   if (!tileCensus.biomes.hasOwnProperty(tile.biomeName)) {
      tileCensus.biomes[tile.biomeName] = [tile];
   } else {
      tileCensus.biomes[tile.biomeName]!.push(tile);
   }
}

export function removeTileFromCensus(tile: Tile): void {
   if (!tileCensus.types.hasOwnProperty(tile.type)) {
      throw new Error("Tile type is not in the census.")
   }

   tileCensus.types[tile.type]!.splice(tileCensus.types[tile.type]!.indexOf(tile), 1);
   if (tileCensus.types[tile.type]!.length === 0) {
      delete tileCensus.types[tile.type];
   }

   tileCensus.biomes[tile.biomeName]!.splice(tileCensus.biomes[tile.biomeName]!.indexOf(tile), 1);
   if (tileCensus.biomes[tile.biomeName]!.length === 0) {
      delete tileCensus.biomes[tile.biomeName];
   }
}

export function getTileTypeCount(tileType: TileTypeConst): number {
   if (!tileCensus.types.hasOwnProperty(tileType)) {
      return 0;
   }

   return tileCensus.types[tileType]!.length;
}

export function getTilesOfBiome(biomeName: BiomeName): ReadonlyArray<Tile> {
   if (!tileCensus.biomes.hasOwnProperty(biomeName)) {
      return [];
   }
   
   return tileCensus.biomes[biomeName]!;
}

export function getTilesOfType(type: TileType): ReadonlyArray<Tile> {
   if (!tileCensus.types.hasOwnProperty(type)) {
      return [];
   }
   
   return tileCensus.types[type]!;
}

export function resetCensus(): void {
   for (let i = 0; i < Object.keys(ENTITY_CLASS_RECORD).length; i++) {
      entityCounts[i] = 0;
   }

   tileCensus.types = {};
   tileCensus.biomes = {};
}