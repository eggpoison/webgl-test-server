import { Point, SETTINGS, Vector, randFloat } from "webgl-test-shared";
import { TileCoordinates } from "../tiles/Tile";
import Board from "../Board";

/*
 HOW IT WORKS
--------------

*/

const NUM_RIVERS = 5;

const MAX_RIVER_LENGTH = 100;

const generateRiverStartPosition = (): Point => {
   const x = randFloat(0, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);
   const y = randFloat(0, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1);
   return new Point(x, y);
}

const generateTileCoordinatesFromPosition = (position: Point): TileCoordinates => {
   return {
      x: Math.floor(position.x / SETTINGS.TILE_SIZE),
      y: Math.floor(position.y / SETTINGS.TILE_SIZE)
   };
}

export function generateRiverTiles(): ReadonlyArray<TileCoordinates> {
   const allRiverTiles = new Array<TileCoordinates>();
   
   for (let i = 0; i < NUM_RIVERS; i++) {
      let currentPosition = generateRiverStartPosition();

      const riverTiles = new Array<TileCoordinates>();
      riverTiles.push(generateTileCoordinatesFromPosition(currentPosition));
      
      let riverFlowDirection = 2 * Math.PI * Math.random();
      for (let j = 0; j < MAX_RIVER_LENGTH; j++) {
         riverFlowDirection += Math.random() * 0.5;
         const offset = new Vector(SETTINGS.TILE_SIZE, riverFlowDirection).convertToPoint();
         currentPosition.add(offset);

         if (!Board.isInBoard(currentPosition)) {
            break;
         }

         const tile = generateTileCoordinatesFromPosition(currentPosition);
         riverTiles.push(tile);
      }

      for (const tile of riverTiles) {
         allRiverTiles.push(tile);
      }
   }

   return allRiverTiles;
}