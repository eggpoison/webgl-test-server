import { TileInfo } from "webgl-test-shared";
import { SERVER } from "../server";
import Tile from "./Tile";

class DirtTile extends Tile {
   /** Amount of grow progress required to become a grass tile */
   private static readonly GROW_PROGRESS_REQUIREMENT = 5;

   /** Progress the dirt tile has to becoming a grass tile */
   private growProgress = 0;

   public incrementGrowProgress(): void {
      if (++this.growProgress === DirtTile.GROW_PROGRESS_REQUIREMENT) {
         this.grow();
      }
   }

   private grow(): void {
      const newTileInfo: TileInfo = {
         type: "grass",
         biome: this.biome,
         isWall: this.isWall
      };
      SERVER.board.changeTile(this.x, this.y, newTileInfo);
   }
}

export default DirtTile;