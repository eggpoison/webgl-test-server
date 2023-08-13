import { Point, SETTINGS, clampToBoardDimensions } from "webgl-test-shared";
import { TileCoordinates } from "../tiles/Tile";
import { generateOctavePerlinNoise } from "../perlin-noise";
import Board from "../Board";

/*
 HOW IT WORKS
--------------

*/

const NUM_RIVERS = 20;

const NEIGHBOUR_TILE_OFFSETS: ReadonlyArray<[xOffset: number, yOffset: number]> = [
   [1, 1],
   [1, 0],
   [1, -1],
   [0, -1],
   [0, 1],
   [-1, 1],
   [-1, 0],
   [-1, -1]
];

/** Amount of tiles of padding around the edge of the border */
const BORDER_PADDING = 5;

export interface WaterTileGenerationInfo {
   readonly tileX: number;
   readonly tileY: number;
   readonly flowDirection: number;
}

export function generateRiverTiles(): ReadonlyArray<WaterTileGenerationInfo> {
   const rootTiles = new Array<WaterTileGenerationInfo>();

   for (let i = 0; i < NUM_RIVERS; i++) {
      const riverNoise = generateOctavePerlinNoise(SETTINGS.BOARD_DIMENSIONS + BORDER_PADDING * 2, SETTINGS.BOARD_DIMENSIONS + BORDER_PADDING * 2, 200, 5, 2, 0.5);

      let maxWeight = -1;
      let currentTileCoordinates!: TileCoordinates;
      for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
         for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
            const weight = riverNoise[x + BORDER_PADDING][y + BORDER_PADDING];
            if (weight > maxWeight) {
               maxWeight = weight;
               currentTileCoordinates = {
                  x: x,
                  y: y
               };
            }
         }  
      }

      while (true) {
         // Move to neighbour tile with lowest weight
         let minWeight = riverNoise[currentTileCoordinates.x + BORDER_PADDING][currentTileCoordinates.y + BORDER_PADDING];
         let minTileCoordinates: TileCoordinates | undefined;
         let secondMinTileCoordinates: TileCoordinates | undefined;
         for (const offset of NEIGHBOUR_TILE_OFFSETS) {
            const tileX = currentTileCoordinates.x + offset[0];
            const tileY = currentTileCoordinates.y + offset[1];
            if (tileX < -BORDER_PADDING || tileX >= SETTINGS.BOARD_DIMENSIONS + BORDER_PADDING || tileY < -BORDER_PADDING || tileY >= SETTINGS.BOARD_DIMENSIONS + BORDER_PADDING) {
               continue;
            }
            const weight = riverNoise[tileX + BORDER_PADDING][tileY + BORDER_PADDING];
            if (weight < minWeight) {
               minWeight = weight;
               secondMinTileCoordinates = minTileCoordinates;
               minTileCoordinates = {
                  x: tileX,
                  y: tileY
               };
            }
         }

         if (typeof minTileCoordinates === "undefined") {
            break;
         }

         let flowDirection: number;
         if (rootTiles.length > 0 && typeof secondMinTileCoordinates !== "undefined" && Math.random() < 0.3) {
            minTileCoordinates = secondMinTileCoordinates;
            flowDirection = rootTiles[rootTiles.length - 1].flowDirection;
         } else {
            const startPos = new Point(currentTileCoordinates.x, currentTileCoordinates.y);
            const endPos = new Point(minTileCoordinates.x, minTileCoordinates.y);
            flowDirection = startPos.calculateAngleBetween(endPos);
         }

         if (Board.tileIsInBoard(currentTileCoordinates.x, currentTileCoordinates.y)) {
            rootTiles.push({
               tileX: currentTileCoordinates.x,
               tileY: currentTileCoordinates.y,
               flowDirection: flowDirection
            });
         }
         currentTileCoordinates = minTileCoordinates;
      }

      if (Board.tileIsInBoard(currentTileCoordinates.x, currentTileCoordinates.y)) {
         rootTiles.push({
            tileX: currentTileCoordinates.x,
            tileY: currentTileCoordinates.y,
            flowDirection: rootTiles[rootTiles.length - 2].flowDirection
         });
      }
   }

   const tiles = new Array<WaterTileGenerationInfo>();
   
   for (const rootTile of rootTiles) {
      const minTileX = clampToBoardDimensions(rootTile.tileX - 1);
      const maxTileX = clampToBoardDimensions(rootTile.tileX + 1);
      const minTileY = clampToBoardDimensions(rootTile.tileY - 1);
      const maxTileY = clampToBoardDimensions(rootTile.tileY + 1);
      for (let x = minTileX; x <= maxTileX; x++) {
         outerLoop: for (let y = minTileY; y <= maxTileY; y++) {
            // Make sure the tile isn't already in the tiles array
            for (const tile of tiles) {
               if (tile.tileX === x && tile.tileY === 0) {
                  continue outerLoop;
               }
            }
            tiles.push({
               tileX: x,
               tileY: y,
               flowDirection: rootTile.flowDirection
            });
         }
      }
   }

   return tiles;
}