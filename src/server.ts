import { Server, Socket } from "socket.io";
import { AttackPacket, GameDataPacket, PlayerDataPacket, Point, SETTINGS, randInt, InitialGameDataPacket, ServerTileData, GameDataSyncPacket, RespawnDataPacket, EntityData, EntityType, Mutable, VisibleChunkBounds, GameObjectDebugData, TribeData, RectangularHitboxData, CircularHitboxData, PlayerInventoryData, InventoryData, TribeMemberAction, ItemType, ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData, TileType, HitData, IEntityType, TribeType } from "webgl-test-shared";
import Board from "./Board";
import { registerCommand } from "./commands";
import { runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import Tribe from "./Tribe";
import TribeBuffer from "./TribeBuffer";
import { runTribeSpawnAttempt } from "./tribe-spawning";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import CircularHitbox from "./hitboxes/CircularHitbox";
import Item from "./items/Item";
import OPTIONS from "./options";
import { resetCensus } from "./census";
import { resetYetiTerritoryTiles } from "./entities/mobs/OldYeti";
import Entity from "./GameObject";
import { BerryBushComponentArray, BoulderComponentArray, HealthComponentArray, InventoryComponentArray, ItemComponentArray, TreeComponentArray, TribeComponentArray } from "./components/ComponentArray";
import { getInventory, serializeInventoryData } from "./components/InventoryComponent";
import { createPlayer, processItemPickupPacket, processItemReleasePacket, processItemUsePacket, processPlayerAttackPacket, processPlayerCraftingPacket, throwItem } from "./entities/tribes/player";

const NUM_TESTS = 5;
const TEST_DURATION_MS = 15000;

const IS_TIMED = process.argv[2] === "1";

let lastTestTime = 0;
let numTestsConducted = 0;

const tickTimes = new Array<number>();

/*

Reference for future self:
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

*/

const bundleRectangularHitboxData = (hitbox: RectangularHitbox): RectangularHitboxData => {
   return {
      width: hitbox.width,
      height: hitbox.height,
      offsetX: hitbox.offset.x,
      offsetY: hitbox.offset.y
   };
}

const bundleCircularHitboxData = (hitbox: CircularHitbox): CircularHitboxData => {
   return {
      radius: hitbox.radius,
      offsetX: hitbox.offset.x,
      offsetY: hitbox.offset.y
   };
}

const bundleEntityData = (entity: Entity): EntityData<EntityType> => {
   const circularHitboxes = new Array<CircularHitboxData>();
   const rectangularHitboxes = new Array<RectangularHitboxData>();

   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];
      if (hitbox.hasOwnProperty("radius")) {
         circularHitboxes.push(bundleCircularHitboxData(hitbox as CircularHitbox));
      } else {
         rectangularHitboxes.push(bundleRectangularHitboxData(hitbox as RectangularHitbox));
      }
   }

   let clientArgs: EntityData<EntityType>["clientArgs"];
   switch (entity.type) {
      case IEntityType.barrel: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         clientArgs = [
            tribeComponent.tribe !== null ? tribeComponent.tribe.id : null,
            serializeInventoryData(getInventory(inventoryComponent, "inventory"), "inventory")
         ];
         break;
      }
      case IEntityType.berryBush: {
         const berryBushComponent = BerryBushComponentArray.getComponent(entity);
         clientArgs = [berryBushComponent.numBerries];
         break;
      }
      case IEntityType.boulder: {
         const boulderComponent = BoulderComponentArray.getComponent(entity);
         clientArgs = [boulderComponent.boulderType];
         break;
      }
      case IEntityType.cactus: {
         clientArgs = [];
         break;
      }
      case IEntityType.campfire: {
         clientArgs = [];
         break;
      }
      case IEntityType.cow: {
         clientArgs = [];
         break;
      }
      case IEntityType.fish: {
         clientArgs = [];
         break;
      }
      case IEntityType.frozenYeti: {
         clientArgs = [];
         break;
      }
      case IEntityType.furnace: {
         clientArgs = [];
         break;
      }
      case IEntityType.iceSpikes: {
         clientArgs = [];
         break;
      }
      case IEntityType.itemEntity: {
         const itemComponent = ItemComponentArray.getComponent(entity);
         clientArgs = [itemComponent.itemType];
         break;
      }
      case IEntityType.krumblid: {
         clientArgs = [];
         break;
      }
      case IEntityType.player: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const inventoryComponent = InventoryComponentArray.getComponent(entity);

         const hotbarInventory = getInventory(inventoryComponent, "hotbar");

         const playerData = SERVER.getPlayerDataFromInstance(entity);
         if (playerData === null) {
            throw new Error("Can't find player data");
         }

         let activeItem: ItemType | null = null;
         // @Incomplete
         // if (hotbarInventory.itemSlots.hasOwnProperty(this.selectedItemSlot)) {
         //    const item = hotbarInventory.itemSlots[this.selectedItemSlot];
         //    activeItem = item.type;
         // }
         
         // action: TribeMemberAction, foodEatingType: ItemType | -1, lastActionTicks: number, hasFrostShield: boolean, warPaintType: number, username: string
         clientArgs = [
            null,
            tribeComponent.tribeType,
            serializeInventoryData(getInventory(inventoryComponent, "armourSlot"), "armourSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpackSlot"), "backpackSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpack"), "backpack"),
            activeItem,
            TribeMemberAction.none,
            -1,
            0,
            false,
            -1,
            playerData.username
         ];
         break;
      }
      case IEntityType.slime: {
         clientArgs = [];
         break;
      }
      case IEntityType.slimewisp: {
         clientArgs = [];
         break;
      }
      case IEntityType.snowball: {
         clientArgs = [];
         break;
      }
      case IEntityType.tombstone: {
         clientArgs = [];
         break;
      }
      case IEntityType.tree: {
         const treeComponent = TreeComponentArray.getComponent(entity);
         clientArgs = [treeComponent.treeSize];
         break;
      }
      case IEntityType.tribeHut: {
         clientArgs = [];
         break;
      }
      case IEntityType.tribeTotem: {
         clientArgs = [];
         break;
      }
      case IEntityType.tribesman: {
         clientArgs = [];
         break;
      }
      case IEntityType.woodenArrowProjectile: {
         clientArgs = [];
         break;
      }
      case IEntityType.iceShardProjectile: {
         clientArgs = [];
         break;
      }
      case IEntityType.rockSpikeProjectile: {
         clientArgs = [];
         break;
      }
      case IEntityType.workbench: {
         clientArgs = [];
         break;
      }
      case IEntityType.yeti: {
         clientArgs = [];
         break;
      }
      case IEntityType.zombie: {
         clientArgs = [];
         break;
      }
   }

   return {
      id: entity.id,
      position: entity.position.package(),
      velocity: entity.velocity.package(),
      rotation: entity.rotation,
      mass: entity.mass,
      circularHitboxes: circularHitboxes,
      rectangularHitboxes: rectangularHitboxes,
      ageTicks: entity.ageTicks,
      type: entity.type as unknown as EntityType,
      // @Incomplete
      clientArgs: clientArgs,
      // @Incomplete
      statusEffects: [],
      // statusEffects: entity.getStatusEffectData(),
      // @Incomplete
      amountHealed: 0
      // amountHealed: healthComponent !== null ? healthComponent.amountHealedThisTick : 0
   }
}

