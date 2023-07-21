import { Server, Socket } from "socket.io";
import { AttackPacket, GameDataPacket, PlayerDataPacket, Point, SETTINGS, Vector, randInt, InitialGameDataPacket, ServerTileData, CraftingRecipe, PlayerInventoryType, PlaceablePlayerInventoryType, GameDataSyncPacket, RespawnDataPacket, ITEM_INFO_RECORD } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Player from "./entities/Player";
import Board from "./Board";
import { runEntityCensus, runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import { registerCommand } from "./commands";

/*

Reference for future self:
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

*/

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type PlayerData = {
   readonly username: string;
   instance: Player;
   clientIsActive: boolean;
}

class GameServer {
   /** Minimum number of units away from the border that the player will spawn at */
   private static readonly PLAYER_SPAWN_POSITION_PADDING = 100;
   /** Number of seconds between each entity census */
   private static readonly ENTITY_CENSUS_INTERVAL = 60;
   
   private ticks: number = 0;

   /** The time of day the server is currently in (from 0 to 23) */
   public time: number = 6;

   public readonly board: Board;

   private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

   private readonly playerData: Record<string, PlayerData> = {};

   private tickInterval: NodeJS.Timer | undefined;

   constructor() {
      // Create the board
      this.board = new Board();

   }

   public start(): void {
      if (typeof this.tickInterval === "undefined") {
         this.tickInterval = setInterval(() => this.tick(), 1000 / SETTINGS.TPS);
      }

      if (this.io === null) {
         // Start the server
         this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
         this.handlePlayerConnections();
         console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);
      }
   }

   public stop(): void {
      if (this.tickInterval !== null) {
         clearInterval(this.tickInterval);
      }
   }

   /** Sets up the various stuff */
   public setup(): void {
      spawnInitialEntities();
   }

   public getPlayerFromUsername(username: string): Player | null {
      for (const data of Object.values(this.playerData)) {
         if (data.username === username) {
            // Found the player!
            const player = data.instance;
            return player;
         }
      }

      return null;
   }

   private handlePlayerConnections(): void {
      if (this.io === null) return;
      this.io.on("connection", (socket: ISocket) => {
         let clientUsername: string;
         
         socket.on("initial_player_data", (username: string) => {
            clientUsername = username;
         });

         // When the server receives a request for the initial player data, process it and send back the server player data
         socket.on("initial_game_data_request", () => {
            // Spawn the player in a random position in the world
            const spawnPosition = this.generatePlayerSpawnPosition();

            // Spawn the player entity
            const player = new Player(spawnPosition, clientUsername);

            // Initialise the player's gamedata record
            this.playerData[socket.id] = {
               username: clientUsername,
               instance: player,
               clientIsActive: true
            };

            const tiles = this.board.getTiles();
            const serverTileData = new Array<Array<ServerTileData>>();
            for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
               serverTileData[y] = new Array<ServerTileData>();
               const row = tiles[y];
               for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
                  const tile = row[x];
                  serverTileData[y][x] = {
                     x: tile.x,
                     y: tile.y,
                     type: tile.type,
                     biomeName: tile.biomeName,
                     isWall: tile.isWall
                  };
               }
            }

            const initialGameDataPacket: InitialGameDataPacket = {
               playerID: player.id,
               tiles: serverTileData,
               spawnPosition: spawnPosition.package(),
               entityDataArray: this.board.bundleEntityDataArray(player),
               droppedItemDataArray: this.board.bundleDroppedItemDataArray(),
               inventory: {
                  hotbar: {},
                  backpackInventory: {},
                  backpackSlot: null,
                  heldItemSlot: null,
                  craftingOutputItemSlot: null
               },
               tileUpdates: [],
               serverTicks: this.ticks,
               serverTime: this.time,
               hitsTaken: [],
               playerHealth: 20
            };

            socket.emit("initial_game_data_packet", initialGameDataPacket);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            this.handlePlayerDisconnect(socket);
         });

         socket.on("deactivate", () => {
            if (this.playerData.hasOwnProperty(socket.id)) {
               this.playerData[socket.id].clientIsActive = false;
            }
         });

         socket.on("activate", () => {
            if (this.playerData.hasOwnProperty(socket.id)) {
               this.playerData[socket.id].clientIsActive = true;

               this.sendGameDataSyncPacket(socket);
            }
         });

         socket.on("player_data_packet", (playerDataPacket: PlayerDataPacket) => {
            this.processPlayerDataPacket(socket, playerDataPacket);
         });

         socket.on("attack_packet", (attackPacket: AttackPacket) => {
            this.processAttackPacket(socket, attackPacket);
         });

         socket.on("crafting_packet", (craftingRecipe: CraftingRecipe) => {
            this.processCraftingPacket(socket, craftingRecipe);
         });

         socket.on("item_pickup_packet", (inventoryType: PlayerInventoryType, itemSlot: number, amount: number) => {
            this.processItemPickupPacket(socket, inventoryType, itemSlot, amount);
         });

         socket.on("item_release_packet", (inventoryType: PlaceablePlayerInventoryType, itemSlot: number, amount: number) => {
            this.processItemReleasePacket(socket, inventoryType, itemSlot, amount);
         });

         socket.on("item_use_packet", (itemSlot: number) => {
            this.processItemUsePacket(socket, itemSlot);
         });

         socket.on("throw_held_item_packet", (throwDirection: number) => {
            this.processThrowHeldItemPacket(socket, throwDirection);
         })

         socket.on("respawn", () => {
            this.respawnPlayer(socket);
         });
         
         socket.on("command", (command: string) => {
            // Get the player data for the current client
            const playerData = this.playerData[socket.id];
            const player = playerData.instance;

            registerCommand(command, player);
         });
      });
   }

   private async tick(): Promise<void> {
      // Update server ticks and time
      this.ticks++;
      this.time = (this.time + SETTINGS.TIME_PASS_RATE / SETTINGS.TPS / 3600) % 24;
      
      this.board.pushJoinBuffer();

      this.board.updateGameObjects();
      this.board.resolveCollisions();

      // Age items
      if (this.ticks % SETTINGS.TPS === 0) {
         this.board.ageItems();
      }

      this.board.removeFlaggedGameObjects();

      // Run entity census
      if ((this.ticks / SETTINGS.TPS) % GameServer.ENTITY_CENSUS_INTERVAL === 0) {
         runEntityCensus();
      }

      runSpawnAttempt();

      this.board.runRandomTickAttempt();

      // Send game data packets to all players
      this.sendGameDataPackets();
   }

   /** Send data about the server to all players */
   private async sendGameDataPackets(): Promise<void> {
      if (this.io === null) return;

      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
         // Skip clients which haven't been properly loaded yet
         if (!this.playerData.hasOwnProperty(socket.id)) continue;

         if (!this.playerData[socket.id].clientIsActive) continue;

         // Get the player data for the current client
         const playerData = this.playerData[socket.id];
         const player = playerData.instance;

         const tileUpdates = this.board.popTileUpdates();
         
         const hitsTaken = player.getHitsTaken();
         player.clearHitsTaken();

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            entityDataArray: this.board.bundleEntityDataArray(player),
            droppedItemDataArray: this.board.bundleDroppedItemDataArray(),
            inventory: player.bundleInventoryData(),
            tileUpdates: tileUpdates,
            serverTicks: this.ticks,
            serverTime: this.time,
            hitsTaken: hitsTaken,
            playerHealth: player.getComponent("health")!.getHealth()
         };

         // Send the game data to the player
         socket.emit("game_data_packet", gameDataPacket);
      }
   }

   private handlePlayerDisconnect(socket: ISocket): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.remove();
         delete this.playerData[socket.id];
      }
   }

   private sendGameDataSyncPacket(socket: ISocket): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const player = this.playerData[socket.id].instance;

         const packet: GameDataSyncPacket = {
            position: player.position.package(),
            velocity: player.velocity?.package() || null,
            acceleration: player.acceleration?.package() || null,
            rotation: player.rotation,
            terminalVelocity: player.terminalVelocity,
            health: player.getComponent("health")!.getHealth(),
            inventory: player.bundleInventoryData()
         };

         socket.emit("game_data_sync_packet", packet);
      }
   }

   private processCraftingPacket(socket: ISocket, craftingRecipe: CraftingRecipe): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.processCraftingPacket(craftingRecipe);
      }
   }

   private processItemPickupPacket(socket: ISocket, inventoryType: PlayerInventoryType, itemSlot: number, amount: number): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.processItemPickupPacket(inventoryType, itemSlot, amount);
      }
   }

   private processItemReleasePacket(socket: ISocket, inventoryType: PlaceablePlayerInventoryType, itemSlot: number, amount: number): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.processItemReleasePacket(inventoryType, itemSlot, amount);
      }
   }

   private processItemUsePacket(socket: ISocket, itemSlot: number): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const player = this.playerData[socket.id].instance;
         player.processItemUsePacket(itemSlot);
      }
   }

   private processThrowHeldItemPacket(socket: ISocket, throwDirection: number): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const player = this.playerData[socket.id].instance;
         player.throwHeldItem(throwDirection);
      }
   }
   
   private async processAttackPacket(socket: ISocket, attackPacket: AttackPacket): Promise<void> {
      const player = this.playerData[socket.id].instance;
      player.processAttackPacket(attackPacket);
   }

   private processPlayerDataPacket(socket: ISocket, playerDataPacket: PlayerDataPacket): void {
      const playerData = this.playerData[socket.id];

      playerData.instance.position = Point.unpackage(playerDataPacket.position);
      playerData.instance.velocity = playerDataPacket.velocity !== null ? Vector.unpackage(playerDataPacket.velocity) : null;
      playerData.instance.acceleration = playerDataPacket.acceleration !== null ? Vector.unpackage(playerDataPacket.acceleration) : null;
      playerData.instance.terminalVelocity = playerDataPacket.terminalVelocity;
      playerData.instance.rotation = playerDataPacket.rotation;
   }

   private generatePlayerSpawnPosition(): Point {
      const xSpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      const ySpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      const position = new Point(xSpawnPosition, ySpawnPosition);
      return position;
   }

   private respawnPlayer(socket: ISocket): void {
      const { username } = this.playerData[socket.id];

      const spawnPosition = this.generatePlayerSpawnPosition();
      const playerEntity = new Player(spawnPosition, username);

      // Update the player data's instance
      this.playerData[socket.id].instance = playerEntity;

      const dataPacket: RespawnDataPacket = {
         playerID: playerEntity.id,
         spawnPosition: spawnPosition.package()
      };

      socket.emit("respawn_data_packet", dataPacket);
   }
}

// Start the game server
export const SERVER = new GameServer();
SERVER.setup();

// Don't start the server if jest is running
if (process.env.NODE_ENV !== "test") {
   SERVER.start();
}