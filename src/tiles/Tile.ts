import { TileType, BiomeName, TileInfo, SETTINGS } from "webgl-test-shared";
import { SERVER } from "../server";
import { CONNECTED_TILE_OFFSETS, LocalBiome, LOCAL_BIOME_RECORD, terrainHasBeenGenerated } from "../terrain-generation";

const removePreviousTile = (x: number, y: number): void => {
   const tile = SERVER.board.getTile(x, y);

   // Remove the tile from its local biome
   tile.localBiome.tileCoordinates.delete([x, y]);

   // If the tile was the last tile in the local biome, destroy the local biome
   if (tile.localBiome.tileCoordinates.size === 0) {
      LOCAL_BIOME_RECORD[tile.biomeName]!.delete(tile.localBiome);
   }
}

const createNewLocalBiome = (tiles: Set<[tileX: number, tileY: number]>): LocalBiome => {
   const localBiome: LocalBiome = {
      tileCoordinates: tiles,
      entityCounts: {}
   };

   // Account for any entities which might already be on the local biome
   for (const [tileX, tileY] of tiles) {
      // Get the chunk
      const chunkX = Math.floor(tileX / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SETTINGS.CHUNK_SIZE);
      const chunk = SERVER.board.getChunk(chunkX, chunkY);

      for (const entity of chunk.getEntities()) {
         const entityTileX = Math.floor(entity.position.x / SETTINGS.CHUNK_SIZE);
         const entityTileY = Math.floor(entity.position.y / SETTINGS.CHUNK_SIZE);
         if (entityTileX === tileX && entityTileY === tileY) {
            if (!localBiome.entityCounts.hasOwnProperty(entity.type)) {
               localBiome.entityCounts[entity.type] = 1;
            } else {
               localBiome.entityCounts[entity.type]!++;
            }
         }
      }
   }

   return localBiome;
}

const setTileLocalBiome = (tile: Tile): void => {
   // Get all local biomes close to the tile
   const nearbyLocalBiomes = new Array<LocalBiome>();
   for (const [xOffset, yOffset] of CONNECTED_TILE_OFFSETS) {
      const tileX = tile.x + xOffset;
      const tileY = tile.y + yOffset;

      if (tileX < 0 || tileX >= SETTINGS.BOARD_DIMENSIONS || tileY < 0 || tileY >= SETTINGS.BOARD_DIMENSIONS) {
         continue;
      }

      const currentTile = SERVER.board.getTile(tileX, tileY);
 
      if (currentTile.biomeName === tile.biomeName) {
         if (!nearbyLocalBiomes.includes(currentTile.localBiome)) {
            nearbyLocalBiomes.push(currentTile.localBiome);
         }
      }
   }

   // If there were no nearby local biomes, make a new one
   if (nearbyLocalBiomes.length === 0) {
      // If the tile has a new type of biome, add that type of biome to LOCAL_BIOME_RECORD
      if (!LOCAL_BIOME_RECORD.hasOwnProperty(tile.biomeName)) {
         LOCAL_BIOME_RECORD[tile.biomeName] = new Set<LocalBiome>();
      }
      
      const localBiomeTiles = new Set<[tileX: number, tileY: number]>();
      localBiomeTiles.add([tile.x, tile.y]);

      const localBiome = createNewLocalBiome(localBiomeTiles);
      LOCAL_BIOME_RECORD[tile.biomeName]!.add(localBiome);

      tile.localBiome = localBiome;
   } else if (nearbyLocalBiomes.length === 1) {
      // If there was only one nearby biome, add the tile to the existing local biome
      const localBiome = nearbyLocalBiomes[0];
      localBiome.tileCoordinates.add([tile.x, tile.y]);

      tile.localBiome = localBiome;
   } else {
      // 
      // Otherwise if there was more than one nearby biome, connect all of them into one big biome
      // 
   
      // Remove all previous local biomes while collecting their tiles
      const tiles = new Set<[tileX: number, tileY: number]>();
      for (const localBiome of nearbyLocalBiomes) {
         for (const tilePosition of localBiome.tileCoordinates) {
            tiles.add(tilePosition);
         }

         LOCAL_BIOME_RECORD[tile.biomeName]!.delete(localBiome);
      }

      // Create the mega local biome
      const localBiome = createNewLocalBiome(tiles);
      LOCAL_BIOME_RECORD[tile.biomeName]!.add(localBiome);

      tile.localBiome = localBiome;
   }
}

abstract class Tile implements TileInfo {
   public readonly x: number;
   public readonly y: number;

   public readonly type: TileType;
   public readonly biomeName: BiomeName;
   public readonly isWall: boolean;

   /** Index of the tile's local biome in the LOCAL_BIOMES array */
   public localBiome!: LocalBiome;

   constructor(x: number, y: number, tileInfo: TileInfo) {
      this.x = x;
      this.y = y;

      this.type = tileInfo.type;
      this.biomeName = tileInfo.biomeName;
      this.isWall = tileInfo.isWall;

      if (terrainHasBeenGenerated) {
         // Remove the previous tile
         removePreviousTile(x, y);

         // Add the tile to the tile array
         SERVER.board.setTile(x, y, this);
         
         // Add the tile to a local biome
         setTileLocalBiome(this);

         SERVER.board.registerNewTileUpdate(x, y);
      }
   }
   /** Runs every time a tile receives a random tick */
   public onRandomTick?(): void;
}

export default Tile;