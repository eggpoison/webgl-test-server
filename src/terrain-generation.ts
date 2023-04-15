import { SETTINGS } from "webgl-test-shared/lib/settings";
import { generateOctavePerlinNoise, generatePerlinNoise } from "./perlin-noise";
import { BiomeName } from "webgl-test-shared/lib/biomes";
import BIOME_GENERATION_INFO, { BiomeGenerationInfo, BiomeSpawnRequirements, TileGenerationInfo } from "./data/biome-generation-info";
import Tile from "./tiles/Tile";
import { TileInfo } from "webgl-test-shared";
import { createGenericTile } from "./tiles/tile-class-record";

const HEIGHT_NOISE_SCALE = 25;
const TEMPERATURE_NOISE_SCALE = 30;
const HUMIDITY_NOISE_SCALE = 15;
const TILE_TYPE_NOISE_SCALE = 5;

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

const generateBiomeInfo = (tileArray: Array<Array<Partial<TileInfo>>>): void => {
   // Generate the noise
   const heightMap = generateOctavePerlinNoise(SETTINGS.BOARD_DIMENSIONS, SETTINGS.BOARD_DIMENSIONS, HEIGHT_NOISE_SCALE, 3, 1.5, 0.75);
   const temperatureMap = generatePerlinNoise(SETTINGS.BOARD_DIMENSIONS, SETTINGS.BOARD_DIMENSIONS, TEMPERATURE_NOISE_SCALE);
   const humidityMap = generatePerlinNoise(SETTINGS.BOARD_DIMENSIONS, SETTINGS.BOARD_DIMENSIONS, HUMIDITY_NOISE_SCALE);
   
   for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
      // Fill the tile array using the noise
      for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
         const height = heightMap[x][y];
         const temperature = temperatureMap[x][y];
         const humidity = humidityMap[x][y];

         const biomeName = getBiome(height, temperature, humidity);
         tileArray[x][y].biomeName = biomeName;
      }
   }
}

const matchesTileRequirements = (generationInfo: TileGenerationInfo, weight: number, dist: number): boolean => {
   if (typeof generationInfo.minWeight !== "undefined" && weight < generationInfo.minWeight) return false;
   if (typeof generationInfo.maxWeight !== "undefined" && weight > generationInfo.maxWeight) return false;

   if (typeof generationInfo.minDist !== "undefined" && dist < generationInfo.minDist) return false;
   if (typeof generationInfo.maxDist !== "undefined" && dist > generationInfo.maxDist) return false;

   return true;
}

const getTileInfo = (biomeName: BiomeName, weight: number, dist: number): Omit<TileInfo, "biomeName" | "fogAmount"> => {
   const biomeGenerationInfo = BIOME_GENERATION_INFO[biomeName];
   for (const tileGenerationInfo of biomeGenerationInfo.tiles) {
      if (matchesTileRequirements(tileGenerationInfo, weight, dist)) {
         return tileGenerationInfo.info;
      }
   }

   throw new Error(`Couldn't find a valid tile info! Biome: ${biomeName}, weight: ${weight}`);
}

const getTileDist = (tileInfoArray: Array<Array<Partial<TileInfo>>>, tileX: number, tileY: number): number => {
   /** The maximum distance that the algorithm will search for */
   const MAX_SEARCH_DIST = 10;

   const tileBiome = tileInfoArray[tileX][tileY].biomeName;

   for (let dist = 1; dist <= MAX_SEARCH_DIST; dist++) {
      for (let i = 0; i <= dist; i++) {
         const tileCoords = new Array<[number, number]>();

         tileCoords.push([tileX + i, tileY - dist + i]); // Top right
         tileCoords.push([tileX + dist - i, tileY + i]); // Bottom right
         tileCoords.push([tileX - dist + i, tileY + i]); // Bottom left
         tileCoords.push([tileX - i, tileY - dist + i]); // Top left

         for (const [x, y] of tileCoords) {
            if (x < 0 || x >= SETTINGS.BOARD_DIMENSIONS || y <= 0 || y >= SETTINGS.BOARD_DIMENSIONS) continue;

            const tile = tileInfoArray[x][y];

            if (tile.biomeName !== tileBiome) return dist - 1;
         }
      }
   }

   return MAX_SEARCH_DIST;
}

/** Generate the tile array's tile types based on their biomes */
const generateTileInfo = (tileInfoArray: Array<Array<Partial<TileInfo>>>): void => {
   // Generate the noise
   const noise = generatePerlinNoise(SETTINGS.BOARD_DIMENSIONS, SETTINGS.BOARD_DIMENSIONS, TILE_TYPE_NOISE_SCALE);

   for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
      for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
         const tileInfo = tileInfoArray[x][y];
         const weight = noise[x][y];

         const dist = getTileDist(tileInfoArray, x, y);

         Object.assign(tileInfo, getTileInfo(tileInfo.biomeName!, weight, dist));
      }
   }
}

export let terrainHasBeenGenerated: boolean = false;

function generateTerrain(): Array<Array<Tile>> {
   // Initialise the tile info array
   const tileInfoArray = new Array<Array<Partial<TileInfo>>>(SETTINGS.BOARD_DIMENSIONS);
   for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
      tileInfoArray[x] = new Array<TileInfo>(SETTINGS.BOARD_DIMENSIONS);

      for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
         tileInfoArray[x][y] = {};
      }
   }

   generateBiomeInfo(tileInfoArray);
   generateTileInfo(tileInfoArray);

   // Make an array of tiles from the tile info array
   const tiles = new Array<Array<Tile>>();
   for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
      tiles[x] = new Array<Tile>();
      for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
         // Create the tile
         const tileInfo = tileInfoArray[x][y] as TileInfo;
         const tile = createGenericTile(x, y, tileInfo);
         tiles[x][y] = tile;
      }
   }

   terrainHasBeenGenerated = true;

   return tiles;
}

export default generateTerrain;