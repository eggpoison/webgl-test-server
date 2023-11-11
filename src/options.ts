interface Options {
   readonly spawnEntities: boolean;
   readonly spawnTribes: boolean;
   readonly generateRivers: boolean;
   readonly generateWalls: boolean;
   readonly inBenchmarkMode: boolean
   readonly logging: boolean;
   readonly warp: boolean;
}

const OPTIONS: Options = {
   spawnEntities: true,
   spawnTribes: true,
   generateRivers: false,
   generateWalls: true,
   inBenchmarkMode: false,
   logging: false,
   warp: false
};

export default OPTIONS;