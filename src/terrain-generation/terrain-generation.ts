import { SETTINGS } from "webgl-test-shared/lib/settings";
import { generateOctavePerlinNoise, generatePerlinNoise, generatePointPerlinNoise } from "../perlin-noise";
import BIOME_GENERATION_INFO, { BiomeGenerationInfo, BiomeSpawnRequirements, TileGenerationInfo } from "./terrain-generation-info";
import Tile from "../Tile";
import { BiomeName, GrassTileInfo, RiverSteppingStoneData, TileInfoConst, TileType, TileTypeConst, WaterRockData, randInt, smoothstep } from "webgl-test-shared";
import { WaterTileGenerationInfo, generateRiverFeatures, generateRiverTiles } from "./river-generation";
import SRandom from "../SRandom";
import OPTIONS from "../options";

const HEIGHT_NOISE_SCALE = 50;
const TEMPERATURE_NOISE_SCALE = 80;
const HUMIDITY_NOISE_SCALE = 30;

const matchesBiomeRequirements = (generationInfo: BiomeSpawnRequirements, height: number, temperature: number, humidity: number): boolean => {
   // Height
   if (typeof generationInfo.minHeight !== "undefined" && height < generationInfo.minHeight) return false;
   if (typeof generationInfo.maxHeight !== "undefined" && height > generationInfo.maxHeight) return false;
   
   // Temperature
   if (typeof generationInfo.minTemperature !== "undefined" && temperature < generationInfo.minTemperature) return false;
   if (typeof generationInfo.maxTemperature !== "undefined" && temperature > generationInfo.maxTemperature) return false;
   
   // Humidity
   if (typeof generationInfo.minHumidity !== "undefined" && humidity < generationInfo.minHumidity) return false;
   if (typeof generationInfo.maxHumidity !== "undefined" && humidity > generationInfo.maxHumidity) return false;

   return true;
}

const getBiome = (height: number, temperature: number, humidity: number): BiomeName => {
   for (const [name, generationInfo] of Object.entries(BIOME_GENERATION_INFO) as Array<[BiomeName, BiomeGenerationInfo]>) {
      if (generationInfo.spawnRequirements !== null && matchesBiomeRequirements(generationInfo.spawnRequirements, height, temperature, humidity)) {
         return name;
      }
   }

   throw new Error(`Couldn't find a valid biome! Height: ${height}, temperature: ${temperature}, humidity: ${humidity}`);
}

const matchesTileRequirements = (generationInfo: TileGenerationInfo, weight: number, dist: number): boolean => {
   if (typeof generationInfo.noiseRequirements !== "undefined") {
      if (typeof generationInfo.noiseRequirements.minWeight !== "undefined" && weight < generationInfo.noiseRequirements.minWeight) return false;
      if (typeof generationInfo.noiseRequirements.maxWeight !== "undefined" && weight > generationInfo.noiseRequirements.maxWeight) return false;
   }

   if (typeof generationInfo.minDist !== "undefined" && dist < generationInfo.minDist) return false;
   if (typeof generationInfo.maxDist !== "undefined" && dist > generationInfo.maxDist) return false;

   return true;
}

const getTileInfo = (biomeName: BiomeName, dist: number, x: number, y: number): Omit<TileInfoConst, "biomeName"> => {
   const biomeGenerationInfo = BIOME_GENERATION_INFO[biomeName];
   for (const tileGenerationInfo of biomeGenerationInfo.tiles) {
      let weight = 0;
      if (typeof tileGenerationInfo.noiseRequirements !== "undefined") {
         weight = generatePointPerlinNoise(x, y, tileGenerationInfo.noiseRequirements.scale, tileGenerationInfo.tileType + "-" + tileGenerationInfo.noiseRequirements.scale);
      }
      
      if (matchesTileRequirements(tileGenerationInfo, weight, dist)) {
         return {
            type: tileGenerationInfo.tileType,
            isWall: tileGenerationInfo.isWall
         };
      }
   }

   throw new Error(`Couldn't find a valid tile info! Biome: ${biomeName}`);
}

