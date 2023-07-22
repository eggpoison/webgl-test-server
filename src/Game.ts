// import { SETTINGS } from "webgl-test-shared";
// import GameServer from "./server";
// import Board from "./Board";
// import { runEntityCensus, runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";

// abstract class Game {
//    /** Number of seconds between each entity census */
//    private static readonly ENTITY_CENSUS_INTERVAL = 60;
   
//    private static ticks: number = 0;

//    /** The time of day the server is currently in (from 0 to 23) */
//    public static time: number = 6;

//    public static board: Board;
   
//    public static server: GameServer;

//    /** Sets up the various stuff */
//    public static setup() {
//       // Create the board
//       this.board = new Board();

//       console.log("doin things");
//       // console.log(this);
//       spawnInitialEntities();

//       // Start the game server
//       this.server = new GameServer();
//       // Only start the server if jest isn't running
//       if (process.env.NODE_ENV !== "test") {
//          this.server.start(() => this.tick());
//       }
//    }

//    private static async tick(): Promise<void> {
//       // Update server ticks and time
//       this.ticks++;
//       this.time = (this.time + SETTINGS.TIME_PASS_RATE / SETTINGS.TPS / 3600) % 24;
      
//       this.board.pushJoinBuffer();

//       this.board.updateGameObjects();
//       this.board.resolveCollisions();

//       // Age items
//       if (this.ticks % SETTINGS.TPS === 0) {
//          this.board.ageItems();
//       }

//       this.board.removeFlaggedGameObjects();

//       // Run entity census
//       if ((this.ticks / SETTINGS.TPS) % Game.ENTITY_CENSUS_INTERVAL === 0) {
//          runEntityCensus();
//       }

//       runSpawnAttempt();

//       this.board.runRandomTickAttempt();

//       // Send game data packets to all players
//       this.server.sendGameDataPackets();
//    }

//    public static getTicks(): number {
//       return this.ticks;
//    }
// };

// // const Game = new GameClass();

// Game.setup();

// export default Game;