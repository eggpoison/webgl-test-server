import { Server, Socket } from "socket.io";
import { AttackPacket, CowSpecies, EntityData, EntityType, GameDataPacket, PlayerDataPacket, Point, randFloat, SETTINGS, Vector, VisibleChunkBounds } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Player from "./entities/Player";
import Board from "./Board";
import EntitySpawner from "./spawning/EntitySpawner";
import Entity, { findAvailableEntityID } from "./entities/Entity";
import Cow from "./entities/Cow";

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

type PlayerAttackInfo = {
   readonly target: Entity;
   readonly distance: number;
   readonly angle: number;
}

const calculateAttackedEntity = (player: Entity, entities: ReadonlyArray<Entity>): PlayerAttackInfo | null => {
   let closestEntity: Entity | null = null;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const entity of entities) {
      const dist = player.position.distanceFrom(entity.position);
      if (dist < minDistance) {
         closestEntity = entity;
         minDistance = dist;
      }
   }

   if (closestEntity === null) return null;

   return {
      target: closestEntity,
      distance: minDistance,
      angle: player.position.angleBetween(closestEntity.position)
   };
}

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

      setTimeout(() => {
         for (let i = 0; i < 100; i++) {
            const x = randFloat(0, (SETTINGS.BOARD_DIMENSIONS - 1) * SETTINGS.TILE_SIZE);
            const y = randFloat(0, (SETTINGS.BOARD_DIMENSIONS - 1) * SETTINGS.TILE_SIZE);
            // const x = randFloat(60, 200);
            // const y = randFloat(60, 200);
            const species = CowSpecies.brown;
            // const species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;
            // const species = Math.random() < 0.8 ? CowSpecies.brown : CowSpecies.black;
            new Cow(new Point(x, y), species);
         }
      }, 5000);
   }

   private handlePlayerConnections(): void {
      this.io.on("connection", (socket: ISocket) => {
         console.log("New client connected: " + socket.id);

         const playerID = findAvailableEntityID();

         // Send initial game data
         socket.emit("initialGameData", this.ticks, this.board.getTiles(), playerID);

         // Receive initial player data
         socket.on("initialPlayerData", (name: string, position: [number, number], visibleChunkBounds: VisibleChunkBounds) => {
            this.addPlayer(socket, name, playerID, position, visibleChunkBounds);
         });

         socket.on("newVisibleChunkBounds", (visibleChunkBounds: VisibleChunkBounds) => {
            this.updatePlayerVisibleChunkBounds(socket, visibleChunkBounds);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            console.log("Client disconnected: " + socket.id);
            this.handlePlayerDisconnect(socket);
         });

         socket.on("playerDataPacket", (playerDataPacket: PlayerDataPacket) => {
            this.processPlayerDataPacket(socket, playerDataPacket);
         });

         socket.on("attackPacket", (attackPacket: AttackPacket) => {
            this.processAttackPacket(socket, attackPacket);
         });
      });
   }

   private async tick(): Promise<void> {
      this.ticks++;

      const entityCensus = this.board.update();

      this.entitySpawner.tick(entityCensus);

      // Send game data packets to all players
      this.sendGameDataPackets();
   }

   /** Send data about the server to all players */
   private async sendGameDataPackets(): Promise<void> {
      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
         // Skip clients which haven't been properly loaded yet
         if (!this.playerData.hasOwnProperty(socket.id)) continue;

         // Get the player data for the current client
         const playerData = this.playerData[socket.id];

         const tileUpdates = this.board.getTileUpdates();
         
         // Initialise the game data packet
         const gameDataPacket = {
            nearbyEntities: new Array<EntityData<EntityType>>(),
            tileUpdates: tileUpdates,
            attackEntities: []
         };
         
         const nearbyEntities = this.board.getPlayerNearbyEntities(playerData.instance, playerData.visibleChunkBounds);
         for (const entity of nearbyEntities) {
            const entityData: EntityData<EntityType> = {
               id: entity.id,
               type: entity.type,
               position: entity.position.package(),
               velocity: entity.velocity !== null ? entity.velocity.package() : null,
               acceleration: entity.acceleration !== null ? entity.acceleration.package() : null,
               rotation: entity.rotation,
               terminalVelocity: entity.terminalVelocity,
               clientArgs: entity.getClientArgs(),
               chunks: entity.chunks.map(chunk => [chunk.x, chunk.y])
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

   private async processAttackPacket(sendingSocket: ISocket, attackPacket: AttackPacket): Promise<void> {
      const player = this.playerData[sendingSocket.id].instance;

      // Calculate the attack's target entity
      const targetEntities = attackPacket.targetEntites.map(id => this.board.entities[id]);
      const targetInfo = calculateAttackedEntity(player, targetEntities);

      if (targetInfo !== null) {
         // Register the hit
         targetInfo.target.registerHit(player, targetInfo.distance, targetInfo.angle, 1);
      }

      // const player = this.playerData[sendingSocket.id].instance;
      // const serverAttackPacket: ServerAttackPacket = {
      //    senderID: player.id,
      //    targetID: attackPacket.targetID,
      //    distance: attackPacket.distance,
      //    angle: attackPacket.angle,
      //    heldItem: attackPacket.heldItem
      // }
      
      // // Forward the attack packet to all players
      // const sockets = await this.io.fetchSockets();
      // for (const socket of sockets) {
      //    socket.emit("attackPacket", serverAttackPacket);
      // }
   }

   private processPlayerDataPacket(socket: ISocket, playerDataPacket: PlayerDataPacket): void {
      const playerData = this.playerData[socket.id];

      playerData.instance.position = Point.unpackage(playerDataPacket.position);
      playerData.instance.velocity = playerDataPacket.velocity !== null ? Vector.unpackage(playerDataPacket.velocity) : null;
      playerData.instance.acceleration = playerDataPacket.acceleration !== null ? Vector.unpackage(playerDataPacket.acceleration) : null;
      playerData.instance.terminalVelocity = playerDataPacket.terminalVelocity;
      playerData.instance.rotation = playerDataPacket.rotation;
   }

   private updatePlayerVisibleChunkBounds(socket: ISocket, visibleChunkBounds: VisibleChunkBounds): void {
      const playerData = this.playerData[socket.id];
      playerData.visibleChunkBounds = visibleChunkBounds;
   }

   private addPlayer(socket: ISocket, name: string, playerID: number, position: [number, number], visibleChunkBounds: VisibleChunkBounds): void {
      // Create the player entity
      const pointPosition = new Point(...position);
      const player = new Player(pointPosition, name, playerID);
      this.board.loadEntity(player);

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