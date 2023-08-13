import { SETTINGS } from "webgl-test-shared/lib/settings";
import { generateOctavePerlinNoise, generatePerlinNoise, generatePointPerlinNoise } from "../perlin-noise";
import BIOME_GENERATION_INFO, { BiomeGenerationInfo, BiomeSpawnRequirements, TileGenerationInfo } from "../data/biome-generation-info";
import Tile from "../tiles/Tile";
import { BiomeName, Point, RIVER_STEPPING_STONE_SIZES, RiverSteppingStoneData, RiverSteppingStoneSize, TileInfo, Vector, WaterRockData, lerp, randFloat, randInt, randSign } from "webgl-test-shared";
import { WaterTileGenerationInfo, generateRiverTiles } from "./river-generation";
import Board from "../Board";

const HEIGHT_NOISE_SCALE = 50;
const TEMPERATURE_NOISE_SCALE = 80;
const HUMIDITY_NOISE_SCALE = 30;
// const HEIGHT_NOISE_SCALE = 25;
// const TEMPERATURE_NOISE_SCALE = 30;
// const HUMIDITY_NOISE_SCALE = 15;

const ADJACENT_TILE_OFFSETS: ReadonlyArray<[xOffset: number, yOffset: number]> = [
   [1, 0],
   [0, -1],
   [0, 1],
   [-1, 0]
];

/** Minimum distance between crossings */
const MIN_CROSSING_DISTANCE = 325;
const RIVER_CROSSING_WIDTH = 100;
const RIVER_CROSSING_WATER_ROCK_WIDTH = 150;
const NUM_STONE_SPAWN_ATTEMPTS_PER_RIVER = 25;
const RIVER_STEPPING_STONE_SPACING = -5;

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
   if (typeof generationInfo.noiseRequirements !== "undefined") {
      if (typeof generationInfo.noiseRequirements.minWeight !== "undefined" && weight < generationInfo.noiseRequirements.minWeight) return false;
      if (typeof generationInfo.noiseRequirements.maxWeight !== "undefined" && weight > generationInfo.noiseRequirements.maxWeight) return false;
   }

   if (typeof generationInfo.minDist !== "undefined" && dist < generationInfo.minDist) return false;
   if (typeof generationInfo.maxDist !== "undefined" && dist > generationInfo.maxDist) return false;

   return true;
}

const getTileInfo = (biomeName: BiomeName, dist: number, x: number, y: number): Omit<TileInfo, "biomeName" | "fogAmount"> => {
   const biomeGenerationInfo = BIOME_GENERATION_INFO[biomeName];
   for (const tileGenerationInfo of biomeGenerationInfo.tiles) {
      let weight = 0;
      if (typeof tileGenerationInfo.noiseRequirements !== "undefined") {
         // weight = generatePointPerlinNoise(x, y, tileGenerationInfo.noiseRequirements.scale, tileGenerationInfo.tileType + "-" + tileGenerationInfo.noiseRequirements.scale);
         weight = generatePointPerlinNoise(x, y, 5, tileGenerationInfo.tileType + "-" + 5);
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
   for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
      for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
         const tileInfo = tileInfoArray[x][y];
         const dist = getTileDist(tileInfoArray, x, y);

         Object.assign(tileInfo, getTileInfo(tileInfo.biomeName!, dist, x, y));
      }
   }
}

const tileIsWater = (tileX: number, tileY: number, riverTiles: ReadonlyArray<WaterTileGenerationInfo>): boolean => {
   for (const tile of riverTiles) {
      if (tile.tileX === tileX && tile.tileY === tileY) {
         return true;
      }
   }
   return false;
}

const tileIsAdjacentToLand = (tileX: number, tileY: number, riverTiles: ReadonlyArray<WaterTileGenerationInfo>): boolean => {
   for (const offset of ADJACENT_TILE_OFFSETS) {
      const currentTileX = tileX + offset[0];
      const currentTileY = tileY + offset[1];
      if (Board.tileIsInBoard(currentTileX, currentTileY)) {
         if (!tileIsWater(currentTileX, currentTileY, riverTiles)) {
            return true;
         }
      }
   }

   return false;
}

const tileAtOffsetIsWater = (startTileX: number, startTileY: number, direction: number, riverTiles: ReadonlyArray<WaterTileGenerationInfo>): boolean => {
   const position = new Point(startTileX + 0.5, startTileY + 0.5);
   const offset = new Vector(1, direction).convertToPoint();
   position.add(offset);

   const tileX = Math.floor(position.x);
   const tileY = Math.floor(position.y);
   return tileIsWater(tileX, tileY, riverTiles);
}

interface RiverCrossingInfo {
   readonly startTileX: number;
   readonly startTileY: number;
   readonly endTileX: number;
   readonly endTileY: number;
   readonly direction: number;
}

