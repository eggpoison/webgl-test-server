import { Server, Socket } from "socket.io";
import { EntityData, EntityType, GameDataPacket, Point, SETTINGS, VisibleChunkBounds } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Player from "./entities/Player";
import Board from "./Board";
import EntitySpawner from "./spawning/EntitySpawner";

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

Each tick, send game data:
- Nearby entities

- Player needs to handle its own wall and tile collisions
- Server needs to handle wall and tile collisions for all entities

Tasks:
* Start game instance
* Start the server

*/

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type PlayerData = {
   readonly clientEntityIDs: Array<number>;
   readonly instance: Player;
   /** Bounds of where the player can see on their screen */
   visibleChunkBounds: VisibleChunkBounds;
}

export type EntityCensus = {
   readonly passiveMobCount: number;
}

class GameServer {
   private ticks: number = 0;

   public readonly board: Board;
   private readonly entitySpawner: EntitySpawner;

   private readonly io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

   private readonly playerData: Record<string, PlayerData> = {};

   constructor() {
      // Create the board
      this.board = new Board();

      // Create the entity spawner
      this.entitySpawner = new EntitySpawner();

      // Start the server
      this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
      this.handlePlayerConnections();
      console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);

      setInterval(() => this.tick(), 1000 / SETTINGS.TPS);
   }

   private handlePlayerConnections(): void {
      this.io.on("connection", (socket: ISocket) => {
         console.log("New client connected: " + socket.id);

         // Send initial game data
         socket.emit("initialGameData", this.ticks, this.board.tiles);

         // Receive initial player data
         socket.on("initialPlayerData", (name: string, position: [number, number], visibleChunkBounds: VisibleChunkBounds) => {
            this.addPlayer(socket, name, position, visibleChunkBounds);
         });

         socket.on("newVisibleChunkBounds", (visibleChunkBounds: VisibleChunkBounds) => {
            this.updatePlayerVisibleChunkBounds(socket, visibleChunkBounds);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            console.log("Client disconnected: " + socket.id);
            this.handlePlayerDisconnect(socket);
         });

         socket.on("playerMovement", (position: [number, number], movementHash: number) => {
            this.sendPlayerMovementPacket(socket, position, movementHash);
         })
      });
   }

   private async tick(): Promise<void> {
      this.ticks++;

      const entityCensus = this.board.tickEntities();

      this.entitySpawner.tick(entityCensus);

      // Send game data packets to all players
      this.sendGameDataPackets();
   }

   private async sendGameDataPackets(): Promise<void> {
      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
         // Skip clients which haven't been properly loaded yet
         if (!this.playerData.hasOwnProperty(socket.id)) continue;

         // Get the player data for the current client
         const playerData = this.playerData[socket.id];
         
         // Initialise the game data packet
         const gameDataPacket = {
            nearbyEntities: new Array<EntityData<EntityType>>()
         };
         
         const nearbyEntities = this.board.getPlayerNearbyEntities(playerData.instance, playerData.visibleChunkBounds);
         for (const entity of nearbyEntities) {
            const entityData: EntityData<EntityType> = {
               id: entity.id,
               type: entity.type,
               position: entity.position.package(),
               velocity: entity.velocity !== null ? entity.velocity.package() : null,
               acceleration: entity.acceleration !== null ? entity.acceleration.package() : null,
               terminalVelocity: entity.terminalVelocity,
               clientArgs: entity.getClientArgs()
            };

            gameDataPacket.nearbyEntities.push(entityData);
         }

         // Send the game data to the player
         socket.emit("gameDataPacket", gameDataPacket as GameDataPacket);
      }
   }

   private handlePlayerDisconnect(socket: ISocket): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         this.board.removeEntity(playerData.instance);
      }
   }

   private sendPlayerMovementPacket(socket: ISocket, position: [number, number], movementHash: number): void {
      const playerData = this.playerData[socket.id];

      playerData.instance.position = Point.unpackage(position);
      playerData.instance.updateMovementFromHash(movementHash);
   }

   private updatePlayerVisibleChunkBounds(socket: ISocket, visibleChunkBounds: VisibleChunkBounds): void {
      const playerData = this.playerData[socket.id];
      playerData.visibleChunkBounds = visibleChunkBounds;
   }

   private addPlayer(socket: ISocket, name: string, position: [number, number], visibleChunkBounds: VisibleChunkBounds): void {
      // Create the player entity
      const pointPosition = new Point(...position);
      const player = new Player(pointPosition, name);
      this.board.addEntity(player);

      // Initialise the player's gamedata record
      this.playerData[socket.id] = {
         clientEntityIDs: new Array<number>(),
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