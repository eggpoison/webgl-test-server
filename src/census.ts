import { BiomeName, EntityType, TileType } from "webgl-test-shared";
import Entity from "./entities/Entity";
import Tile from "./tiles/Tile";

const entityTypeCounts: Partial<Record<EntityType, number>> = {};

interface TileCensus {
   readonly types: Partial<Record<TileType, Array<Tile>>>;
   readonly biomes: Partial<Record<BiomeName, Array<Tile>>>;
}

const tileCensus: TileCensus = {
   types: {},
   biomes: {}
};

/** Stores the IDs of all entities that are being tracked in the census */
const trackedEntityIDs = new Set<number>();

export function addEntityToCensus(entity: Entity): void {
   if (!entityTypeCounts.hasOwnProperty(entity.type)) {
      entityTypeCounts[entity.type] = 1;
   } else {
      entityTypeCounts[entity.type]!++;
   }

   trackedEntityIDs.add(entity.id);
}

export function removeEntityFromCensus(entity: Entity): void {
   if (!trackedEntityIDs.has(entity.id)) return;
   
   if (!entityTypeCounts.hasOwnProperty(entity.type) || entityTypeCounts[entity.type]! <= 0) {
      console.log(Object.assign({}, entityTypeCounts));
      console.log(entity.type);
      console.warn(`Entity type "${entity.type}" is not in the census.`);
      console.trace();
   }

   entityTypeCounts[entity.type]!--;
   if (entityTypeCounts[entity.type]! === 0) {
      delete entityTypeCounts[entity.type];
   }

   trackedEntityIDs.delete(entity.id);
}

export function getEntityCount(entityType: EntityType): number {
   if (!entityTypeCounts.hasOwnProperty(entityType)) {
      return 0;
   }
   
   return entityTypeCounts[entityType]!;
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

   tileCensus.types[tile.type]!.splice(tileCensus.types[tile.type]!.indexOf(tile));
   if (tileCensus.types[tile.type]!.length === 0) {
      delete tileCensus.types[tile.type];
   }

   tileCensus.biomes[tile.biomeName]!.splice(tileCensus.biomes[tile.biomeName]!.indexOf(tile));
   if (tileCensus.biomes[tile.biomeName]!.length === 0) {
      delete tileCensus.biomes[tile.biomeName];
   }
}

export function getTileTypeCount(tileType: TileType): number {
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