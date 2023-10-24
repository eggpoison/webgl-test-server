import BIOME_GENERATION_INFO from "../data/terrain-generation-info";
import { TerrainGenerationInfo, generateTileInfo } from "./terrain-generation";
import { BiomeName, SETTINGS, TileInfo, TileType, randInt } from "webgl-test-shared";
import SRandom from "../SRandom";
import Tile from "../Tile";

function generateBenchmarkTerrain(): TerrainGenerationInfo {
   /*
   HOW IT WORKS:
   - Generates a grid of biomes deterministically
   */
  
   // Seed the random number generator
   SRandom.seed(123456789);

   // Initialise the tile info array
   const tileInfoArray = new Array<Array<Partial<TileInfo>>>();
   for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
      tileInfoArray.push(new Array<TileInfo>(SETTINGS.BOARD_DIMENSIONS));

      for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
         tileInfoArray[x][y] = {};
      }
   }
   
   const numBiomes = Object.keys(BIOME_GENERATION_INFO).length;
   const biomeDataEntries = Object.entries(BIOME_GENERATION_INFO);

   const biomesInSide = Math.ceil(Math.sqrt(numBiomes));
   const totalNumBiomes = biomesInSide * biomesInSide;
   const biomeTileSize = SETTINGS.BOARD_DIMENSIONS / biomesInSide;

   // Generate biomes
   for (let i = 0; i < totalNumBiomes; i++) {
      const biomeIndex = i % numBiomes;
      const biomeName = biomeDataEntries[biomeIndex][0] as BiomeName;

      const biomeX = i % biomesInSide;
      const biomeY = Math.floor(i / biomesInSide);

      for (let tileX = Math.floor(biomeX * biomeTileSize); tileX < Math.floor((biomeX + 1) * biomeTileSize); tileX++) {
         for (let tileY = Math.floor(biomeY * biomeTileSize); tileY < Math.floor((biomeY + 1) * biomeTileSize); tileY++) {
            tileInfoArray[tileX][tileY].biomeName = biomeName
         }
      }
   }

   generateTileInfo(tileInfoArray);
  
   const tiles = new Array<Array<Tile>>();
   for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
      tiles.push(new Array<Tile>());
      for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
         // Create the tile
         const tileInfo = tileInfoArray[x][y] as TileInfo;
         tiles[x].push(new Tile(x, y, tileInfo.type, tileInfo.biomeName, tileInfo.isWall));
      }
   }

   const riverFlowDirections: Record<number, Record<number, number>> = {};
   for (let tileX = 0; tileX < SETTINGS.BOARD_DIMENSIONS; tileX++) {
      for (let tileY = 0; tileY < SETTINGS.BOARD_DIMENSIONS; tileY++) {
         if (tileInfoArray[tileX][tileY].type === TileType.water) {
            if (!riverFlowDirections.hasOwnProperty(tileX)) {
               riverFlowDirections[tileX] = {};
            }
            riverFlowDirections[tileX][tileY] = Math.PI / 4 * randInt(0, 7);
         }
      }
   }

   return {
      tiles: tiles,
      waterRocks: [],
      riverSteppingStones: [],
      riverFlowDirections: riverFlowDirections
   };
}

export default generateBenchmarkTerrain;