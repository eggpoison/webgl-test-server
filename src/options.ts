interface Options {
   readonly spawnEntities: boolean;
   readonly spawnTribes: boolean;
   readonly warp: boolean;
   readonly generateRivers: boolean;
   readonly inBenchmarkMode: boolean
}

const OPTIONS: Options = {
   spawnEntities: true,
   spawnTribes: false,
   generateRivers: false,
   inBenchmarkMode: false,
   warp: true
};

export default OPTIONS;