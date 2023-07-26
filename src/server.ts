import { Server, Socket } from "socket.io";
import { AttackPacket, GameDataPacket, PlayerDataPacket, Point, SETTINGS, Vector, randInt, InitialGameDataPacket, ServerTileData, CraftingRecipe, PlayerInventoryType, PlaceablePlayerInventoryType, GameDataSyncPacket, RespawnDataPacket, ITEM_INFO_RECORD, EntityData, EntityType, DroppedItemData, ProjectileData, GameObjectData, Mutable, HitboxData, HitboxInfo, HitboxType, VisibleChunkBounds, StatusEffectType, GameObjectDebugData } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Player from "./entities/Player";
import { registerCommand } from "./commands";
import _GameObject, { GameObjectSubclasses } from "./GameObject";
import Entity from "./entities/Entity";
import Mob from "./entities/mobs/Mob";
import DroppedItem from "./items/DroppedItem";
import Board from "./Board";
import { runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import Projectile from "./Projectile";
import Cow from "./entities/mobs/Cow";
import BerryBush from "./entities/resources/BerryBush";

/*

Reference for future self:
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

*/

const bundleHitboxData = (hitboxInfo: HitboxInfo<HitboxType>): HitboxData<HitboxType> => {
   switch (hitboxInfo.type) {
      case "circular": {
         return {
            type: "circular",
            radius: hitboxInfo.radius,
            offset: typeof hitboxInfo.offset !== "undefined" ? hitboxInfo.offset.package() : undefined
         };
      }
      case "rectangular": {
         return {
            type: "rectangular",
            width: hitboxInfo.width,
            height: hitboxInfo.height,
            offset: typeof hitboxInfo.offset !== "undefined" ? hitboxInfo.offset.package() : undefined
         };
      }
   }
}

const _GameObjectSubclassData = {
   entity: (_: EntityData<EntityType>) => {},
   droppedItem: (_: DroppedItemData) => {},
   projectile: (_: ProjectileData) => {}
} satisfies Record<keyof GameObjectSubclasses, (arg: any) => void>;

type GameObjectSubclassData<T extends keyof GameObjectSubclasses> = Parameters<(typeof _GameObjectSubclassData)[T]>[0];

const bundleGameObjectData = <T extends keyof GameObjectSubclasses>(i: T, gameObject: _GameObject<T>): GameObjectSubclassData<T> => {
   const baseGameObjectData: GameObjectData = {
      id: gameObject.id,
      position: gameObject.position.package(),
      velocity: gameObject.velocity !== null ? gameObject.velocity.package() : null,
      acceleration: gameObject.acceleration !== null ? gameObject.acceleration.package() : null,
      terminalVelocity: gameObject.terminalVelocity,
      rotation: gameObject.rotation,
      chunkCoordinates: Array.from(gameObject.chunks).map(chunk => [chunk.x, chunk.y]),
      hitboxes: Array.from(gameObject.hitboxes).map(hitbox => {
         return bundleHitboxData(hitbox.info);
      })
   };

   switch (i) {
      case "entity": {
         const entity = gameObject as unknown as Entity;

         const healthComponent = entity.getComponent("health")!;

         const entityData: Mutable<Partial<EntityData<EntityType>>> = baseGameObjectData;
         entityData.type = entity.type;
         entityData.clientArgs = entity.getClientArgs();
         entityData.secondsSinceLastHit = healthComponent !== null ? healthComponent.getSecondsSinceLastHit() : null;
         entityData.statusEffects = entity.getStatusEffects();

         if (entity instanceof Mob) {
            entityData.special = {
               mobAIType: (entity as Mob).getCurrentAIType() || "none"
            };
         }

         return entityData as EntityData<EntityType>;
      }
      case "droppedItem": {
         const droppedItem = gameObject as unknown as DroppedItem;

         const droppedItemData: Mutable<Partial<DroppedItemData>> = baseGameObjectData;
         droppedItemData.type = droppedItem.item.type;

         return droppedItemData as DroppedItemData;
      }
      case "projectile": {
         const projectile = gameObject as unknown as Projectile;

         const projectileData: Mutable<Partial<ProjectileData>> = baseGameObjectData;
         projectileData.type = projectile.type;

         return projectileData as ProjectileData;
      }
   }

   throw new Error("bad");
}

const bundleEntityDataArray = (player: Player, chunkBounds: VisibleChunkBounds): ReadonlyArray<EntityData<EntityType>> => {
   const entityDataArray = new Array<EntityData<EntityType>>();
   const seenIDs = new Set<number>();
   
   for (let chunkX = chunkBounds[0]; chunkX <= chunkBounds[1]; chunkX++) {
      for (let chunkY = chunkBounds[2]; chunkY <= chunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.getEntities()) {
            if (entity !== player && !seenIDs.has(entity.id)) {
               entityDataArray.push(bundleGameObjectData("entity", entity));
               seenIDs.add(entity.id);
            }
         }
      }
   }

   return entityDataArray;
}

