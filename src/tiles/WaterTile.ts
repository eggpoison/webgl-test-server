import { TileInfo } from "webgl-test-shared";
import Tile from "./Tile";

class WaterTile extends Tile {
   public flowDirection: number = 0;
   public flowForce: number = 50;

   constructor(x: number, y: number, tileInfo: TileInfo) {
      super(x, y, tileInfo);
   }
}

export default WaterTile;