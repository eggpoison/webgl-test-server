import { Server, Socket } from "socket.io";
import { AttackPacket, GameDataPacket, PlayerDataPacket, Point, SETTINGS, randInt, InitialGameDataPacket, ServerTileData, GameDataSyncPacket, RespawnDataPacket, EntityData, EntityType, DroppedItemData, ProjectileData, Mutable, VisibleChunkBounds, GameObjectDebugData, TribeData, RectangularHitboxData, CircularHitboxData, PlayerInventoryData, InventoryData, TribeMemberAction, ItemType, TileType, TribeType } from "webgl-test-shared";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import Board from "./Board";
import { registerCommand } from "./commands";
import _GameObject from "./GameObject";
import Player from "./entities/tribes/Player";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import { runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import Projectile from "./Projectile";
import Tribe from "./Tribe";
import TribeBuffer from "./TribeBuffer";
import { runTribeSpawnAttempt } from "./tribe-spawning";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import CircularHitbox from "./hitboxes/CircularHitbox";
import Chunk from "./Chunk";
import Item from "./items/Item";
import Cow from "./entities/mobs/Cow";
import BerryBush from "./entities/resources/BerryBush";
import TribeHut from "./entities/tribes/TribeHut";
import TribeTotem from "./entities/tribes/TribeTotem";
import FrozenYeti from "./entities/mobs/FrozenYeti";

/*

Reference for future self:
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

*/

const bundleHitboxData = (hitbox: RectangularHitbox | CircularHitbox): RectangularHitboxData | CircularHitboxData => {
   if (hitbox.hasOwnProperty("radius")) {
      // Circular hitbox
      return {
         radius: (hitbox as CircularHitbox).radius,
         offsetX: typeof hitbox.offset !== "undefined" ? hitbox.offset.x : undefined,
         offsetY: typeof hitbox.offset !== "undefined" ? hitbox.offset.y : undefined
      };
   } else {
      return {
         width: (hitbox as RectangularHitbox).width,
         height: (hitbox as RectangularHitbox).height,
         offsetX: typeof hitbox.offset !== "undefined" ? hitbox.offset.x : undefined,
         offsetY: typeof hitbox.offset !== "undefined" ? hitbox.offset.y : undefined
      };
   }
}

const bundleEntityData = (entity: Entity): EntityData<EntityType> => {
   const healthComponent = entity.getComponent("health");

   return {
      id: entity.id,
      position: entity.position.package(),
      velocity: entity.velocity.package(),
      rotation: entity.rotation,
      mass: entity.mass,
      hitboxes: entity.hitboxes.map(hitbox => {
         return bundleHitboxData(hitbox);
      }),
      ageTicks: entity.ageTicks,
      type: entity.type,
      clientArgs: entity.getClientArgs(),
      statusEffects: entity.getStatusEffectData(),
      hitsTaken: healthComponent !== null ? healthComponent.hitsTaken : [],
      amountHealed: healthComponent !== null ? healthComponent.amountHealedSinceLastPacketSend : 0
   };
}

const bundleDroppedItemData = (droppedItem: DroppedItem): DroppedItemData => {
   return {
      id: droppedItem.id,
      position: droppedItem.position.package(),
      velocity: droppedItem.velocity.package(),
      rotation: droppedItem.rotation,
      mass: droppedItem.mass,
      hitboxes: droppedItem.hitboxes.map(hitbox => {
         return bundleHitboxData(hitbox);
      }),
      ageTicks: droppedItem.ageTicks,
      type: droppedItem.item.type
   };
}

const bundleProjectileData = (projectile: Projectile): ProjectileData => {
   return {
      id: projectile.id,
      position: projectile.position.package(),
      velocity: projectile.velocity.package(),
      rotation: projectile.rotation,
      mass: projectile.mass,
      hitboxes: projectile.hitboxes.map(hitbox => {
         return bundleHitboxData(hitbox);
      }),
      ageTicks: projectile.ageTicks,
      type: projectile.type,
      data: projectile.data
   };
}

const getPlayerVisibleEntities = (chunkBounds: VisibleChunkBounds): ReadonlyArray<Entity> => {
   const entities = new Array<Entity>();
   const seenIDs = new Set<number>();
   
   for (let chunkX = chunkBounds[0]; chunkX <= chunkBounds[1]; chunkX++) {
      for (let chunkY = chunkBounds[2]; chunkY <= chunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.entities) {
            if (!seenIDs.has(entity.id)) {
               entities.push(entity);
               seenIDs.add(entity.id);
            }
         }
      }
   }

   return entities;
}

