import { Server, Socket } from "socket.io";
import { Point, SETTINGS, Tile } from "webgl-test-shared";
import generateTerrain from "./terrain-generation";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import { runSpawnAttempt } from "./entity-spawning";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Player from "./entities/Player";

/*

Server is responsible for:
- Entities
   - Entity spawning
   - Entity AI
- RNG, randomness

When a client connects, send:
- Game ticks
- Tiles
- 

Components:
- Render component (client)
- AI component (server)
- Health component (server)
- Hitbox component (server)


Tasks:
* Start game instance
* Start the server

*/

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

class GameServer {
   private ticks: number = 0;

   private readonly tiles: Array<Array<Tile>>;
   public readonly chunks: Array<Array<Chunk>>;

   private readonly io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

   constructor() {
      this.tiles = generateTerrain();
      console.log("Terrain generated");

      this.chunks = this.initialiseChunks();

      // Start the server
      this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
      this.handlePlayerConnections();
      console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);

      setInterval(this.tick, 1000 / SETTINGS.TPS);
   }

   private initialiseChunks(): Array<Array<Chunk>> {
      const chunks = new Array<Array<Chunk>>(SETTINGS.BOARD_SIZE);

      for (let x = 0; x < SETTINGS.BOARD_SIZE; x++) {
         chunks[x] = new Array<Chunk>(SETTINGS.BOARD_SIZE);
         for (let y = 0; y < SETTINGS.BOARD_SIZE; y++) {
            chunks[x][y] = new Chunk();
         }
      }

      return chunks;
   }

   private handlePlayerConnections(): void {
      this.io.on("connection", (socket: ISocket) => {
         console.log("New player connected");

         // Receive initial player data
         socket.on("initialPlayerData", (name: string, position: [number, number]) => {
            this.addPlayer(name, position);
         });
      });
   }

   private tick(): void {
      this.ticks++;

      this.tickEntities();

      runSpawnAttempt();
   }

   private tickEntities(): void {
      const entityChunkChanges = new Array<[entity: Entity, previousChunk: Chunk, newChunk: Chunk]>();

      for (let x = 0; x < SETTINGS.BOARD_SIZE; x++) {
         for (let y = 0; x < SETTINGS.BOARD_SIZE; y++) {
            const chunk = this.chunks[x][y];

            const entities = chunk.getEntities().slice();
            for (const entity of entities) {
               entity.tick();

               // If the entity has changed chunks, add it to the list
               const newChunk = entity.findContainingChunk();
               if (newChunk !== entity.previousChunk) {
                  entityChunkChanges.push([entity, entity.previousChunk, newChunk]);
               }
            }
         }
      }

      // Apply entity chunk changes
      for (const [entity, previousChunk, newChunk] of entityChunkChanges) {
         previousChunk.removeEntity(entity);
         newChunk.addEntity(entity);

         entity.previousChunk = newChunk;
      }
   }

   private addPlayer(name: string, position: [number, number]): void {
      const pointPosition = new Point(...position);
      const player = new Player(pointPosition, name);
      this.addEntity(player);
   }

   public addEntity(entity: Entity): void {
      const chunk = entity.findContainingChunk();
      chunk.addEntity(entity);

      entity.previousChunk = chunk;
   }
}

export let SERVER: GameServer;

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

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