const bundleDroppedItemDataArray = (visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<DroppedItemData> => {
   const droppedItemDataArray = new Array<DroppedItemData>();
   const seenIDs = new Set<number>();
   
   for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
      for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const droppedItem of chunk.getDroppedItems()) {
            if (!seenIDs.has(droppedItem.id)) {
               droppedItemDataArray.push(bundleGameObjectData("droppedItem", droppedItem));
               seenIDs.add(droppedItem.id);
            }
         }
      }
   }

   return droppedItemDataArray;
}

const bundleProjectileDataArray = (visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<ProjectileData> => {
   const projectileDataArray = new Array<ProjectileData>();
   const seenIDs = new Set<number>();
   
   for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
      for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const projectile of chunk.getProjectiles()) {
            if (!seenIDs.has(projectile.id)) {
               projectileDataArray.push(bundleGameObjectData("projectile", projectile));
               seenIDs.add(projectile.id);
            }
         }
      }
   }

   return projectileDataArray;
}

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type PlayerData = {
   readonly username: string;
   instance: Player;
   clientIsActive: boolean;
   visibleChunkBounds: VisibleChunkBounds;
}

/** Communicates between the server and players */
class GameServer {
   private ticks: number = 0;

   /** The time of day the server is currently in (from 0 to 23) */
   public time: number = 6;

   // public board!: Board;
   
   /** Minimum number of units away from the border that the player will spawn at */
   private static readonly PLAYER_SPAWN_POSITION_PADDING = 100;

   private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

   private readonly playerData: Record<string, PlayerData> = {};

   private tickInterval: NodeJS.Timer | undefined;

   private trackedGameObjectID: number | null = null;

   /** Sets up the various stuff */
   public setup() {
      spawnInitialEntities();
   }

   public setTrackedGameObject(id: number | null): void {
      this.trackedGameObjectID = id;
   }

   public start(): void {
      if (this.io === null) {
         // Start the server
         this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
         this.handlePlayerConnections();
         console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);
      }

