import { Point, SETTINGS } from "webgl-test-shared";
import Board from "./Board";
import Tile from "./tiles/Tile";

/** Gets all tiles within a given distance from a position */
export function getPositionRadialTiles(position: Point, radius: number): Array<Tile> {
   const tiles = new Array<Tile>();

   const minTileX = Math.max(Math.min(Math.floor((position.x - radius) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
   const maxTileX = Math.max(Math.min(Math.floor((position.x + radius) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
   const minTileY = Math.max(Math.min(Math.floor((position.y - radius) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
   const maxTileY = Math.max(Math.min(Math.floor((position.y + radius) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);

   const radiusSquared = Math.pow(radius, 2);

   for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
         const tile = Board.getTile(tileX, tileY);

         // Don't try to wander to wall tiles or water
         if (tile.isWall || tile.type === "water") continue;

         const distanceSquared = Math.pow(position.x - tileX * SETTINGS.TILE_SIZE, 2) + Math.pow(position.y - tileY * SETTINGS.TILE_SIZE, 2);
         if (distanceSquared <= radiusSquared) {
            tiles.push(tile);
         }
      }
   }

   return tiles;
}