import { DecorationInfo, DecorationType, SETTINGS, TileTypeConst } from "webgl-test-shared";

interface DecorationGenerationInfo {
   readonly decorationType: DecorationType;
   readonly spawnableTileTypes: ReadonlyArray<TileTypeConst>;
   readonly spawnChancePerTile: number;
}
// rock,
// sandstoneRock,
// blackRock,
// snowPile,
// flower1,
// flower2,
// flower3,
// flower4

export function generateDecorations(tileTypeArray: ReadonlyArray<ReadonlyArray<TileTypeConst>>): ReadonlyArray<DecorationInfo> {
   const DECORATION_GENERATION_INFO: ReadonlyArray<DecorationGenerationInfo> = [
      {
         decorationType: DecorationType.pebble,
         spawnableTileTypes: [TileTypeConst.grass],
         spawnChancePerTile: 0.007
      },
      {
         decorationType: DecorationType.rock,
         spawnableTileTypes: [TileTypeConst.grass, TileTypeConst.rock],
         spawnChancePerTile: 0.003
      },
      {
         decorationType: DecorationType.sandstoneRock,
         spawnableTileTypes: [TileTypeConst.sand],
         spawnChancePerTile: 0.02
      },
      {
         decorationType: DecorationType.blackRock,
         spawnableTileTypes: [TileTypeConst.snow, TileTypeConst.permafrost],
         spawnChancePerTile: 0.02
      },
      {
         decorationType: DecorationType.snowPile,
         spawnableTileTypes: [TileTypeConst.snow, TileTypeConst.permafrost],
         spawnChancePerTile: 0.02
      },
      {
         decorationType: DecorationType.flower1,
         spawnableTileTypes: [TileTypeConst.grass],
         spawnChancePerTile: 0.0015
      },
      {
         decorationType: DecorationType.flower2,
         spawnableTileTypes: [TileTypeConst.grass],
         spawnChancePerTile: 0.0015
      },
      {
         decorationType: DecorationType.flower3,
         spawnableTileTypes: [TileTypeConst.grass],
         spawnChancePerTile: 0.0015
      },
      {
         decorationType: DecorationType.flower4,
         spawnableTileTypes: [TileTypeConst.grass],
         spawnChancePerTile: 0.0015
      }
   ];

   const getDecorationType = (tileType: TileTypeConst): DecorationType | 99999 => {
      for (let k = 0; k < DECORATION_GENERATION_INFO.length; k++) {
         const generationInfo = DECORATION_GENERATION_INFO[k];
         if (generationInfo.spawnableTileTypes.includes(tileType)) {
            if (Math.random() < generationInfo.spawnChancePerTile) {
               return generationInfo.decorationType;
            }
         }
      }

      return 99999;
   }

   // @Speed: Triple-nested loop, and a whole bunch of continues (unnecessary iterations)!!
   const decorations = new Array<DecorationInfo>();
   for (let i = 0; i < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2; i++) {
      for (let j = 0; j < SETTINGS.BOARD_DIMENSIONS + SETTINGS.EDGE_GENERATION_DISTANCE * 2; j++) {
         const tileType = tileTypeArray[i][j];
         const decorationType = getDecorationType(tileType);
         if (decorationType !== 99999) {
            const x = (i - SETTINGS.EDGE_GENERATION_DISTANCE + Math.random()) * SETTINGS.TILE_SIZE;
            const y = (j - SETTINGS.EDGE_GENERATION_DISTANCE + Math.random()) * SETTINGS.TILE_SIZE;
            decorations.push({
               positionX: x,
               positionY: y,
               rotation: 2 * Math.PI * Math.random(),
               type: decorationType
            });
         }
      }
   }

   return decorations;
}