const bundleEntityDataArray = (visibleEntities: ReadonlyArray<Entity>): ReadonlyArray<EntityData<EntityType>> => {
   const entityDataArray = new Array<EntityData<EntityType>>();
   
   for (const entity of visibleEntities) {
      const entityData = bundleEntityData(entity);
      entityDataArray.push(entityData);
   }

   return entityDataArray;
}

const bundleDroppedItemDataArray = (visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<DroppedItemData> => {
   const droppedItemDataArray = new Array<DroppedItemData>();
   const seenIDs = new Set<number>();
   
   for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
      for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const droppedItem of chunk.droppedItems) {
            if (!seenIDs.has(droppedItem.id)) {
               droppedItemDataArray.push(bundleDroppedItemData(droppedItem));
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
         for (const projectile of chunk.projectiles) {
            if (!seenIDs.has(projectile.id)) {
               projectileDataArray.push(bundleProjectileData(projectile));
               seenIDs.add(projectile.id);
            }
         }
      }
   }

   return projectileDataArray;
}

const calculateKilledEntityIDs = (visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<number> => {
   const visibleChunks = new Set<Chunk>();
   for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
      for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         visibleChunks.add(chunk);
      }
   }

   // Calculate killed entity IDs for entities visible to the player
   const killedEntityIDs = new Array<number>();
   for (const killedEntityInfo of Board.killedEntities) {
      let isInVisibleChunks = false;
      for (const chunk of killedEntityInfo.boundingChunks) {
         if (visibleChunks.has(chunk)) {
            isInVisibleChunks = true;
            break;
         }
      }
      if (isInVisibleChunks) {
         killedEntityIDs.push(killedEntityInfo.id);
      }
   }

   return killedEntityIDs;
}

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface PlayerData {
   readonly username: string;
   readonly socket: ISocket;
   instance: Player;
   clientIsActive: boolean;
   visibleChunkBounds: VisibleChunkBounds;
   tribe: Tribe | null;
}

/** Communicates between the server and players */
class GameServer {
   /** Minimum number of units away from the border that the player will spawn at */
   private static readonly PLAYER_SPAWN_POSITION_PADDING = 100;

   private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

   private readonly playerDataRecord: Record<string, PlayerData> = {};