const getTileDist = (biomeNames: Array<Array<BiomeName>>, tileX: number, tileY: number): number => {
   /** The maximum distance that the algorithm will search for */
   const MAX_SEARCH_DIST = 10;

   // @Incomplete
   const tileBiome = biomeNames[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];

   for (let dist = 1; dist <= MAX_SEARCH_DIST; dist++) {
      for (let i = 0; i <= dist; i++) {
         // Top right
         if (tileX + i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileX + i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE && tileY - dist + i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileY - dist + i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE) {
            const topRightBiome = biomeNames[tileX + i + SETTINGS.EDGE_GENERATION_DISTANCE][tileY - dist + i + SETTINGS.EDGE_GENERATION_DISTANCE];
            if (topRightBiome !== tileBiome) {
               return dist - 1;
            }
         }
         // Bottom right
         if (tileX + dist - i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileX + dist - i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE && tileY + i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileY + i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE) {
            const bottomRightBiome = biomeNames[tileX + dist - i + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + i + SETTINGS.EDGE_GENERATION_DISTANCE];
            if (bottomRightBiome !== tileBiome) {
               return dist - 1;
            }
         }
         // Bottom left
         if (tileX - dist + i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileX - dist + i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE && tileY + i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileY + i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE) {
            const bottomLeftBiome = biomeNames[tileX - dist + i + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + i + SETTINGS.EDGE_GENERATION_DISTANCE];
            if (bottomLeftBiome !== tileBiome) {
               return dist - 1;
            }
         }
         // Top left
         if (tileX - i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileX - i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE && tileY - dist + i >= -SETTINGS.EDGE_GENERATION_DISTANCE && tileY - dist + i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE) {
            const topLeftBiome = biomeNames[tileX - i + SETTINGS.EDGE_GENERATION_DISTANCE][tileY - dist + i + SETTINGS.EDGE_GENERATION_DISTANCE];
            if (topLeftBiome !== tileBiome) {
               return dist - 1;
            }
         }
      }
   }

   return MAX_SEARCH_DIST;
}

/** Generate the tile array's tile types based on their biomes */
export function generateTileInfo(biomeNames: Array<Array<BiomeName>>, tileTypeArray: Array<Array<TileTypeConst>>, tileIsWallArray: Array<Array<boolean>>): void {
   for (let tileX = -SETTINGS.EDGE_GENERATION_DISTANCE; tileX < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE; tileX++) {
      for (let tileY = -SETTINGS.EDGE_GENERATION_DISTANCE; tileY < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE; tileY++) {
         const dist = getTileDist(biomeNames, tileX, tileY);

         const biomeName = biomeNames[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
         // @Speed: Garbage collection
         const tileInfo = getTileInfo(biomeName, dist, tileX, tileY);
         tileTypeArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE] = tileInfo.type;
         tileIsWallArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE] = tileInfo.isWall;
      }
   }
}

export interface TerrainGenerationInfo {
   readonly tiles: Array<Tile>;
   readonly riverFlowDirections: Record<number, Record<number, number>>;
   readonly waterRocks: ReadonlyArray<WaterRockData>;
   readonly riverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;
   readonly edgeTiles: Array<Tile>;
   readonly edgeTileRiverFlowDirections: Record<number, Record<number, number>>;
   readonly grassInfo: Record<number, Record<number, GrassTileInfo>>;
}

