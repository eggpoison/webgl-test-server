import { TileType, BiomeName, TileInfo } from "webgl-test-shared";
import Board from "./Board";
import { addTileToCensus, removeTileFromCensus } from "./census";

export interface TileCoordinates {
   readonly x: number;
   readonly y: number;
}

class Tile implements TileInfo {
   public readonly x: number;
   public readonly y: number;

   public readonly type: TileType;
   public readonly biomeName: BiomeName;
   public readonly isWall: boolean;

   constructor(x: number, y: number, tileType: TileType, biomeName: BiomeName, isWall: boolean) {
      this.x = x;
      this.y = y;

      this.type = tileType;
      this.biomeName = biomeName;
      this.isWall = isWall;

      addTileToCensus(this);

      if (Board.terrainHasBeenGenerated()) {
         // Remove the previous tile from the census
         const previousTile = Board.getTile(x, y);
         removeTileFromCensus(previousTile);
         
         // Add the tile to the tile array
         Board.setTile(x, y, this);

         Board.registerNewTileUpdate(x, y);
      }
   }
   /** Runs every time a tile receives a random tick */
   public onRandomTick?(): void;
}

export default Tile;