const calculateRiverCrossingPositions = (riverTiles: ReadonlyArray<WaterTileGenerationInfo>): ReadonlyArray<RiverCrossingInfo> => {
   const riverCrossings = new Array<RiverCrossingInfo>();
   
   for (const startTile of riverTiles) {
      if (!tileIsAdjacentToLand(startTile.tileX, startTile.tileY, riverTiles)) {
         continue;
      }

      const directionOffset = randFloat(0, Math.PI/10) * randSign();

      let crossingDirection: number | undefined;
      const clockwiseIsWater = tileAtOffsetIsWater(startTile.tileX, startTile.tileY, startTile.flowDirection + directionOffset + Math.PI/2, riverTiles);
      const anticlockwiseIsWater = tileAtOffsetIsWater(startTile.tileX, startTile.tileY, startTile.flowDirection + directionOffset - Math.PI/2, riverTiles);

      // Only generate a river if only one side of the river is water
      if ((!clockwiseIsWater && !anticlockwiseIsWater) || (clockwiseIsWater && anticlockwiseIsWater)) {
         continue;
      }
      if (clockwiseIsWater) {
         crossingDirection = startTile.flowDirection + directionOffset + Math.PI/2;
      } else {
         crossingDirection = startTile.flowDirection + directionOffset - Math.PI/2;
      }

      // console.log(startTile.tileX, startTile.tileY);
      // validStartTiles.push({
      //    x: startTile.tileX,
      //    y: startTile.tileY
      // });

      let a1!: number;
      let b1!: number;

      // Calculate distance of crossing
      let currentTileX = startTile.tileX + 0.5;
      let currentTileY = startTile.tileY + 0.5;
      let endTileIsValid = true;
      while (true) {
         const offset = new Vector(1, crossingDirection).convertToPoint();
         const newTileX = currentTileX + offset.x;
         const newTileY = currentTileY + offset.y;
         a1 = newTileX;
         b1 = newTileY;

         if (!Board.tileIsInBoard(newTileX - 0.5, newTileY - 0.5)) {
            endTileIsValid = false;
            break;
         }

         if (!tileIsWater(Math.floor(newTileX - 0.5), Math.floor(newTileY - 0.5), riverTiles)) {
            break;
         }

         currentTileX = newTileX;
         currentTileY = newTileY;
      }
      if (!endTileIsValid) {
         continue;
      }

      const crossingDistance = Math.sqrt(Math.pow(startTile.tileX + 0.5 - currentTileX, 2) + Math.pow(startTile.tileY + 0.5 - currentTileY, 2));
      
      // Don't try to make a crossing if the crossing would be too short or too long
      if (crossingDistance < 2.5 || crossingDistance > 5) {
         continue;
      }

      riverCrossings.push({
         startTileX: startTile.tileX,
         startTileY: startTile.tileY,
         endTileX: Math.floor(currentTileX - 0.5),
         endTileY: Math.floor(currentTileY - 0.5),
         direction: crossingDirection
      });
   }

   return riverCrossings;
}

export interface TerrainGenerationInfo {
   readonly tiles: Array<Array<Tile>>;
   readonly riverFlowDirections: Record<number, Record<number, number>>;
   readonly waterRocks: ReadonlyArray<WaterRockData>;
   readonly riverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;
}

