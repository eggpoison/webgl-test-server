import { Server, Socket } from "socket.io";
import { AttackPacket, ServerEntityData, GameDataPacket, PlayerDataPacket, Point, SETTINGS, Vector, VisibleChunkBounds, CowSpecies, InitialPlayerDataPacket, randFloat, Mutable, EntityType, randInt, ENTITY_INFO_RECORD, InitialGameDataPacket, ServerTileData, ServerInventoryData, CraftingRecipe, ServerItemData, PlayerInventoryType, PlaceablePlayerInventoryType } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Player from "./entities/Player";
import Board from "./Board";
import Entity from "./entities/Entity";
import Mob from "./entities/Mob";
import { startReadingInput } from "./command-input";
import { precomputeSpawnLocations, runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import Cow from "./entities/Cow";
import Zombie from "./entities/Zombie";
import Tombstone from "./entities/Tombstone";
import Item from "./items/Item";

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
   /** Minimum number of units away from the border that the player will spawn at */
   private static readonly PLAYER_SPAWN_POSITION_PADDING = 100;
   
   private ticks: number = 0;

   /** The time of day the server is currently in (from 0 to 23) */
   public time: number = 0;

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

      // setTimeout(() => {
      //    for (let i = 0; i < 1000; i++) {
      //       const x = randFloat(0, (SETTINGS.BOARD_DIMENSIONS - 1) * SETTINGS.TILE_SIZE);
      //       const y = randFloat(0, (SETTINGS.BOARD_DIMENSIONS - 1) * SETTINGS.TILE_SIZE);
      //       // const x = randFloat(60, 200);
      //       // const y = randFloat(60, 200);
      //       new Tombstone(new Point(x, y));
      //    }
      // }, 2000);
   }

   /** Sets up the various stuff */
   public setup(): void {
      precomputeSpawnLocations();
      spawnInitialEntities();
   }

   private handlePlayerConnections(): void {
      this.io.on("connection", (socket: ISocket) => {
         let clientUsername: string;
         let clientWindowWidth: number;
         let clientWindowHeight: number;
         
         socket.on("initial_player_data", (username: string, windowWidth: number, windowHeight: number) => {
            clientUsername = username;
            clientWindowWidth = windowWidth;
            clientWindowHeight = windowHeight;
         });

         // When the server receives a request for the initial player data, process it and send back the server player data
         socket.on("initial_game_data_request", () => {
            // Spawn the player in a random position in the world
            const xSpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
            const ySpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
            const position = new Point(xSpawnPosition, ySpawnPosition);

            // Estimate which entities will be visible to the player
            const chunkMinX = Math.max(Math.min(Math.floor((position.x - clientWindowWidth/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
            const chunkMaxX = Math.max(Math.min(Math.floor((position.x + clientWindowWidth/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
            const chunkMinY = Math.max(Math.min(Math.floor((position.y - clientWindowHeight/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
            const chunkMaxY = Math.max(Math.min(Math.floor((position.y + clientWindowHeight/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
            const visibleChunkBounds: [number, number, number, number] = [chunkMinX, chunkMaxX, chunkMinY, chunkMaxY];
            
            const visibleEntities = new Set<Entity>();
            for (let chunkX = chunkMinX; chunkX <= chunkMaxX; chunkX++) {
               for (let chunkY = chunkMinY; chunkY <= chunkMaxY; chunkY++) {
                  const chunk = this.board.getChunk(chunkX, chunkY);
                  for (const entity of chunk.getEntities()) {
                     if (!visibleEntities.has(entity)) {
                        visibleEntities.add(entity);
                     }
                  }
               }
            }
            const visibleEntityDataArray = this.generateVisibleEntityData(visibleEntities);
            
            // Create the player in the server side
            const playerID = this.addPlayerToServer(socket, clientUsername, position, visibleChunkBounds);

            const tiles = this.board.getTiles();
            const serverTileData = new Array<Array<ServerTileData>>();
            for (let y = 0; y < SETTINGS.BOARD_DIMENSIONS; y++) {
               serverTileData[y] = new Array<ServerTileData>();
               const row = tiles[y];
               for (let x = 0; x < SETTINGS.BOARD_DIMENSIONS; x++) {
                  const tile = row[x];
                  serverTileData[y][x] = tile;
               }
            }
            
            const serverItemDataArray = this.board.calculatePlayerItemInfoArray(visibleChunkBounds);

            const initialGameDataPacket: InitialGameDataPacket = {
               playerID: playerID,
               tiles: serverTileData,
               spawnPosition: [xSpawnPosition, ySpawnPosition],
               serverEntityDataArray: visibleEntityDataArray,
               serverItemEntityDataArray: serverItemDataArray,
               hotbarInventory: {},
               craftingOutputItem: null,
               heldItem: null,
               tileUpdates: [],
               serverTicks: this.ticks,
               hitsTaken: []
            }

            socket.emit("initial_game_data_packet", initialGameDataPacket);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            this.handlePlayerDisconnect(socket);
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

         socket.on("item_hold_packet", (inventoryType: PlayerInventoryType, itemSlot: number) => {
            this.processItemHoldPacket(socket, inventoryType, itemSlot);
         });

         socket.on("item_release_packet", (inventoryType: PlaceablePlayerInventoryType, itemSlot: number) => {
            this.processItemReleasePacket(socket, inventoryType, itemSlot);
         });
      });
   }

   private async tick(): Promise<void> {
      // Update server ticks and time
      this.ticks++;
      this.time = (this.ticks * SETTINGS.TIME_PASS_RATE / SETTINGS.TPS / 3600) % 24;

      this.board.removeEntities();
      this.board.addEntitiesFromJoinBuffer();
      this.board.tickEntities();
      this.board.resolveCollisions();

      // Age items
      if (this.ticks % SETTINGS.TPS === 0) {
         this.board.ageItems();
      }

      runSpawnAttempt();

      this.board.runRandomTickAttempt();

      // Send game data packets to all players
      this.sendGameDataPackets();
   }

   private generateVisibleEntityData(visibleEntities: ReadonlySet<Entity>): ReadonlyArray<ServerEntityData> {
      const visibleEntityDataArray = new Array<ServerEntityData>();
      for (const entity of visibleEntities) {
         const healthComponent = entity.getComponent("health");

         const entityData: Mutable<ServerEntityData> = {
            id: entity.id,
            type: entity.type,
            position: entity.position.package(),
            velocity: entity.velocity !== null ? entity.velocity.package() : null,
            acceleration: entity.acceleration !== null ? entity.acceleration.package() : null,
            terminalVelocity: entity.terminalVelocity,
            rotation: entity.rotation,
            clientArgs: entity.getClientArgs(),
            secondsSinceLastHit: healthComponent !== null ? healthComponent.getSecondsSinceLastHit() : null,
            chunkCoordinates: Array.from(entity.chunks).map(chunk => [chunk.x, chunk.y]),
            hitboxes: Array.from(entity.hitboxes).map(hitbox => {
               return hitbox.info;
            })
         };

         const entityInfo = ENTITY_INFO_RECORD[entity.type];
         if (entityInfo.category === "mob") {
            entityData.special = {
               mobAIType: (entity as Mob).getCurrentAIType()
            };
         }

         visibleEntityDataArray.push(entityData);
      }
      return visibleEntityDataArray;
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
         const nearbyEntities = this.board.getPlayerNearbyEntities(player, playerData.visibleChunkBounds);
         const visibleEntityInfoArray = this.generateVisibleEntityData(nearbyEntities);

         const tileUpdates = this.board.popTileUpdates();

         const serverItemEntityDataArray = this.board.calculatePlayerItemInfoArray(playerData.visibleChunkBounds);
            
         // Calculate the hotbar inventory data
         const hotbarInventoryData: ServerInventoryData = {};
         const inventory = player.getComponent("inventory")!.getInventory();
         for (const [itemSlot, item] of Object.entries(inventory) as unknown as ReadonlyArray<[number, Item]>) {
            hotbarInventoryData[itemSlot] = {
               type: item.type,
               count: item.count
            };
         }

         // Format the crafting output item
         const craftingOutputItem: ServerItemData | null = player.craftingOutputItem !== null ? {
            type: player.craftingOutputItem.type,
            count: player.craftingOutputItem.count
         } : null;

         // Format the crafting held item
         const heldItem: ServerItemData | null = player.heldItem !== null ? {
            type: player.heldItem.type,
            count: player.heldItem.count
         } : null;
         
         const hitsTaken = player.getHitsTaken();
         player.clearHitsTaken();

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            serverEntityDataArray: visibleEntityInfoArray,
            serverItemEntityDataArray: serverItemEntityDataArray,
            hotbarInventory: hotbarInventoryData,
            craftingOutputItem: craftingOutputItem,
            heldItem: heldItem,
            tileUpdates: tileUpdates,
            serverTicks: this.ticks,
            hitsTaken: hitsTaken
         };

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

   private processCraftingPacket(socket: ISocket, craftingRecipe: CraftingRecipe): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.processCraftingPacket(craftingRecipe);
      }
   }

   private processItemHoldPacket(socket: ISocket, inventoryType: PlayerInventoryType, itemSlot: number): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.processItemHoldPacket(inventoryType, itemSlot);
      }
   }

   private processItemReleasePacket(socket: ISocket, inventoryType: PlaceablePlayerInventoryType, itemSlot: number): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         playerData.instance.processItemReleasePacket(inventoryType, itemSlot);
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
      const attackHash = player.id.toString();
      targetInfo.target.takeDamage(damage, player, attackHash);
      targetInfo.target.getComponent("health")!.addLocalInvulnerabilityHash(attackHash, 0.3);
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

   /**
    * Adds a player to the server and creates its player entity
    * @returns The ID of the created player entity
    */
   private addPlayerToServer(socket: ISocket, username: string, position: Point, visibleChunkBounds: VisibleChunkBounds): number {
      // Create the player entity
      const player = new Player(position, username);

      // Initialise the player's gamedata record
      this.playerData[socket.id] = {
         clientEntityIDs: new Array<number>(),
         instance: player,
         visibleChunkBounds: visibleChunkBounds
      };

      return player.id;
   }
}

// Start the game server
export const SERVER = new GameServer();
SERVER.setup();
startReadingInput();