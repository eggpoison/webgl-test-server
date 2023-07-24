import { EntityType, TileType } from "webgl-test-shared";
import Entity from "./entities/Entity";

const entityTypeCounts: Partial<Record<EntityType, number>> = {};

const tileTypeCounts: Partial<Record<TileType, number>> = {};

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
      // delete entityTypeCounts[entityType];
   }

   trackedEntityIDs.delete(entity.id);
}

export function getEntityCount(entityType: EntityType): number {
   if (!entityTypeCounts.hasOwnProperty(entityType)) {
      return 0;
   }
   
   return entityTypeCounts[entityType]!;
}

export function addTileToCensus(tileType: TileType): void {
   if (!tileTypeCounts.hasOwnProperty(tileType)) {
      tileTypeCounts[tileType] = 1;
   } else {
      tileTypeCounts[tileType]!++;
   }
}

export function removeTileFromCensus(tileType: TileType): void {
   if (!tileTypeCounts.hasOwnProperty(tileType)) {
      throw new Error("Tile type is not in the census.")
   }

   tileTypeCounts[tileType]!--;
   if (tileTypeCounts[tileType]! === 0) {
      delete tileTypeCounts[tileType];
   }
}

export function getTileTypeCount(tileType: TileType): number {
   if (!tileTypeCounts.hasOwnProperty(tileType)) {
      return 0;
   }

   return tileTypeCounts[tileType]!;
}