function generateTerrain(): TerrainGenerationInfo {
   // Initialise the tile info array
   const tileInfoArray = new Array<Array<Partial<TileInfo>>>();
   for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
      tileInfoArray.push(new Array<TileInfo>(SETTINGS.BOARD_DIMENSIONS));

      for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
         tileInfoArray[x][y] = {};
      }
   }

   generateBiomeInfo(tileInfoArray);

   // Generate rivers
   const riverTiles = generateRiverTiles();

   const riverFlowDirections: Record<number, Record<number, number>> = {};

   for (const waterTileGenerationInfo of riverTiles) {
      tileInfoArray[waterTileGenerationInfo.tileX][waterTileGenerationInfo.tileY].biomeName = "river";

      if (!riverFlowDirections.hasOwnProperty(waterTileGenerationInfo.tileX)) {
         riverFlowDirections[waterTileGenerationInfo.tileX] = {};
      }
      riverFlowDirections[waterTileGenerationInfo.tileX][waterTileGenerationInfo.tileY] = waterTileGenerationInfo.flowDirection;
   }


   const waterRocks = new Array<WaterRockData>();

   for (const tile of riverTiles) {
      if (Math.random() < 0.075) {
         const x = (tile.tileX + Math.random()) * SETTINGS.TILE_SIZE;
         const y = (tile.tileY + Math.random()) * SETTINGS.TILE_SIZE;
         waterRocks.push({
            position: [x, y],
            rotation: 2 * Math.PI * Math.random(),
            size: randInt(0, 1),
            opacity: Math.random()
         });
      }
   }

   // Calculate potential river crossing positions
   const potentialRiverCrossings = calculateRiverCrossingPositions(riverTiles);

   const riverCrossings = new Array<RiverCrossingInfo>();
   mainLoop:
   for (const crossingInfo of potentialRiverCrossings) {
      if (Math.random() >= 0.15) {
         continue;
      }
      
      // Make sure the crossing isn't too close to another crossing
      for (const otherCrossing of riverCrossings) {
         const dist = Math.sqrt(Math.pow(crossingInfo.startTileX - otherCrossing.startTileX, 2) + Math.pow(crossingInfo.startTileY - otherCrossing.startTileY, 2));
         if (dist < MIN_CROSSING_DISTANCE / SETTINGS.TILE_SIZE) {
            continue mainLoop;
         }
      }

      riverCrossings.push(crossingInfo);
   }

   const riverSteppingStones = new Array<RiverSteppingStoneData>();

   // Generate features for the crossings
   for (const crossing of riverCrossings) {
      const minX = (crossing.startTileX + 0.5) * SETTINGS.TILE_SIZE;
      const maxX = (crossing.endTileX + 0.5) * SETTINGS.TILE_SIZE;
      const minY = (crossing.startTileY + 0.5) * SETTINGS.TILE_SIZE;
      const maxY = (crossing.endTileY + 0.5) * SETTINGS.TILE_SIZE;

      const localCrossingStones = new Array<RiverSteppingStoneData>();

      stoneCreationLoop:
      for (let i = 0; i < NUM_STONE_SPAWN_ATTEMPTS_PER_RIVER; i++) {
         const dist = i / (NUM_STONE_SPAWN_ATTEMPTS_PER_RIVER - 1);
         
         // Start the stone between the start and end of the crossing
         let x = lerp(minX, maxX, dist);
         let y = lerp(minY, maxY, dist);

         const offset = new Vector(RIVER_CROSSING_WIDTH/2, crossing.direction + Math.PI/2).convertToPoint();
         const offsetMultiplier = randFloat(-1, 1);
         x += offset.x * offsetMultiplier;
         y += offset.y * offsetMultiplier;

         // Make sure the stepping stone would be in the board
         if (!Board.positionIsInBoard(x, y)) {
            continue;
         }

         // Only spawn stepping stones on water
         const tileX = Math.floor(x / SETTINGS.TILE_SIZE);
         const tileY = Math.floor(y / SETTINGS.TILE_SIZE);
         if (!tileIsWater(tileX, tileY, riverTiles)) {
            continue;
         }

         const stoneSize: RiverSteppingStoneSize = randInt(0, 2);
         const radius = RIVER_STEPPING_STONE_SIZES[stoneSize]/2;

         // Don't overlap with existing stones in the crossing
         for (const stone of localCrossingStones) {
            const dist = Math.sqrt(Math.pow(x - stone.position[0], 2) + Math.pow(y - stone.position[1], 2));
            if (dist - RIVER_STEPPING_STONE_SIZES[stone.size]/2 - radius < RIVER_STEPPING_STONE_SPACING) {
               continue stoneCreationLoop;
            }
         }

         const data: RiverSteppingStoneData = {
            position: [x, y],
            size: stoneSize,
            rotation: 2 * Math.PI * Math.random()
         };
         localCrossingStones.push(data);
         riverSteppingStones.push(data);
      }

      // Create water rocks
      const crossingDist = Math.sqrt(Math.pow(minX - maxX, 2) + Math.pow(minY - maxY, 2));
      const numWaterRocks = Math.floor(crossingDist / 6);
      for (let i = 0; i < numWaterRocks; i++) {
         const dist = Math.random();
         
         let x = lerp(minX, maxX, dist);
         let y = lerp(minY, maxY, dist);

         const offset = new Vector(RIVER_CROSSING_WATER_ROCK_WIDTH/2, crossing.direction + Math.PI/2).convertToPoint();
         const offsetMultiplier = randFloat(-1, 1);
         x += offset.x * offsetMultiplier;
         y += offset.y * offsetMultiplier;

         if (!Board.positionIsInBoard(x, y)) {
            continue;
         }

         // Only generate water rocks in water
         const tileX = Math.floor(x / SETTINGS.TILE_SIZE);
         const tileY = Math.floor(y / SETTINGS.TILE_SIZE);
         if (!tileIsWater(tileX, tileY, riverTiles)) {
            continue;
         }

         waterRocks.push({
            position: [x, y],
            size: randInt(0, 1),
            rotation: 2 * Math.PI * Math.random(),
            opacity: Math.random()
         });
      }
   }

   generateTileInfo(tileInfoArray);

   // Make an array of tiles from the tile info array
   const tiles = new Array<Array<Tile>>();
   for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
      tiles[x] = new Array<Tile>();
      for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
         // Create the tile
         const tileInfo = tileInfoArray[x][y] as TileInfo;
         tiles[x][y] = new Tile(x, y, tileInfo.type, tileInfo.biomeName, tileInfo.isWall);
      }
   }

   return {
      tiles: tiles,
      waterRocks: waterRocks,
      riverSteppingStones: riverSteppingStones,
      riverFlowDirections: riverFlowDirections
   };
}

export default generateTerrain;