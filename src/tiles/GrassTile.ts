import { SETTINGS } from "webgl-test-shared";
import DirtTile from "./DirtTile";
import Tile from "./Tile";
import { SERVER } from "../server";

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

class GrassTile extends Tile {
   public onRandomTick(): void {
      for (const offset of OFFSETS) {
         const tileX = this.x + offset[0];
         if (tileX < 0 || tileX >= SETTINGS.BOARD_DIMENSIONS) continue;
         const tileY = this.y + offset[1];
         if (tileY < 0 || tileY >= SETTINGS.BOARD_DIMENSIONS) continue;

         const tile = SERVER.board.getTile(tileX, tileY);
         if (tile.type === "dirt") {
            (tile as DirtTile).incrementGrowProgress();
         }
      }
   }
}

export default GrassTile;