interface Options {
   readonly spawnEntities: boolean;
   readonly spawnTribes: boolean;
   readonly generateRivers: boolean;
   readonly generateWalls: boolean;
   readonly inBenchmarkMode: boolean
   readonly logging: boolean;
   readonly warp: boolean;
}

// @Speed: Make into const enum
const OPTIONS: Options = {
   spawnEntities: true,
   spawnTribes: true,
   generateRivers: true,
   generateWalls: true,
   inBenchmarkMode: true,
   logging: false,
   warp: true
};


export default OPTIONS;