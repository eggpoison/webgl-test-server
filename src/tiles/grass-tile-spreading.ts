import { SETTINGS } from "webgl-test-shared";
import Tile from "./Tile";
import Board from "../Board";

const OFFSETS: ReadonlyArray<[xOffest: number, yOffset: number]> = [
   [-1, -1],
   [0, -1],
   [1, -1],
   [-1, 0],
   [1, 0],
   [-1, 1],
   [0, 1],
   [1, 1],
];

export function attemptToSpreadGrassTile(grassTile: Tile): void {
   // if (Math.random() < 0.05 / SETTINGS.TPS) {
   if (Math.random() < 0.2 / SETTINGS.TPS) {
      for (const offset of OFFSETS) {
         const tileX = grassTile.x + offset[0];
         const tileY = grassTile.y + offset[1];
         if (!Board.tileIsInBoard(tileX, tileY)) {
            continue;
         }

         const tile = Board.getTile(tileX, tileY);
         if (tile.type === "dirt") {
            new Tile(tileX, tileY, "grass", "grasslands", false);
         }
      }
   }
}