const bundleEntityDataArray = (visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<EntityData<EntityType>> => {
   const visibleEntities = getPlayerVisibleEntities(visibleChunkBounds);

   const entityDataArray = new Array<EntityData>();
   for (const entity of visibleEntities) {
      const entityData = bundleEntityData(entity);
      entityDataArray.push(entityData);
   }

   return entityDataArray;
}

// const bundleEntityData = (entity: Entity): EntityData<EntityType> => {
//    const healthComponent = HealthComponentArray.getComponent(entity);

//    const circularHitboxes = new Array<CircularHitboxData>();
//    const rectangularHitboxes = new Array<RectangularHitboxData>();

//    for (let i = 0; i < entity.hitboxes.length; i++) {
//       const hitbox = entity.hitboxes[i];
//       if (hitbox.hasOwnProperty("radius")) {
//          circularHitboxes.push(bundleCircularHitboxData(hitbox as CircularHitbox));
//       } else {
//          rectangularHitboxes.push(bundleRectangularHitboxData(hitbox as RectangularHitbox));
//       }
//    }
   
//    return {
//       id: entity.id,
//       position: entity.position.package(),
//       velocity: entity.velocity.package(),
//       rotation: entity.rotation,
//       mass: entity.mass,
//       circularHitboxes: circularHitboxes,
//       rectangularHitboxes: rectangularHitboxes,
//       ageTicks: entity.ageTicks,
//       type: entity.type as unknown as EntityType,
//       clientArgs: entity.getClientArgs(),
//       statusEffects: entity.getStatusEffectData(),
//       amountHealed: healthComponent !== null ? healthComponent.amountHealedThisTick : 0
//    };
// }

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

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface PlayerData {
   readonly username: string;
   readonly socket: ISocket;
   instance: Entity;
   clientIsActive: boolean;
   visibleChunkBounds: VisibleChunkBounds;
   tribe: Tribe | null;
   hitsTaken: Array<HitData>;
   pickedUpItem: boolean;
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
      SERVER.trackedGameObjectID = id;
   }

   public start(): void {
      if (IS_TIMED && numTestsConducted === NUM_TESTS) {
         console.log("All tests done");
         return;
      }

      Board.setup();
      SERVER.setup();
      
      if (SERVER.io === null) {
         // Start the server
         SERVER.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
         SERVER.handlePlayerConnections();
         console.log("Server started on port " + SETTINGS.SERVER_PORT);
      }

      if (typeof SERVER.tickInterval === "undefined") {
         if (OPTIONS.warp) {
            SERVER.tickInterval = setInterval(() => SERVER.tick(), 2);
         } else {
            SERVER.tickInterval = setInterval(() => SERVER.tick(), 1000 / SETTINGS.TPS);
         }
      }
   }

   public stop(): void {
      if (typeof SERVER.tickInterval !== "undefined") {
         clearInterval(SERVER.tickInterval);
         SERVER.tickInterval = undefined;
      }

      this.io?.close();
   }

   private tick(): void {
      const tickStartTime = (OPTIONS.logging || IS_TIMED) ? performance.now() : 0;
      
      // This is done before each tick to account for player packets causing entities to be removed between ticks.
      Board.removeFlaggedGameObjects();

      Board.updateTribes();

      const timeBeforeUpdate = OPTIONS.logging ? performance.now() : 0;

      Board.updateGameObjects();
      const timeAfterUpdate = OPTIONS.logging ? performance.now() : 0;
      Board.resolveOtherCollisions();
      const timeAfterOtherCollisions = OPTIONS.logging ? performance.now() : 0;
      Board.resolveGameObjectCollisions();
      const timeAfterGameObjectCollisions = OPTIONS.logging ? performance.now() : 0;

      runSpawnAttempt();
      runTribeSpawnAttempt();
      
      Board.pushJoinBuffer();

      // Push tribes from buffer
      while (TribeBuffer.hasTribes()) {
         const tribeJoinInfo = TribeBuffer.popTribe();
         const tribe = new Tribe(tribeJoinInfo.tribeType, tribeJoinInfo.totem);
         Board.addTribe(tribe);

         const tribeComponent = TribeComponentArray.getComponent(tribeJoinInfo.startingTribeMember);
         tribeComponent.tribe = tribe;
      }

      Board.spreadGrass();

      Board.removeFlaggedGameObjects();

      SERVER.sendGameDataPackets();

      // Update server ticks and time
      // This is done at the end of the tick so that information sent by players is associated with the next tick to run
      Board.ticks++;
      Board.time += SETTINGS.TIME_PASS_RATE / SETTINGS.TPS / 3600;
      if (Board.time >= 24) {
         Board.time -= 24;
      }

      if (OPTIONS.logging) {
         const tickEndTime = performance.now();
         const tickTime = tickEndTime - tickStartTime;
         const updateTime = timeAfterUpdate - timeBeforeUpdate;
         const gameObjectCollisionsTime = timeAfterGameObjectCollisions - timeAfterUpdate;
         const otherCollisionsTime = timeAfterOtherCollisions - timeAfterGameObjectCollisions;
         console.log("[BENCHMARK] " + tickTime.toFixed(2) + "ms " + updateTime.toFixed(2) + "ms " + gameObjectCollisionsTime.toFixed(2) + "ms " + otherCollisionsTime.toFixed(2) + "ms | Game objects: " + Board.entities.length + " (" + Object.keys(Board.entityRecord).length + ")");
      }

      if (IS_TIMED) {
         const tickTime = performance.now() - tickStartTime;
         tickTimes.push(tickTime);

         const testTimeElapsed = performance.now() - lastTestTime;
         if (testTimeElapsed >= TEST_DURATION_MS) {
            numTestsConducted++;
            lastTestTime = performance.now();

            let average = 0;
            for (let i = 0; i < tickTimes.length; i++) {
               average += tickTimes[i];
            }
            average /= tickTimes.length;

            console.log("Completed test. AVG: " + average.toFixed(2) + "ms (" + Object.keys(Board.entityRecord).length + ")");
            SERVER.stop();

            // Reset
            resetYetiTerritoryTiles();
            SERVER = new GameServer();
            Board.reset();
            resetCensus();
            
            SERVER.start();
         }
      }
   }

   public getPlayerFromUsername(username: string): Entity | null {
      for (const data of Object.values(SERVER.playerDataRecord)) {
         if (data.username === username) {
            // Found the player!
            const player = data.instance;
            return player;
         }
      }

      return null;
   }

   public getPlayerDataFromInstance(instance: Entity): PlayerData | null {
      for (const data of Object.values(SERVER.playerDataRecord)) {
         if (data.instance === instance) {
            // Found the player!
            return data;
         }
      }

      return null;
   }

   private handlePlayerConnections(): void {
      if (SERVER.io === null) return;
      SERVER.io.on("connection", (socket: ISocket) => {
         const playerData: Mutable<Partial<PlayerData>> = {
            socket: socket,
            clientIsActive: true,
            tribe: null,
            hitsTaken: []
         };
         
         socket.on("initial_player_data", (username: string, visibleChunkBounds: VisibleChunkBounds) => {
            playerData.username = username;
            playerData.visibleChunkBounds = visibleChunkBounds;
         });

         // Spawn the player in a random position in the world
         const spawnPosition = SERVER.generatePlayerSpawnPosition();

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
            const player = createPlayer(spawnPosition, TribeType.plainspeople, null);
            playerData.instance = player;

            const serverTileData = new Array<ServerTileData>();
            for (let tileIndex = 0; tileIndex < SETTINGS.BOARD_DIMENSIONS * SETTINGS.BOARD_DIMENSIONS; tileIndex++) {
               const tile = Board.tiles[tileIndex];
               serverTileData.push({
                  x: tile.x,
                  y: tile.y,
                  type: tile.type as unknown as TileType,
                  biomeName: tile.biomeName,
                  isWall: tile.isWall
               });
            }

            const edgeTileData = new Array<ServerTileData>();
            for (let i = 0; i < Board.edgeTiles.length; i++) {
               const tile = Board.edgeTiles[i];
               edgeTileData.push({
                  x: tile.x,
                  y: tile.y,
                  type: tile.type as unknown as TileType,
                  biomeName: tile.biomeName,
                  isWall: tile.isWall
               });
            }

            const initialGameDataPacket: InitialGameDataPacket = {
               playerID: player.id,
               tiles: serverTileData,
               waterRocks: Board.waterRocks,
               riverSteppingStones: Board.riverSteppingStones,
               riverFlowDirections: Board.getRiverFlowDirections(),
               edgeTiles: edgeTileData,
               edgeRiverFlowDirections: Board.edgeRiverFlowDirections,
               edgeRiverSteppingStones: Board.edgeRiverSteppingStones,
               grassInfo: Board.grassInfo,
               decorations: Board.decorations,
               entityDataArray: bundleEntityDataArray(playerData.visibleChunkBounds),
               hitsTaken: [],
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
               hasFrostShield: false,
               pickedUpItem: false
            };

            SERVER.playerDataRecord[socket.id] = playerData as PlayerData;

            socket.emit("initial_game_data_packet", initialGameDataPacket);
         });

         // Handle player disconnects
         socket.on("disconnect", () => {
            SERVER.handlePlayerDisconnect(socket);
         });

         socket.on("deactivate", () => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               SERVER.playerDataRecord[socket.id].clientIsActive = false;
            }
         });

         socket.on("activate", () => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               SERVER.playerDataRecord[socket.id].clientIsActive = true;

               SERVER.sendGameDataSyncPacket(socket);
            }
         });

         socket.on("player_data_packet", (playerDataPacket: PlayerDataPacket) => {
            SERVER.processPlayerDataPacket(socket, playerDataPacket);
         });

         socket.on("attack_packet", (attackPacket: AttackPacket) => {
            if (!SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               return;
            }

            const player = SERVER.playerDataRecord[socket.id].instance;
            processPlayerAttackPacket(player, attackPacket);
         });

         socket.on("crafting_packet", (recipeIndex: number) => {
            if (!SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               return;
            }

            const playerData = SERVER.playerDataRecord[socket.id];
            processPlayerCraftingPacket(playerData.instance, recipeIndex);
         });

         socket.on("item_pickup", (entityID: number, inventoryName: string, itemSlot: number, amount: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               processItemPickupPacket(playerData.instance, entityID, inventoryName, itemSlot, amount);
            }
         });

         socket.on("item_release", (entityID: number, inventoryName: string, itemSlot: number, amount: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               processItemReleasePacket(playerData.instance, entityID, inventoryName, itemSlot, amount);
            }
         });

         socket.on("item_use_packet", (itemSlot: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const player = SERVER.playerDataRecord[socket.id].instance;
               processItemUsePacket(player, itemSlot);
            }
         });

         socket.on("held_item_drop", (dropAmount: number, throwDirection: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const player = SERVER.playerDataRecord[socket.id].instance;
               throwItem(player, "heldItemSlot", 1, dropAmount, throwDirection);
            }
         });

         socket.on("item_drop", (itemSlot: number, dropAmount: number, throwDirection: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const player = SERVER.playerDataRecord[socket.id].instance;
               throwItem(player, "hotbar", itemSlot, dropAmount, throwDirection);
            }
         });

         socket.on("respawn", () => {
            SERVER.respawnPlayer(socket);
         });
         
         socket.on("command", (command: string) => {
            // Get the player data for the current client
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = playerData.instance;

            registerCommand(command, player);
         });

         socket.on("track_game_object", (id: number | null): void => {
            SERVER.setTrackedGameObject(id);
         })
      });
   }

   /** Send data about the server to all players */
   public sendGameDataPackets(): void {
      if (SERVER.io === null) return;

      if (SERVER.trackedGameObjectID !== null && !Board.hasGameObject(SERVER.trackedGameObjectID)) {
         SERVER.trackedGameObjectID = null;
      }

      let gameObjectDebugData: GameObjectDebugData | undefined;
      if (SERVER.trackedGameObjectID !== null) {
         const gameObject = Board.getGameObject(SERVER.trackedGameObjectID);
         gameObjectDebugData = gameObject.getDebugData();
      }

      for (const playerData of Object.values(SERVER.playerDataRecord)) {
         if (!playerData.clientIsActive) {
            continue;
         }
         
         const player = playerData.instance;

         const tileUpdates = Board.popTileUpdates();
         
         // @Speed @Memory
         const extendedVisibleChunkBounds: VisibleChunkBounds = [
            Math.max(playerData.visibleChunkBounds[0] - 1, 0),
            Math.min(playerData.visibleChunkBounds[1] + 1, SETTINGS.BOARD_SIZE - 1),
            Math.max(playerData.visibleChunkBounds[2] - 1, 0),
            Math.min(playerData.visibleChunkBounds[3] + 1, SETTINGS.BOARD_SIZE - 1)
         ];

         const tribeComponent = TribeComponentArray.getComponent(player);
         const tribeData: TribeData | null = tribeComponent.tribe !== null ? {
            id: tribeComponent.tribe.id,
            tribeType: tribeComponent.tribe.tribeType,
            numHuts: tribeComponent.tribe.getNumHuts(),
            tribesmanCap: tribeComponent.tribe.tribesmanCap,
            area: tribeComponent.tribe.getArea().map(tile => [tile.x, tile.y])
         } : null;

         // @Incomplete
         // const playerArmour = getItem(InventoryComponentArray.getComponent(player), "armourSlot", 1);

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            entityDataArray: bundleEntityDataArray(extendedVisibleChunkBounds),
            inventory: SERVER.bundlePlayerInventoryData(player),
            hitsTaken: playerData.hitsTaken,
            tileUpdates: tileUpdates,
            serverTicks: Board.ticks,
            serverTime: Board.time,
            playerHealth: HealthComponentArray.getComponent(player).health,
            gameObjectDebugData: gameObjectDebugData,
            tribeData: tribeData,
            // @Incomplete
            // hasFrostShield: player.immunityTimer === 0 && playerArmour !== null && playerArmour.type === ItemType.deepfrost_armour,
            hasFrostShield: false,
            pickedUpItem: playerData.pickedUpItem
         };

         // Send the game data to the player
         playerData.socket.emit("game_data_packet", gameDataPacket);

         playerData.hitsTaken = [];
         playerData.pickedUpItem = false;
      }
   }

   public registerEntityHit(hitData: HitData): void {
      // @Incomplete: Consider all chunks the entity is in instead of just the one at its position
      
      const chunkX = Math.floor(hitData.entityPositionX / SETTINGS.CHUNK_UNITS);
      const chunkY = Math.floor(hitData.entityPositionY / SETTINGS.CHUNK_UNITS);
      for (const playerData of Object.values(this.playerDataRecord)) {
         if (chunkX >= playerData.visibleChunkBounds[0] && chunkX <= playerData.visibleChunkBounds[1] && chunkY >= playerData.visibleChunkBounds[2] && chunkY <= playerData.visibleChunkBounds[3]) {
            playerData.hitsTaken.push(hitData);
         }
      }
   }

   public registerPlayerDroppedItemPickup(player: Entity): void {
      for (const playerData of Object.values(this.playerDataRecord)) {
         if (playerData.instance === player) {
            playerData.pickedUpItem = true;
            
            return;
         }
      }

      console.warn("Couldn't find player to pickup item!");
   }

   private bundlePlayerInventoryData(player: Entity): PlayerInventoryData {
      const inventoryData: PlayerInventoryData = {
         hotbar: SERVER.bundleInventory(player, "hotbar"),
         backpackInventory: SERVER.bundleInventory(player, "backpack"),
         backpackSlot: SERVER.bundleInventory(player, "backpackSlot"),
         heldItemSlot: SERVER.bundleInventory(player, "heldItemSlot"),
         craftingOutputItemSlot: SERVER.bundleInventory(player, "craftingOutputSlot"),
         armourSlot: SERVER.bundleInventory(player, "armourSlot")
      };

      return inventoryData;
   }

   private bundleInventory(player: Entity, inventoryName: string): InventoryData {
      const inventoryComponent = InventoryComponentArray.getComponent(player);
      const inventory = getInventory(inventoryComponent, inventoryName);

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
      if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
         const playerData = SERVER.playerDataRecord[socket.id];
         if (Board.entityIsInBoard(playerData.instance)) {
            playerData.instance.remove();
         }
         delete SERVER.playerDataRecord[socket.id];
      }
   }

   private sendGameDataSyncPacket(socket: ISocket): void {
      if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
         const player = SERVER.playerDataRecord[socket.id].instance;

         const packet: GameDataSyncPacket = {
            position: player.position.package(),
            velocity: player.velocity.package(),
            acceleration: player.acceleration.package(),
            rotation: player.rotation,
            terminalVelocity: player.terminalVelocity,
            health: HealthComponentArray.getComponent(player).health,
            inventory: SERVER.bundlePlayerInventoryData(player)
         };

         socket.emit("game_data_sync_packet", packet);
      }
   }

   private processPlayerDataPacket(socket: ISocket, playerDataPacket: PlayerDataPacket): void {
      const playerData = SERVER.playerDataRecord[socket.id];

      playerData.instance.position.x = playerDataPacket.position[0];
      playerData.instance.position.y = playerDataPacket.position[1];
      playerData.instance.velocity = Point.unpackage(playerDataPacket.velocity);
      playerData.instance.acceleration = Point.unpackage(playerDataPacket.acceleration);
      playerData.instance.terminalVelocity = playerDataPacket.terminalVelocity;
      playerData.instance.rotation = playerDataPacket.rotation;
      playerData.instance.hitboxesAreDirty = true;
      playerData.visibleChunkBounds = playerDataPacket.visibleChunkBounds;
      // @Incomplete
      // playerData.instance.setSelectedItemSlot(playerDataPacket.selectedItemSlot);
      // playerData.instance.interactingEntityID = playerDataPacket.interactingEntityID;

      // if (playerDataPacket.action === TribeMemberAction.eat && playerData.instance.currentAction !== TribeMemberAction.eat) {
      //    playerData.instance.startEating();
      // } else if (playerDataPacket.action === TribeMemberAction.charge_bow && playerData.instance.currentAction !== TribeMemberAction.charge_bow) {
      //    playerData.instance.startChargingBow();
      // }
      // playerData.instance.currentAction = playerDataPacket.action;
   }

   private generatePlayerSpawnPosition(): Point {
      const xSpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      const ySpawnPosition = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      return new Point(xSpawnPosition, ySpawnPosition);
   }

   private respawnPlayer(socket: ISocket): void {
      const playerData = SERVER.playerDataRecord[socket.id];

      // Calculate spawn position
      let spawnPosition: Point;
      if (playerData.tribe !== null) {
         spawnPosition = playerData.tribe.totem.position.copy();
         const offsetDirection = 2 * Math.PI * Math.random();
         spawnPosition.x += 100 * Math.sin(offsetDirection);
         spawnPosition.y += 100 * Math.cos(offsetDirection);
      } else {
         spawnPosition = SERVER.generatePlayerSpawnPosition();
      }

      const player = createPlayer(spawnPosition, TribeType.plainspeople, playerData.tribe);

      // Update the player data's instance
      SERVER.playerDataRecord[socket.id].instance = player;

      const dataPacket: RespawnDataPacket = {
         playerID: player.id,
         spawnPosition: spawnPosition.package()
      };

      socket.emit("respawn_data_packet", dataPacket);
   }

   public sendForcePositionUpdatePacket(player: Entity, position: Point): void {
      const playerData = SERVER.getPlayerDataFromInstance(player);
      if (playerData === null) {
         return;
      }
      
      playerData.socket.emit("force_position_update", position.package());
   }

   public updatePlayerTribe(player: Entity, tribe: Tribe | null): void {
      const playerData = SERVER.getPlayerDataFromInstance(player);
      if (playerData === null) {
         return;
      }

      playerData.tribe = tribe;
   }
}

export let SERVER = new GameServer();

// Only start the server if jest isn't running
if (process.env.NODE_ENV !== "test") {
   SERVER.start();
}