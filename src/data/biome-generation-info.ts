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

export type BiomeSpawnRequirements = {
   readonly minHeight?: number;
   readonly maxHeight?: number;
   readonly minTemperature?: number;
   readonly maxTemperature?: number;
   readonly minHumidity?: number;
   readonly maxHumidity?: number;
}

export type BiomeGenerationInfo = {
   readonly spawnRequirements: BiomeSpawnRequirements | null;
   readonly tiles: ReadonlyArray<TileGenerationInfo>;
}

const BIOME_GENERATION_INFO: Record<BiomeName, BiomeGenerationInfo> = {
   magmaFields: {
      spawnRequirements: null,
      tiles: [
         {
            tileType: "lava",
            isWall: false,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.2
            },
            minDist: 3
         },
         {
            tileType: "magma",
            isWall: false
         }
      ]
   },
   tundra: {
      spawnRequirements: {
         maxTemperature: 0.3,
         maxHumidity: 0.5
      },
      tiles: [
         {
            tileType: "permafrost",
            isWall: false,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.2,
            },
            minDist: 6
         },
         {
            tileType: "ice",
            isWall: false,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.65,
            },
            minDist: 1
         },
         {
            tileType: "snow",
            isWall: false
         }
      ]
   },
   desert: {
      spawnRequirements: {
         minTemperature: 0.7,
         maxHumidity: 0.5
      },
      tiles: [
         {
            tileType: "sandstone",
            isWall: true,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.6
            },
            minDist: 2
         },
         {
            tileType: "sandstone",
            isWall: false,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.5
            },
            minDist: 1
         },
         {
            tileType: "sand",
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
            tileType: "rock",
            isWall: true,
            noiseRequirements: {
               scale: 7,
               minWeight: 0.8,
            },
            minDist: 2
         },
         {
            tileType: "rock",
            isWall: false
         }
      ]
   },
   swamp: {
      spawnRequirements: {
         // minTemperature: 0.7,
         // minHumidity: 0.8
         minTemperature: 0.5,
         minHumidity: 0.8
      },
      tiles: [
         {
            tileType: "slime",
            isWall: false,
            noiseRequirements: {
               scale: 2.5,
               minWeight: 0.2
            },
            minDist: 4
         },
         {
            tileType: "slime",
            isWall: false,
            noiseRequirements: {
               scale: 2.5,
               minWeight: 0.6
            },
            minDist: 2
         },
         {
            tileType: "sludge",
            isWall: false
         }
         // {
         //    info: {
         //       type: "sludge",
         //       isWall: false
         //    },
         //    minWeight: 0.25,
         //    minDist: 3
         // },
         // {
         //    info: {
         //       type: "sludge",
         //       isWall: false
         //    },
         //    minWeight: 0.4,
         //    minDist: 2
         // },
         // {
         //    info: {
         //       type: "sludge",
         //       isWall: false
         //    },
         //    minWeight: 0.6,
         //    minDist: 1
         // },
         // {
         //    info: {
         //       type: "dirt",
         //       isWall: false
         //    }
         // }
      ]
   },
   grasslands: {
      spawnRequirements: {},
      tiles: [
         {
            tileType: "grass",
            isWall: false
         }
      ]
   }
};

export default BIOME_GENERATION_INFO;