      if (typeof this.tickInterval === "undefined") {
         this.tickInterval = setInterval(() => this.tick(), 1000 / SETTINGS.TPS);
      }
   }

   public stop(): void {
      if (this.tickInterval !== null) {
         clearInterval(this.tickInterval);
      }
   }

   private async tick(): Promise<void> {
      // Update server ticks and time
      this.ticks++;
      this.time = (this.time + SETTINGS.TIME_PASS_RATE / SETTINGS.TPS / 3600) % 24;

      // Note: This has to be done at the beginning of the tick, as player input packets are received between ticks
      Board.removeFlaggedGameObjects();
      
      Board.pushJoinBuffer();

      Board.updateGameObjects();
      Board.resolveCollisions();

      // Age items
      if (this.ticks % SETTINGS.TPS === 0) {
         Board.ageItems();
      }

      runSpawnAttempt();

      Board.runRandomTickAttempt();

      // Send game data packets to all players
      this.sendGameDataPackets();
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
         let initialVisibleChunkBounds: VisibleChunkBounds
         
         socket.on("initial_player_data", (username: string, visibleChunkBounds: VisibleChunkBounds) => {
            clientUsername = username;
            initialVisibleChunkBounds = visibleChunkBounds;
         });

         const spawnPosition = this.generatePlayerSpawnPosition();

         socket.on("spawn_position_request", () => {
            socket.emit("spawn_position", spawnPosition.package());
         });

         // When the server receives a request for the initial player data, process it and send back the server player data
         socket.on("initial_game_data_request", () => {
            // Spawn the player in a random position in the world
            // const spawnPosition = new Point(SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 201, 200);

            new Cow(new Point(spawnPosition.x + 200, spawnPosition.y), false);
            new BerryBush(new Point(spawnPosition.x + 200, spawnPosition.y + 250), false);
            
            // Spawn the player entity
            const player = new Player(spawnPosition, false, clientUsername);

            // Initialise the player's gamedata record
            this.playerData[socket.id] = {
               username: clientUsername,
               instance: player,
               clientIsActive: true,
               visibleChunkBounds: [0, 0, 0, 0]
            };

            const tiles = Board.getTiles();
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
               entityDataArray: bundleEntityDataArray(player, initialVisibleChunkBounds),
               droppedItemDataArray: bundleDroppedItemDataArray(initialVisibleChunkBounds),
               projectileDataArray: bundleProjectileDataArray(initialVisibleChunkBounds),
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
               playerHealth: 20,
               statusEffects: []
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

         socket.on("track_game_object", (id: number | null): void => {
            this.setTrackedGameObject(id);
         })
      });
   }

   /** Send data about the server to all players */
   public async sendGameDataPackets(): Promise<void> {
      if (this.io === null) return;

      if (this.trackedGameObjectID !== null && !Board.hasGameObject(this.trackedGameObjectID)) {
         this.trackedGameObjectID = null;
      }

      let gameObjectDebugData: GameObjectDebugData | undefined;
      if (this.trackedGameObjectID !== null) {
         const gameObject = Board.getGameObject(this.trackedGameObjectID);
         gameObjectDebugData = gameObject.getDebugData();
      }

      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
         // Skip clients which haven't been properly loaded yet
         if (!this.playerData.hasOwnProperty(socket.id)) continue;

         if (!this.playerData[socket.id].clientIsActive) continue;

         // Get the player data for the current client
         const playerData = this.playerData[socket.id];
         const player = playerData.instance;

         const tileUpdates = Board.popTileUpdates();
         
         const hitsTaken = player.getHitsTaken();
         player.clearHitsTaken();

         const extendedVisibleChunkBounds: VisibleChunkBounds = [
            Math.max(playerData.visibleChunkBounds[0] - 1, 0),
            Math.min(playerData.visibleChunkBounds[1] + 1, SETTINGS.BOARD_SIZE - 1),
            Math.max(playerData.visibleChunkBounds[2] - 1, 0),
            Math.min(playerData.visibleChunkBounds[3] + 1, SETTINGS.BOARD_SIZE - 1)
         ];

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            entityDataArray: bundleEntityDataArray(player, extendedVisibleChunkBounds),
            droppedItemDataArray: bundleDroppedItemDataArray(extendedVisibleChunkBounds),
            projectileDataArray: bundleProjectileDataArray(extendedVisibleChunkBounds),
            inventory: player.bundleInventoryData(),
            tileUpdates: tileUpdates,
            serverTicks: this.ticks,
            serverTime: this.time,
            hitsTaken: hitsTaken,
            playerHealth: player.getComponent("health")!.getHealth(),
            statusEffects: player.getStatusEffects() as Array<StatusEffectType>,
            gameObjectDebugData: gameObjectDebugData
         };

         // Send the game data to the player
         socket.emit("game_data_packet", gameDataPacket);
      }
   }

   private handlePlayerDisconnect(socket: ISocket): void {
      if (this.playerData.hasOwnProperty(socket.id)) {
         const playerData = this.playerData[socket.id];
         if (Board.gameObjectIsInBoard(playerData.instance)) {
            playerData.instance.remove();
         }
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
      playerData.visibleChunkBounds = playerDataPacket.visibleChunkBounds;
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
      const playerEntity = new Player(spawnPosition, false, username);

      // Update the player data's instance
      this.playerData[socket.id].instance = playerEntity;

      const dataPacket: RespawnDataPacket = {
         playerID: playerEntity.id,
         spawnPosition: spawnPosition.package()
      };

      socket.emit("respawn_data_packet", dataPacket);
   }
}

export const SERVER = new GameServer();

Board.setup();
SERVER.setup();

// Only start the server if jest isn't running
if (process.env.NODE_ENV !== "test") {
   SERVER.start();
}