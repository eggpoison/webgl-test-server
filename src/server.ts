import { Server, Socket } from "socket.io";
import { AttackPacket, ServerEntityData, GameDataPacket, PlayerDataPacket, Point, ServerAttackData, SETTINGS, Vector, VisibleChunkBounds, CowSpecies, InitialPlayerDataPacket, randFloat, Mutable, EntityType } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Player from "./entities/Player";
import Board, { AttackInfo } from "./Board";
import EntitySpawner from "./spawning/EntitySpawner";
import { findAvailableEntityID } from "./entities/Entity";
import Cow from "./entities/Cow";
import Mob from "./entities/Mob";

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

const formatAttackInfoArray = (attackInfoArray: ReadonlyArray<AttackInfo>): ReadonlyArray<ServerAttackData> => {
   return attackInfoArray.map(attackInfo => {
      return {
         targetEntityID: attackInfo.targetEntity.id,
         progress: attackInfo.progress
      };
   });
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

      // setTimeout(() => {
      //    for (let i = 0; i < 200; i++) {
      //       const x = randFloat(0, (SETTINGS.BOARD_DIMENSIONS - 1) * SETTINGS.TILE_SIZE);
      //       const y = randFloat(0, (SETTINGS.BOARD_DIMENSIONS - 1) * SETTINGS.TILE_SIZE);
      //       // const x = randFloat(60, 200);
      //       // const y = randFloat(60, 200);
      //       // const species = CowSpecies.brown;
      //       const species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;
      //       // const species = Math.random() < 0.8 ? CowSpecies.brown : CowSpecies.black;
      //       new Cow(new Point(x, y), species);
      //    }
      // }, 2000);
   }

   private handlePlayerConnections(): void {
      this.io.on("connection", (socket: ISocket) => {
         console.log("New client connected: " + socket.id);

         const playerID = findAvailableEntityID();

         // Send initial game data
         socket.on("initial_game_data_request", () => {
            socket.emit("initial_game_data", this.ticks, this.board.getTiles(), playerID);
         });

         // Receive initial player data
         socket.on("initial_player_data_packet", (initialPlayerDataPacket: InitialPlayerDataPacket) => {
            this.addPlayer(socket, playerID, initialPlayerDataPacket);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            console.log("Client disconnected: " + socket.id);
            this.handlePlayerDisconnect(socket);
         });

         socket.on("player_data_packet", (playerDataPacket: PlayerDataPacket) => {
            this.processPlayerDataPacket(socket, playerDataPacket);
         });

         socket.on("attack_packet", (attackPacket: AttackPacket) => {
            this.processAttackPacket(socket, attackPacket);
         });
      });
   }

   private async tick(): Promise<void> {
      this.ticks++;

      this.board.removeEntities();
      this.board.addEntitiesFromJoinBuffer();
      this.board.tickEntities();
      this.board.resolveCollisions();

      // Age items
      if (this.ticks % SETTINGS.TPS === 0) {
         this.board.ageItems();
      }

      const census = this.board.holdCensus();
      this.entitySpawner.runSpawnAttempt(census);

      this.board.runRandomTickAttempt();

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
         const player = playerData.instance;
         
         // Create the visible entity info array
         const visibleEntityInfoArray = new Array<ServerEntityData>();
         const nearbyEntities = this.board.getPlayerNearbyEntities(player, playerData.visibleChunkBounds);
         for (const entity of nearbyEntities) {
            const entityData: Mutable<ServerEntityData> = {
               id: entity.id,
               type: entity.type,
               position: entity.position.package(),
               velocity: entity.velocity !== null ? entity.velocity.package() : null,
               acceleration: entity.acceleration !== null ? entity.acceleration.package() : null,
               terminalVelocity: entity.terminalVelocity,
               rotation: entity.rotation,
               clientArgs: entity.getClientArgs(),
               chunkCoordinates: entity.chunks.map(chunk => [chunk.x, chunk.y])
            };
            if (entity.hasOwnProperty("herdMemberHash")) {
               entityData.special = {
                  mobAIType: (entity as Mob).getCurrentAIType()
               }
            }

            visibleEntityInfoArray.push(entityData);
         }

         const tileUpdates = this.board.popTileUpdates();
         const serverAttackDataArray = formatAttackInfoArray(this.board.getAttackInfoArray());

         const serverItemDataArray = this.board.calculatePlayerItemInfoArray(playerData.visibleChunkBounds);
         
         const playerEvents = player.getPlayerEvents();

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            serverEntityDataArray: visibleEntityInfoArray,
            serverItemDataArray: serverItemDataArray,
            tileUpdates: tileUpdates,
            serverAttackDataArray: serverAttackDataArray,
            pickedUpItems: playerEvents.pickedUpItemEntities
         };

         player.clearPlayerEvents();

         // Send the game data to the player
         socket.emit("game_data_packet", gameDataPacket);
      }
   }

   private handlePlayerDisconnect(socket: ISocket): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.isRemoved = true;
      }
   }

   private async processAttackPacket(sendingSocket: ISocket, attackPacket: AttackPacket): Promise<void> {
      const player = this.playerData[sendingSocket.id].instance;

      // Calculate the attack's target entity
      const targetEntities = attackPacket.targetEntities.map(id => this.board.entities[id]);
      const targetInfo = player.calculateAttackedEntity(targetEntities);
      // Don't attack if the attack didn't hit anything on the serverside
      if (targetInfo === null) return;

      let damage: number;
      if (attackPacket.heldItem !== null) {
         damage = 1; // Placeholder
      } else {
         damage = 1;
      }

      // Register the hit
      targetInfo.target.registerHit(player, targetInfo.angle, damage);
   }

   private processPlayerDataPacket(socket: ISocket, playerDataPacket: PlayerDataPacket): void {
      const playerData = this.playerData[socket.id];

      playerData.instance.position = Point.unpackage(playerDataPacket.position);
      playerData.instance.velocity = playerDataPacket.velocity !== null ? Vector.unpackage(playerDataPacket.velocity) : null;
      playerData.instance.acceleration = playerDataPacket.acceleration !== null ? Vector.unpackage(playerDataPacket.acceleration) : null;
      playerData.instance.terminalVelocity = playerDataPacket.terminalVelocity;
      playerData.instance.rotation = playerDataPacket.rotation;

      playerData.visibleChunkBounds = playerDataPacket.visibleChunkBounds;
   }

   private addPlayer(socket: ISocket, playerID: number, initialPlayerDataPacket: InitialPlayerDataPacket): void {
      // Create the player entity
      const position = new Point(...initialPlayerDataPacket.position);
      const player = new Player(position, initialPlayerDataPacket.username, playerID);

      // Initialise the player's gamedata record
      this.playerData[socket.id] = {
         clientEntityIDs: new Array<number>(),
         instance: player,
         visibleChunkBounds: initialPlayerDataPacket.visibleChunkBounds
      };
   }
}

// Start the game server
export const SERVER = new GameServer();