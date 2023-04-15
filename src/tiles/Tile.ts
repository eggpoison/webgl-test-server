import { TileType, BiomeName, TileInfo } from "webgl-test-shared";
import { SERVER } from "../server";
import { terrainHasBeenGenerated } from "../terrain-generation";
import { addTileToCensus, removeTileFromCensus } from "../entity-spawning";

abstract class Tile implements TileInfo {
   public readonly x: number;
   public readonly y: number;

   public readonly type: TileType;
   public readonly biomeName: BiomeName;
   public readonly isWall: boolean;

   constructor(x: number, y: number, tileInfo: TileInfo) {
      this.x = x;
      this.y = y;

      this.type = tileInfo.type;
      this.biomeName = tileInfo.biomeName;
      this.isWall = tileInfo.isWall;

      addTileToCensus(this.type);

      if (terrainHasBeenGenerated) {
         // Remove the previous tile from the census
         const previousTile = SERVER.board.getTile(x, y);
         removeTileFromCensus(previousTile.type);
         
         // Add the tile to the tile array
         SERVER.board.setTile(x, y, this);

         SERVER.board.registerNewTileUpdate(x, y);
      }
   }
   /** Runs every time a tile receives a random tick */
   public onRandomTick?(): void;
}

export default Tile;