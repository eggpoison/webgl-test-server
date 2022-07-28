import { Tile, TileInfo } from "webgl-test-shared/lib/Tile";
import { SETTINGS } from "webgl-test-shared/lib/settings";
import { generateOctavePerlinNoise, generatePerlinNoise } from "./perlin-noise";
import { BIOMES, Biome, BiomeGenerationInfo, TileGenerationInfo } from "webgl-test-shared/lib/biomes";

const HEIGHT_NOISE_SCALE = 25;
const TEMPERATURE_NOISE_SCALE = 30;
const HUMIDITY_NOISE_SCALE = 15;
const TILE_TYPE_NOISE_SCALE = 5;

const matchesBiomeRequirements = (generationInfo: BiomeGenerationInfo, height: number, temperature: number, humidity: number): boolean => {
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

const getBiome = (height: number, temperature: number, humidity: number): Biome => {
   for (const biome of BIOMES) {
      if (typeof biome.generationInfo !== "undefined" && matchesBiomeRequirements(biome.generationInfo, height, temperature, humidity)) {
         return biome;
      }
   }

   throw new Error(`Couldn't find a valid biome! Height: ${height}, temperature: ${temperature}, humidity: ${humidity}`);
}

const generateBiomeInfo = (tileArray: Array<Array<Partial<TileInfo>>>): void => {
   // Generate the noise
   const heightMap = generateOctavePerlinNoise(SETTINGS.DIMENSIONS, SETTINGS.DIMENSIONS, HEIGHT_NOISE_SCALE, 3, 1.5, 0.75);
   const temperatureMap = generatePerlinNoise(SETTINGS.DIMENSIONS, SETTINGS.DIMENSIONS, TEMPERATURE_NOISE_SCALE);
   const humidityMap = generatePerlinNoise(SETTINGS.DIMENSIONS, SETTINGS.DIMENSIONS, HUMIDITY_NOISE_SCALE);
   
   for (let y = 0; y < SETTINGS.DIMENSIONS; y++) {
      // Fill the tile array using the noise
      for (let x = 0; x < SETTINGS.DIMENSIONS; x++) {
         const height = heightMap[x][y];
         const temperature = temperatureMap[x][y];
         const humidity = humidityMap[x][y];

         const biome = getBiome(height, temperature, humidity);
         tileArray[x][y].biome = biome;
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

const getTileInfo = (biome: Biome, weight: number, dist: number): Omit<TileInfo, "biome" | "fogAmount"> => {
   for (const generationInfo of biome.tiles) {
      if (matchesTileRequirements(generationInfo, weight, dist)) {
         return generationInfo.info;
      }
   }

   throw new Error(`Couldn't find a valid tile info! Biome: ${biome}, weight: ${weight}`);
}

const getTileDist = (tileInfoArray: Array<Array<Partial<TileInfo>>>, tileX: number, tileY: number): number => {
   /** The maximum distance that the algorithm will search for */
   const MAX_SEARCH_DIST = 10;

   const tileBiome = tileInfoArray[tileX][tileY].biome;

   for (let dist = 1; dist <= MAX_SEARCH_DIST; dist++) {
      for (let i = 0; i <= dist; i++) {
         const tileCoords = new Array<[number, number]>();

         tileCoords.push([tileX + i, tileY - dist + i]); // Top right
         tileCoords.push([tileX + dist - i, tileY + i]); // Bottom right
         tileCoords.push([tileX - dist + i, tileY + i]); // Bottom left
         tileCoords.push([tileX - i, tileY - dist + i]); // Top left

         for (const [x, y] of tileCoords) {
            if (x < 0 || x >= SETTINGS.DIMENSIONS || y <= 0 || y >= SETTINGS.DIMENSIONS) continue;

            const tile = tileInfoArray[x][y];

            if (tile.biome !== tileBiome) return dist - 1;
         }
      }
   }

   return MAX_SEARCH_DIST;
}

/** Generate the tile array's tile types based on their biomes */
const generateTileInfo = (tileInfoArray: Array<Array<Partial<TileInfo>>>): void => {
   // Generate the noise
   const noise = generatePerlinNoise(SETTINGS.DIMENSIONS, SETTINGS.DIMENSIONS, TILE_TYPE_NOISE_SCALE);

   for (let y = 0; y < SETTINGS.DIMENSIONS; y++) {
      for (let x = 0; x < SETTINGS.DIMENSIONS; x++) {
         const tileInfo = tileInfoArray[x][y];
         const weight = noise[x][y];

         const dist = getTileDist(tileInfoArray, x, y);

         Object.assign(tileInfo, getTileInfo(tileInfo.biome!, weight, dist));
      }
   }
}

function generateTerrain(): Array<Array<Tile>> {
   // Initialise the tile info array
   const tileInfoArray = new Array<Array<Partial<TileInfo>>>(SETTINGS.DIMENSIONS);
   for (let x = 0; x < SETTINGS.DIMENSIONS; x++) {
      tileInfoArray[x] = new Array<TileInfo>(SETTINGS.DIMENSIONS);

      for (let y = 0; y < SETTINGS.DIMENSIONS; y++) {
         tileInfoArray[x][y] = {};
      }
   }

   generateBiomeInfo(tileInfoArray);
   generateTileInfo(tileInfoArray);

   // Make an array of tiles from the tile info array
   const tiles = tileInfoArray.map(tileInfoRow => {
      return tileInfoRow.map(info => {
         return new Tile(info as TileInfo);
      });
   });

   return tiles;
}

export default generateTerrain;