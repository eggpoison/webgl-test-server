interface Options {
   readonly spawnEntities: boolean;
   readonly spawnTribes: boolean;
   readonly warp: boolean;
   readonly generateRivers: boolean;
   readonly inBenchmarkMode: boolean
}

const OPTIONS: Options = {
   spawnEntities: true,
   spawnTribes: true,
   generateRivers: true,
   inBenchmarkMode: false,
   warp: false
};

export default OPTIONS;