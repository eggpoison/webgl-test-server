import { BiomeName, TileInfo } from "webgl-test-shared";

export type TileGenerationInfo = {
   readonly info: Omit<TileInfo, "biome" | "fogAmount">;
   readonly minWeight?: number;
   readonly maxWeight?: number;
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
            info: {
               type: "lava",
               isWall: false
            },
            minWeight: 0.2,
            minDist: 3
         },
         {
            info: {
               type: "magma",
               isWall: false
            }
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
            info: {
               type: "rock",
               isWall: true
            },
            minWeight: 0.8,
            minDist: 4
         },
         {
            info: {
               type: "ice",
               isWall: false
            },
            minWeight: 0.6,
            minDist: 3
         },
         {
            info: {
               type: "snow",
               isWall: false
            }
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
            info: {
               type: "sandstone",
               isWall: true
            },
            minWeight: 0.6,
            minDist: 2
         },
         {
            info: {
               type: "sandstone",
               isWall: false
            },
            minWeight: 0.5,
            minDist: 1
         },
         {
            info: {
               type: "sand",
               isWall: false
            }
         }
      ]
   },
   mountains: {
      spawnRequirements: {
         minHeight: 0.8
      },
      tiles: [
         {
            info: {
               type: "rock",
               isWall: true
            },
            minWeight: 0.8,
            minDist: 2
         },
         {
            info: {
               type: "rock",
               isWall: false
            }
         }
      ]
   },
   swamp: {
      spawnRequirements: {
         minTemperature: 0.7,
         minHumidity: 0.6
      },
      tiles: [
         {
            info: {
               type: "sludge",
               isWall: false
            },
            minWeight: 0.25,
            minDist: 3
         },
         {
            info: {
               type: "sludge",
               isWall: false
            },
            minWeight: 0.4,
            minDist: 2
         },
         {
            info: {
               type: "sludge",
               isWall: false
            },
            minWeight: 0.6,
            minDist: 1
         },
         {
            info: {
               type: "dirt",
               isWall: false
            }
         }
      ]
   },
   grasslands: {
      spawnRequirements: {},
      tiles: [
         {
            info: {
               type: "grass",
               isWall: false
            }
         }
      ]
   }
};

export default BIOME_GENERATION_INFO;