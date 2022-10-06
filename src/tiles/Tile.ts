import { TileType, BiomeName, TileInfo } from "webgl-test-shared";

abstract class Tile {
   public readonly x: number;
   public readonly y: number;

   public readonly type: TileType;
   public biome: BiomeName;
   public isWall: boolean;

   constructor(x: number, y: number, { type, biome, isWall }: TileInfo) {
      this.x = x;
      this.y = y;

      this.type = type;
      this.biome = biome;
      this.isWall = isWall;
   }
   /** Runs every time a tile receives a random tick */
   public onRandomTick?(): void;
}

export default Tile; 