import { Server, Socket } from "socket.io";
import { Point, SETTINGS, Tile, VisibleChunkBounds } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import { runSpawnAttempt } from "./entity-spawning";
import Player from "./entities/Player";
import Board from "./Board";

/*

Server is responsible for:
- Entities
   - Entity spawning
   - Entity AI
- RNG, randomness

When a client connects, send:
- Game ticks
- Tiles

Components:
- Render component (client)
- AI component (server)
- Health component (server)
- Hitbox component (server)

Each tick, send:
- Entity data
   - New entities
   - Existing entity updates
   - Removed entities


Tasks:
* Start game instance
* Start the server

*/

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type EntityData = {
   readonly id: number;
}

type NewEntityData = {
   readonly id: number;
}

type ChangedEntityData = {
   readonly id: number;
}

export type EntityCensus = {
   readonly newEntities: Array<NewEntityData>;
   readonly changedEntities: Array<ChangedEntityData>;
   /** Array of all removed entities' id's */
   readonly removedEntities: Array<number>;
}

type PlayerData = {
   readonly clientEntityIDs: Array<number>;
   readonly position: Point;
   readonly instance: Player;
   /** Bounds of where the player can see on their screen */
   readonly visibleChunkBounds: VisibleChunkBounds;
}

class GameServer {
   private ticks: number = 0;

   public readonly board: Board;

   private readonly io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

   private readonly playerData: Record<string, PlayerData> = {};

   constructor() {
      // Create the board
      this.board = new Board();

      // Start the server
      this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
      this.handlePlayerConnections();
      console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);

      setInterval(() => this.tick(), 1000 / SETTINGS.TPS);

      setTimeout(() => {
         const tester = new Player(new Point(200, 200), "test player");
         SERVER.board.addEntity(tester);
      }, 1000);
   }

   private handlePlayerConnections(): void {
      this.io.on("connection", (socket: ISocket) => {
         console.log("New player connected");

         // Send game data
         socket.emit("initialGameData", this.ticks, this.board.tiles);

         // Receive initial player data
         socket.on("initialPlayerData", (name: string, position: [number, number], visibleChunkBounds: VisibleChunkBounds) => {
            this.addPlayer(socket, name, position, visibleChunkBounds);
         });
      });
   }

   private async tick(): Promise<void> {
      this.ticks++;

      const entityData: EntityCensus = {
         newEntities: new Array<NewEntityData>(),
         changedEntities: new Array<ChangedEntityData>(),
         removedEntities: new Array<number>()
      }

      this.board.tickEntities(entityData);

      // runSpawnAttempt();

      // Send game data packets to all players
      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
         // Skip sockets which haven't been properly loaded yet
         if (!this.playerData.hasOwnProperty(socket.id)) continue;

         const playerData = this.playerData[socket.id];
         
         const nearbyEntities = this.board.getPlayerNearbyEntities(playerData.instance, playerData.visibleChunkBounds);
      }
   }

   private addPlayer(socket: ISocket, name: string, position: [number, number], visibleChunkBounds: VisibleChunkBounds): void {
      // Create the player entity
      const pointPosition = new Point(...position);
      const player = new Player(pointPosition, name);
      this.board.addEntity(player);

      // Initialise the player's gamedata record
      this.playerData[socket.id] = {
         clientEntityIDs: new Array<number>(),
         position: pointPosition,
         instance: player,
         visibleChunkBounds: visibleChunkBounds
      };
   }
}

export let SERVER: GameServer;

/** Starts the game server */
const startServer = (): void => {
   // Create the gmae server
   SERVER = new GameServer();
}

startServer();

// const messageHistory = new Array<string>();

// const getPlayerPosition = (socket: ISocket | RemoteSocket<ServerToClientEvents, SocketData>): Promise<[number, number]> => {
//    return new Promise(resolve => {
//       socket.emit("position");

//       if (!playerPositionRequests.hasOwnProperty(socket.id)) {
//          playerPositionRequests[socket.id] = [];
//       }

//       // Add the request
//       playerPositionRequests[socket.id].push(
//          (playerPosition: [number, number]): void => {
//             resolve(playerPosition);
//          }
//       );
//    });
// }

// const getSocketData = (socket: ISocket | RemoteSocket<ServerToClientEvents, SocketData>): Promise<SocketData> => {
//    return new Promise(async resolve => {
//       const name = socket.data.name!;
      
//       const position = await getPlayerPosition(socket);
      
//       const socketData: SocketData = {
//          name: name,
//          position: position,
//          clientID: socket.id
//       };
//       resolve(socketData);
//    });
// }

// io.on("connection", async socket => {
//    // Log the new client
//    console.log(`New client: ${socket.id}`);

//    if (SERVER.tiles === null) {
//       throw new Error("Tiles haven't been generated when client attempted to join!");
//    }

//    // Send the tiles to the client
//    socket.emit("terrain", SERVER.tiles);

//    socket.on("socketData", async (socketData: SocketData) => {
//       socket.data.name = socketData.name;
//       socket.data.position = socketData.position;

//       const clients = await io.fetchSockets();

//       // Send the socket data to all other players
//       for (const client of clients) {
//          if (client.id === socket.id) continue;

//          client.emit("newPlayer", socketData);
//       }
      
//       // Send existing players to the client
//       for (const client of clients) {
//          if (client.id === socket.id) continue;

//          const currentPlayerSocketData = await getSocketData(client);
//          socket.emit("newPlayer", currentPlayerSocketData);
//       }
//    });

//    // Push any player movement packets to all other clients
//    socket.on("playerMovement", async (movementHash: number) => {
//       const clients = await io.fetchSockets();

//       for (const client of clients) {
//          // Don't send the chat message to the socket sending it
//          if (client.id === socket.id) continue;

//          client.emit("playerMovement", socket.id, movementHash);
//       }
//    });

//    socket.on("position", (position: [number, number]) => {
//       if (!playerPositionRequests.hasOwnProperty(socket.id)) return;

//       for (const request of playerPositionRequests[socket.id]) request(position);
//       playerPositionRequests[socket.id] = [];
//    });

//    // Push any chat messages to all other clients
//    socket.on("chatMessage", async (chatMessage: string) => {
//       messageHistory.push(chatMessage);

//       const clients = await io.fetchSockets();
//       for (const client of clients) {
//          // Don't send the chat message to the socket sending it
//          if (client.id === socket.id) continue;

//          client.emit("chatMessage", socket.data.name!, chatMessage);
//       }
//    });

//    // Log whenever a client disconnects from the server
//    socket.on("disconnect", async () => {
//       console.log(`Client disconnected: ${socket.id}`);

//       // Send a disconnect packet to all other players
//       const clients = await io.fetchSockets();
//       for (const client of clients) {
//          client.emit("clientDisconnect", socket.id);
//       }
//    });
// });

// type PacketName = keyof ServerToClientEvents;

// export async function pushPacket<P extends PacketName>(packetName: P, packet: Parameters<ServerToClientEvents[P]>): Promise<void> {
//    const clients = await io.fetchSockets();
//    for (const client of clients) {
//       client.emit(packetName, ...packet);
//    }
// }

// startServer();
// startReadingInput();