   private tickInterval: NodeJS.Timeout | undefined;

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
         console.log("Server started on port " + SETTINGS.SERVER_PORT);
      }

      if (typeof this.tickInterval === "undefined") {
         this.tickInterval = setInterval(() => this.tick(), 1000 / SETTINGS.TPS);
         // this.tickInterval = setInterval(() => this.tick(), 3);
      }
   }

   public stop(): void {
      if (this.tickInterval !== null) {
         clearInterval(this.tickInterval);
      }
   }

   private tick(): void {
      // This is done before each tick to account for player packets causing entities to be removed between ticks.
      Board.removeFlaggedGameObjects();

      Board.updateTribes();

      Board.updateGameObjects();
      // Done before wall collisions so that game objects don't clip into walls for a tick
      Board.resolveGameObjectCollisions();
      Board.resolveWallCollisions();
      
      Board.pushJoinBuffer();

      runSpawnAttempt();

      Board.spreadGrass();

      // Push tribes from buffer
      while (TribeBuffer.hasTribes()) {
         const tribeJoinInfo = TribeBuffer.popTribe();
         const tribe = new Tribe(tribeJoinInfo.tribeType, tribeJoinInfo.totem);
         Board.addTribe(tribe);
         tribeJoinInfo.startingTribeMember.setTribe(tribe);
      }

      runTribeSpawnAttempt();

      Board.removeFlaggedGameObjects();

      this.sendGameDataPackets();

      // Reset the killed entity IDs
      Board.killedEntities = [];

      // Update server ticks and time
      // This is done at the end of the tick so that information sent by players is associated with the next tick to run
      Board.ticks++;
      Board.time = (Board.time + SETTINGS.TIME_PASS_RATE / SETTINGS.TPS / 3600) % 24;
   }

   public getPlayerFromUsername(username: string): Player | null {
      for (const data of Object.values(this.playerDataRecord)) {
         if (data.username === username) {
            // Found the player!
            const player = data.instance;
            return player;
         }
      }

      return null;
   }

   private getPlayerDataFromUsername(username: string): PlayerData | null {
      for (const data of Object.values(this.playerDataRecord)) {
         if (data.username === username) {
            // Found the player!
            return data;
         }
      }

      return null;
   }

   private handlePlayerConnections(): void {
      if (this.io === null) return;
      this.io.on("connection", (socket: ISocket) => {
         const playerData: Mutable<Partial<PlayerData>> = {
            socket: socket,
            clientIsActive: true,
            tribe: null
         };
         
         socket.on("initial_player_data", (username: string, visibleChunkBounds: VisibleChunkBounds) => {
            playerData.username = username;
            playerData.visibleChunkBounds = visibleChunkBounds;
         });

         // Spawn the player in a random position in the world
         // const spawnPosition = this.generatePlayerSpawnPosition();

         let spawnPosition: Point;
         do {
            spawnPosition = new Point(SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE * Math.random(), SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE * Math.random());
         } while (Board.getTile(Math.floor(spawnPosition.x / SETTINGS.TILE_SIZE), Math.floor(spawnPosition.y / SETTINGS.TILE_SIZE)).type !== TileType.sand);

         // new Cow(new Point(spawnPosition.x + 200, spawnPosition.y + 150));
         
         // new FrozenYeti(new Point(spawnPosition.x, spawnPosition.y + 250));
         // new BerryBush(new Point(spawnPosition.x + 100, spawnPosition.y));

         // new Tombstone(new Point(spawnPosition.x + 100, spawnPosition.y), false);

         // const totem = new TribeTotem(new Point(spawnPosition.x + 300, spawnPosition.y));
         // const totem = new TribeTotem(new Point(spawnPosition.x + 1, spawnPosition.y));
         // const tribe = new Tribe(TribeType.plainspeople, totem);

         // const hut = new TribeHut(new Point(spawnPosition.x + 300, spawnPosition.y + 100), tribe);
         // hut.rotation = Math.PI * 3/2;
         // tribe.registerNewHut(hut);
         // const hut2 = new TribeHut(new Point(spawnPosition.x + 300, spawnPosition.y + 300), tribe);
         // hut2.rotation = Math.PI * 3/2;
         // tribe.registerNewHut(hut2);
         // const hut3 = new TribeHut(new Point(spawnPosition.x + 300, spawnPosition.y + 400), tribe);
         // hut3.rotation = Math.PI * 3/2;
         // tribe.registerNewHut(hut3);

         // const item = new Item(ItemType.berry, 1);
         // new DroppedItem(new Point(spawnPosition.x, spawnPosition.y + 200), item);

         // new Tree(new Point(spawnPosition.x + 200, spawnPosition.y), false);

         socket.on("spawn_position_request", () => {
            socket.emit("spawn_position", spawnPosition.package());
         });

         // When the server receives a request for the initial player data, process it and send back the server player data
         socket.on("initial_game_data_request", () => {
            if (typeof playerData.username === "undefined") {
               throw new Error("Player username was undefined when trying to send initial game data.");
            }
            if (typeof playerData.visibleChunkBounds === "undefined") {
               throw new Error("Player visible chunk bounds was undefined when trying to send initial game data.");
            }
            
            // Spawn the player entity
            const player = new Player(spawnPosition, playerData.username, null);
            playerData.instance = player;

            // @Temporary
            // tribe.addTribeMember(player);

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

            const visibleEntities = getPlayerVisibleEntities(playerData.visibleChunkBounds);

            const initialGameDataPacket: InitialGameDataPacket = {
               playerID: player.id,
               tiles: serverTileData,
               waterRocks: Board.waterRocks,
               riverSteppingStones: Board.riverSteppingStones,
               riverFlowDirections: Board.getRiverFlowDirections(),
               entityDataArray: bundleEntityDataArray(visibleEntities),
               droppedItemDataArray: bundleDroppedItemDataArray(playerData.visibleChunkBounds),
               projectileDataArray: bundleProjectileDataArray(playerData.visibleChunkBounds),
               inventory: {
                  hotbar: {
                     itemSlots: {},
                     width: SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE,
                     height: 1,
                     inventoryName: "hotbar"
                  },
                  backpackInventory: {
                     itemSlots: {},
                     width: -1,
                     height: -1,
                     inventoryName: "backpack"
                  },
                  backpackSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     inventoryName: "backpackSlot"
                  },
                  heldItemSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     inventoryName: "heldItemSlot"
                  },
                  craftingOutputItemSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     inventoryName: "craftingOutputSlot"
                  },
                  armourSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     inventoryName: "armourSlot"
                  }
               },
               tileUpdates: [],
               serverTicks: Board.ticks,
               serverTime: Board.time,
               playerHealth: 20,
               tribeData: null,
               killedEntityIDs: [],
               hasFrostShield: false
            };

            this.playerDataRecord[socket.id] = playerData as PlayerData;

            socket.emit("initial_game_data_packet", initialGameDataPacket);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            this.handlePlayerDisconnect(socket);
         });

         socket.on("deactivate", () => {
            if (this.playerDataRecord.hasOwnProperty(socket.id)) {
               this.playerDataRecord[socket.id].clientIsActive = false;
            }
         });

         socket.on("activate", () => {
            if (this.playerDataRecord.hasOwnProperty(socket.id)) {
               this.playerDataRecord[socket.id].clientIsActive = true;

               this.sendGameDataSyncPacket(socket);
            }
         });

         socket.on("player_data_packet", (playerDataPacket: PlayerDataPacket) => {
            this.processPlayerDataPacket(socket, playerDataPacket);
         });

         socket.on("attack_packet", (attackPacket: AttackPacket) => {
            if (!this.playerDataRecord.hasOwnProperty(socket.id)) {
               return;
            }

            const player = this.playerDataRecord[socket.id].instance;
            player.processAttackPacket(attackPacket);
         });

         socket.on("crafting_packet", (recipeIndex: number) => {
            if (!this.playerDataRecord.hasOwnProperty(socket.id)) {
               return;
            }

            const playerData = this.playerDataRecord[socket.id];
            playerData.instance.processCraftingPacket(recipeIndex);
         });

         socket.on("item_pickup", (entityID: number, inventoryName: string, itemSlot: number, amount: number) => {
            if (this.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = this.playerDataRecord[socket.id];
               playerData.instance.processItemPickupPacket(entityID, inventoryName, itemSlot, amount);
            }
         });

         socket.on("item_release", (entityID: number, inventoryName: string, itemSlot: number, amount: number) => {
            if (this.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = this.playerDataRecord[socket.id];
               playerData.instance.processItemReleasePacket(entityID, inventoryName, itemSlot, amount);
            }
         });

         socket.on("item_use_packet", (itemSlot: number) => {
            if (this.playerDataRecord.hasOwnProperty(socket.id)) {
               const player = this.playerDataRecord[socket.id].instance;
               player.processItemUsePacket(itemSlot);
            }
         });

         socket.on("throw_held_item_packet", (throwDirection: number) => {
            if (this.playerDataRecord.hasOwnProperty(socket.id)) {
               const player = this.playerDataRecord[socket.id].instance;
               player.throwHeldItem(throwDirection);
            }
         });

         socket.on("respawn", () => {
            this.respawnPlayer(socket);
         });
         
         socket.on("command", (command: string) => {
            // Get the player data for the current client
            const playerData = this.playerDataRecord[socket.id];
            const player = playerData.instance;

            registerCommand(command, player);
         });

         socket.on("track_game_object", (id: number | null): void => {
            this.setTrackedGameObject(id);
         })
      });
   }

   /** Send data about the server to all players */
   public sendGameDataPackets(): void {
      if (this.io === null) return;

      if (this.trackedGameObjectID !== null && !Board.hasGameObject(this.trackedGameObjectID)) {
         this.trackedGameObjectID = null;
      }

      let gameObjectDebugData: GameObjectDebugData | undefined;
      if (this.trackedGameObjectID !== null) {
         const gameObject = Board.getGameObject(this.trackedGameObjectID);
         gameObjectDebugData = gameObject.getDebugData();
      }

      for (const playerData of Object.values(this.playerDataRecord)) {
         if (!playerData.clientIsActive) {
            continue;
         }
         
         const player = playerData.instance;

         const tileUpdates = Board.popTileUpdates();
         
         const extendedVisibleChunkBounds: VisibleChunkBounds = [
            Math.max(playerData.visibleChunkBounds[0] - 1, 0),
            Math.min(playerData.visibleChunkBounds[1] + 1, SETTINGS.BOARD_SIZE - 1),
            Math.max(playerData.visibleChunkBounds[2] - 1, 0),
            Math.min(playerData.visibleChunkBounds[3] + 1, SETTINGS.BOARD_SIZE - 1)
         ];

         const tribeData: TribeData | null = player.tribe !== null ? {
            id: player.tribe.id,
            tribeType: player.tribe.tribeType,
            numHuts: player.tribe.getNumHuts(),
            tribesmanCap: player.tribe.tribesmanCap,
            area: player.tribe.getArea().map(tile => [tile.x, tile.y])
         } : null;

         const visibleEntities = getPlayerVisibleEntities(extendedVisibleChunkBounds);

         const killedEntityIDs = calculateKilledEntityIDs(extendedVisibleChunkBounds);

         const playerArmour = player.forceGetComponent("inventory").getItem("armourSlot", 1);

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            entityDataArray: bundleEntityDataArray(visibleEntities),
            droppedItemDataArray: bundleDroppedItemDataArray(extendedVisibleChunkBounds),
            projectileDataArray: bundleProjectileDataArray(extendedVisibleChunkBounds),
            inventory: this.bundlePlayerInventoryData(player),
            tileUpdates: tileUpdates,
            serverTicks: Board.ticks,
            serverTime: Board.time,
            playerHealth: player.forceGetComponent("health").getHealth(),
            gameObjectDebugData: gameObjectDebugData,
            tribeData: tribeData,
            killedEntityIDs: killedEntityIDs,
            hasFrostShield: player.immunityTimer === 0 && playerArmour !== null && playerArmour.type === ItemType.deep_frost_armour
         };

         // Send the game data to the player
         playerData.socket.emit("game_data_packet", gameDataPacket);
      }
   }

   private bundlePlayerInventoryData(player: Player): PlayerInventoryData {
      const inventoryData: PlayerInventoryData = {
         hotbar: this.bundleInventory(player, "hotbar"),
         backpackInventory: this.bundleInventory(player, "backpack"),
         backpackSlot: this.bundleInventory(player, "backpackSlot"),
         heldItemSlot: this.bundleInventory(player, "heldItemSlot"),
         craftingOutputItemSlot: this.bundleInventory(player, "craftingOutputSlot"),
         armourSlot: this.bundleInventory(player, "armourSlot")
      };

      return inventoryData;
   }

   private bundleInventory(player: Player, inventoryName: string): InventoryData {
      const inventory = player.forceGetComponent("inventory").getInventory(inventoryName);

      const inventoryData: InventoryData = {
         itemSlots: {},
         width: inventory.width,
         height: inventory.height,
         inventoryName: inventoryName
      };
      for (const [itemSlot, item] of Object.entries(inventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
         inventoryData.itemSlots[itemSlot] = {
            type: item.type,
            count: item.count,
            id: item.id
         };
      }
      return inventoryData;
   }

   private handlePlayerDisconnect(socket: ISocket): void {
      if (this.playerDataRecord.hasOwnProperty(socket.id)) {
         const playerData = this.playerDataRecord[socket.id];
         if (Board.gameObjectIsInBoard(playerData.instance)) {
            playerData.instance.remove();
         }
         delete this.playerDataRecord[socket.id];
      }
   }

   private sendGameDataSyncPacket(socket: ISocket): void {
      if (this.playerDataRecord.hasOwnProperty(socket.id)) {
         const player = this.playerDataRecord[socket.id].instance;

         const packet: GameDataSyncPacket = {
            position: player.position.package(),
            velocity: player.velocity.package(),
            acceleration: player.acceleration.package(),
            rotation: player.rotation,
            terminalVelocity: player.terminalVelocity,
            health: player.forceGetComponent("health").getHealth(),
            inventory: this.bundlePlayerInventoryData(player)
         };

         socket.emit("game_data_sync_packet", packet);
      }
   }

   private processPlayerDataPacket(socket: ISocket, playerDataPacket: PlayerDataPacket): void {
      const playerData = this.playerDataRecord[socket.id];

      playerData.instance.position = Point.unpackage(playerDataPacket.position);
      playerData.instance.velocity = Point.unpackage(playerDataPacket.velocity);
      playerData.instance.acceleration = Point.unpackage(playerDataPacket.acceleration);
      playerData.instance.terminalVelocity = playerDataPacket.terminalVelocity;
      playerData.instance.rotation = playerDataPacket.rotation;
      playerData.visibleChunkBounds = playerDataPacket.visibleChunkBounds;
      playerData.instance.setSelectedItemSlot(playerDataPacket.selectedItemSlot);
      playerData.instance.interactingEntityID = playerDataPacket.interactingEntityID;

      if (playerDataPacket.action === TribeMemberAction.eat && playerData.instance.currentAction !== TribeMemberAction.eat) {
         playerData.instance.startEating();
      } else if (playerDataPacket.action === TribeMemberAction.charge_bow && playerData.instance.currentAction !== TribeMemberAction.charge_bow) {
         playerData.instance.startChargingBow();
      }
      playerData.instance.currentAction = playerDataPacket.action;
   }

   private generatePlayerSpawnPosition(): Point {
      const xSpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      const ySpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      return new Point(xSpawnPosition, ySpawnPosition);
   }

   private respawnPlayer(socket: ISocket): void {
      const playerData = this.playerDataRecord[socket.id];

      // Calculate spawn position
      let spawnPosition: Point;
      if (playerData.tribe !== null) {
         spawnPosition = playerData.tribe.totem.position.copy();
      } else {
         spawnPosition = this.generatePlayerSpawnPosition();
      }

      const playerEntity = new Player(spawnPosition, playerData.username, playerData.tribe);

      // Update the player data's instance
      this.playerDataRecord[socket.id].instance = playerEntity;

      const dataPacket: RespawnDataPacket = {
         playerID: playerEntity.id,
         spawnPosition: spawnPosition.package()
      };

      socket.emit("respawn_data_packet", dataPacket);
   }

   public sendForcePositionUpdatePacket(playerUsername: string, position: Point): void {
      const playerData = this.getPlayerDataFromUsername(playerUsername);
      if (playerData === null) {
         return;
      }
      
      playerData.socket.emit("force_position_update", position.package());
   }

   public updatePlayerTribe(player: Player, tribe: Tribe | null): void {
      const playerData = this.getPlayerDataFromUsername(player.username);
      if (playerData === null) {
         return;
      }

      playerData.tribe = tribe;
   }
}

export const SERVER = new GameServer();

// Only start the server if jest isn't running
if (process.env.NODE_ENV !== "test") {
   Board.setup();
   SERVER.setup();
   SERVER.start();
}