import { BiomeName, TileTypeConst } from "webgl-test-shared";
import { addTileToCensus } from "./census";

export interface TileCoordinates {
   readonly x: number;
   readonly y: number;
}

class Tile {
   // @Memory: Unnecessary, don't store these
   public readonly x: number;
   public readonly y: number;

   public type: TileTypeConst;
   // @Memory @Cleanup: Might be unnecessary if we can just infer the biome from the tile type.
   public biomeName: BiomeName;
   public isWall: boolean;

   public riverFlowDirection: number;

   constructor(x: number, y: number, tileType: TileTypeConst, biomeName: BiomeName, isWall: boolean, riverFlowDirection: number) {
      this.x = x;
      this.y = y;

      this.type = tileType;
      this.biomeName = biomeName;
      this.isWall = isWall;
      this.riverFlowDirection = riverFlowDirection;

      addTileToCensus(this);
   }
}

export default Tile;