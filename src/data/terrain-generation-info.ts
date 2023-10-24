import { BiomeName, TileType } from "webgl-test-shared";

export type TileGenerationInfo = {
   readonly tileType: TileType;
   readonly isWall: boolean;
   readonly noiseRequirements?: {
      readonly scale: number;
      readonly minWeight?: number;
      readonly maxWeight?: number;
   }
   /** The minimum number of tiles from the end of the biome */
   readonly minDist?: number;
   /** The maximum number of tiles from the end of the biome */
   readonly maxDist?: number;
}

export interface BiomeSpawnRequirements {
   readonly minHeight?: number;
   readonly maxHeight?: number;
   readonly minTemperature?: number;
   readonly maxTemperature?: number;
   readonly minHumidity?: number;
   readonly maxHumidity?: number;
}

export interface BiomeGenerationInfo {
   readonly spawnRequirements: BiomeSpawnRequirements | null;
   readonly tiles: ReadonlyArray<TileGenerationInfo>;
}

const BIOME_GENERATION_INFO: Record<BiomeName, BiomeGenerationInfo> = {
   // magmaFields: {
   //    spawnRequirements: null,
   //    tiles: [
   //       {
   //          tileType: TileType.lava,
   //          isWall: false,
   //          noiseRequirements: {
   //             scale: 7,
   //             minWeight: 0.2
   //          },
   //          minDist: 3
   //       },
   //       {
   //          tileType: TileType.magma,
   //          isWall: false
   //       }
   //    ]
   // },
   river: {
      spawnRequirements: null,
      tiles: [
         {
            tileType: TileType.water,
            isWall: false
         }
      ]
   },
   tundra: {
      spawnRequirements: {
         maxTemperature: 0.4,
         maxHumidity: 0.5
      },
      tiles: [
         // {
         //    tileType: TileType.fimbultur,
         //    isWall: false,
         //    noiseRequirements: {
         //       scale: 8,
         //       minWeight: 0.2
         //    },
         //    minDist: 8
         // },
         {
            tileType: TileType.permafrost,
            isWall: false,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.2,
            },
            minDist: 4
         },
         {
            tileType: TileType.ice,
            isWall: false,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.65,
            },
            minDist: 1
         },
         {
            tileType: TileType.snow,
            isWall: false
         }
      ]
   },
   desert: {
      spawnRequirements: {
         minTemperature: 0.6,
         maxHumidity: 0.5
      },
      tiles: [
         {
            tileType: TileType.sandstone,
            isWall: true,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.6
            },
            minDist: 2
         },
         // {
         //    tileType: TileType.sandstone,
         //    isWall: false,
         //    noiseRequirements: {
         //       scale: 7,
         //       minWeight: 0.5
         //    },
         //    minDist: 1
         // },
         {
            tileType: TileType.sand,
            isWall: false
         }
      ]
   },
   mountains: {
      spawnRequirements: {
         minHeight: 0.7
      },
      tiles: [
         {
            // tileType: TileType.rock,
            tileType: TileType.darkRock,
            isWall: true,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.8,
            },
            minDist: 2
         },
         {
            tileType: TileType.rock,
            isWall: false
         }
      ]
   },
   swamp: {
      spawnRequirements: {
         minTemperature: 0.5,
         minHumidity: 0.8
      },
      tiles: [
         {
            tileType: TileType.slime,
            isWall: false,
            noiseRequirements: {
               scale: 2.5,
               minWeight: 0.2
            },
            minDist: 4
         },
         {
            tileType: TileType.slime,
            isWall: false,
            noiseRequirements: {
               scale: 2.5,
               minWeight: 0.6
            },
            minDist: 2
         },
         {
            tileType: TileType.sludge,
            isWall: false
         }
         // {
         //    tileType: TileType.sludge,
         //    isWall: false,
         //    noiseRequirements: {
         //       scale: 5,
         //       minWeight: 0.25
         //    },
         //    minDist: 3
         // },
         // {
         //    tileType: TileType.sludge,
         //    isWall: false,
         //    noiseRequirements: {
         //       scale: 5,
         //       minWeight: 0.4
         //    },
         //    minDist: 2
         // },
         // {
         //    tileType: TileType.sludge,
         //    isWall: false,
         //    noiseRequirements: {
         //       scale: 5,
         //       minWeight: 0.6
         //    },
         //    minDist: 1
         // },
         // {
         //    tileType: TileType.dirt,
         //    isWall: false
         // }
      ]
   },
   grasslands: {
      spawnRequirements: {},
      tiles: [
         {
            tileType: TileType.grass,
            isWall: false
         }
      ]
   }
};

export default BIOME_GENERATION_INFO;