function generateTerrain(): TerrainGenerationInfo {
   // Seed the random number generator
   if (OPTIONS.inBenchmarkMode) {
      SRandom.seed(40404040404);
   } else {
      SRandom.seed(randInt(0, 9999999999));
   }

   const biomeNameArray = new Array<Array<BiomeName>>();
   const tileTypeArray = new Array<Array<TileTypeConst>>();
   const tileIsWallArray = new Array<Array<boolean>>();

   const setBiomeName = (tileX: number, tileY: number, biomeName: BiomeName): void => {
      biomeNameArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE] = biomeName;
   } 

   const tileIsInBoard = (tileX: number, tileY: number): boolean => {
      return tileX >= 0 && tileX < SETTINGS.BOARD_DIMENSIONS && tileY >= 0 && tileY < SETTINGS.BOARD_DIMENSIONS;
   }

   // Generate the noise
   const heightMap = generateOctavePerlinNoise(SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2, SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2, HEIGHT_NOISE_SCALE, 3, 1.5, 0.75);
   const temperatureMap = generatePerlinNoise(SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2, SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2, TEMPERATURE_NOISE_SCALE);
   const humidityMap = generatePerlinNoise(SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2, SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2, HUMIDITY_NOISE_SCALE);
   
   // Push humidity and temperature towards the extremes
   for (let i = 0; i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2; i++) {
      // Fill the tile array using the noise
      for (let j = -SETTINGS.EDGE_GENERATION_DISTANCE; j < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE; j++) {
         const humidity = humidityMap[i][j];
         humidityMap[i][j] = smoothstep(humidity);

         const temperature = temperatureMap[i][j];
         temperatureMap[i][j] = smoothstep(temperature);
      }
   }
   
   // Generate biome info using the noise
   for (let i = 0; i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2; i++) {
      biomeNameArray.push([]);
      tileTypeArray.push([]);
      tileIsWallArray.push([]);
      for (let j = 0; j < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2; j++) {
         const height = heightMap[i][j];
         const temperature = temperatureMap[i][j];
         const humidity = humidityMap[i][j];

         const biomeName = getBiome(height, temperature, humidity);
         biomeNameArray[i].push(biomeName);
         tileTypeArray[i].push(0);
         tileIsWallArray[i].push(false);
      }
   }

   // Generate rivers
   let riverTiles: ReadonlyArray<WaterTileGenerationInfo>;
   if (OPTIONS.generateRivers) {
      riverTiles = generateRiverTiles();
   } else {
      riverTiles = [];
   }

   const riverFlowDirections: Record<number, Record<number, number>> = {};
   for (const tileInfo of riverTiles) {
      // Override biome names for river tiles
      setBiomeName(tileInfo.tileX, tileInfo.tileY, "river");

      // Set river flow directions
      if (tileIsInBoard(tileInfo.tileX, tileInfo.tileY)) {
         if (!riverFlowDirections.hasOwnProperty(tileInfo.tileX)) {
            riverFlowDirections[tileInfo.tileX] = {};
         }
         riverFlowDirections[tileInfo.tileX][tileInfo.tileY] = tileInfo.flowDirection;
      }
   }

   // @Cleanup: This is only done so that we only generate features for in-board rivers,
   // but once we want to generate features for edge rivers, this won't be necessary
   // Categorise the water tiles
   const inBoardRiverTiles = new Array<WaterTileGenerationInfo>();
   for (const riverTileInfo of riverTiles) {
      if (tileIsInBoard(riverTileInfo.tileX, riverTileInfo.tileY)) {
         inBoardRiverTiles.push(riverTileInfo);
      }
   }

   generateTileInfo(biomeNameArray, tileTypeArray, tileIsWallArray);

   const waterRocks = new Array<WaterRockData>();
   const riverSteppingStones = new Array<RiverSteppingStoneData>();
   generateRiverFeatures(inBoardRiverTiles, waterRocks, riverSteppingStones);

   // Make an array of tiles from the tile info array
   // The outer loop has to be tileY so that the tiles array is filled properly
   const tiles = new Array<Tile>();
   const edgeTiles = new Array<Tile>();
   const grassInfo: Record<number, Record<number, GrassTileInfo>> = {};
   for (let tileY = -SETTINGS.EDGE_GENERATION_DISTANCE; tileY < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE; tileY++) {
      for (let tileX = -SETTINGS.EDGE_GENERATION_DISTANCE; tileX < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE; tileX++) {
         const tileType = tileTypeArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];

         if (tileIsInBoard(tileX, tileY)) {
            let riverFlowDirection: number; 
            // @Cleanup: This seems awful
            if (riverFlowDirections.hasOwnProperty(tileX) && riverFlowDirections[tileX].hasOwnProperty(tileY)) {
               let desired = riverFlowDirections[tileX][tileY];
               if (desired >= 2 * Math.PI) {
                  desired -= 2 * Math.PI;
               } else if (desired < 0) {
                  desired += 2 * Math.PI;
               }
   
               for (let i = 0; i < 8; i++) {
                  const angle = i / 4 * Math.PI;
                  if (Math.abs(angle - desired) < 0.01) {
                     riverFlowDirection = i;
                     break;
                  }
               }
               if (typeof riverFlowDirection! === "undefined") {
                  console.log(riverFlowDirections[tileX][tileY]);
                  throw new Error();
               }
            } else {
               riverFlowDirection = 0;
            }
            
            // Create the tile
            const biomeName = biomeNameArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
            const isWall = tileIsWallArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
            const tile = new Tile(tileX, tileY, tileType, biomeName, isWall, riverFlowDirection);
            tiles.push(tile);
         } else {
            // Create the tile
            const biomeName = biomeNameArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
            const isWall = tileIsWallArray[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
            const tile = new Tile(tileX, tileY, tileType, biomeName, isWall, 0);
            edgeTiles.push(tile);
         }
         
         if (tileType === TileTypeConst.grass) {
            if (!grassInfo.hasOwnProperty(tileX)) {
               grassInfo[tileX] = {};
            }
            
            // @Cleanup: Repeated code
            const temperature = temperatureMap[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
            const humidity = humidityMap[tileX + SETTINGS.EDGE_GENERATION_DISTANCE][tileY + SETTINGS.EDGE_GENERATION_DISTANCE];
            grassInfo[tileX][tileY] = {
               temperature: temperature,
               humidity: humidity
            };
         }
      }
   }

   const edgeTileRiverFlowDirections: Record<number, Record<number, number>> = {};

   return {
      tiles: tiles,
      waterRocks: waterRocks,
      riverSteppingStones: riverSteppingStones,
      riverFlowDirections: riverFlowDirections,
      edgeTiles: edgeTiles,
      edgeTileRiverFlowDirections: edgeTileRiverFlowDirections,
      grassInfo: grassInfo
   };
}

export default generateTerrain;