import Tile, { TileType } from "webgl-test-shared/lib/Tile";
import SETTINGS from "webgl-test-shared/lib/settings";

function generateTerrain(): Array<Array<Tile>> {
   const tiles = new Array<Array<Tile>>(SETTINGS.DIMENSIONS);

   for (let x = 0; x < SETTINGS.DIMENSIONS; x++) {
      tiles[x] = new Array<Tile>(SETTINGS.DIMENSIONS);

      for (let y = 0; y < SETTINGS.DIMENSIONS; y++) {
         tiles[x][y] = (
            new Tile({
               type: TileType.grass,
               biome: "grasslands",
               isWall: false
            })
         );
      }
   }

   return tiles;
}

export default generateTerrain;