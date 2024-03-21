import { Server, Socket } from "socket.io";
import { AttackPacket, GameDataPacket, PlayerDataPacket, Point, SettingsConst, randInt, InitialGameDataPacket, ServerTileData, GameDataSyncPacket, RespawnDataPacket, EntityData, EntityType, VisibleChunkBounds, RectangularHitboxData, CircularHitboxData, PlayerInventoryData, TribeMemberAction, ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData, TileType, HitData, TribeType, TechID, TRIBE_INFO_RECORD, randItem, HealData, ResearchOrbCompleteData, EntityDebugData, ServerComponentType, ComponentData, EntityComponents, EntityComponentsData, PlayerTribeData, EnemyTribeData, Inventory, BuildingMaterial, BlueprintType, SlimeSize } from "webgl-test-shared";
import Board from "./Board";
import { registerCommand } from "./commands";
import { runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import Tribe from "./Tribe";
import { runTribeSpawnAttempt } from "./tribe-spawning";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import CircularHitbox from "./hitboxes/CircularHitbox";
import OPTIONS from "./options";
import Entity from "./Entity";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, PlayerComponentArray, TribeComponentArray } from "./components/ComponentArray";
import { getInventory, serialiseInventoryComponent } from "./components/InventoryComponent";
import { createPlayer, interactWithStructure, processItemPickupPacket, processItemReleasePacket, processItemUsePacket, processPlayerAttackPacket, processPlayerCraftingPacket, processTechUnlock, placeBlueprint, startChargingBattleaxe, startChargingBow, startChargingSpear, startEating, throwItem, uninteractWithStructure, modifyBuilding, deconstructBuilding } from "./entities/tribes/player";
import { serialiseCowComponent } from "./entities/mobs/cow";
import { getTilesOfBiome, resetCensus } from "./census";
import { getInventoryUseInfo, serialiseInventoryUseComponent } from "./components/InventoryUseComponent";
import { serialiseGolemComponent } from "./entities/mobs/golem";
import { forceMaxGrowAllIceSpikes, serialiseIceSpikesComponent } from "./entities/resources/ice-spikes";
import { serialiseStatusEffectComponent } from "./components/StatusEffectComponent";
import { PhysicsComponentArray, serialisePhysicsComponent } from "./components/PhysicsComponent";
import { serialiseAIHelperComponent } from "./components/AIHelperComponent";
import { serialiseArrowComponent } from "./components/ArrowComponent";
import { serialiseBerryBushComponent } from "./entities/resources/berry-bush";
import { serialiseBoulderComponent } from "./entities/resources/boulder";
import { serialiseCactusComponent } from "./entities/resources/cactus";
import { serialiseCookingComponent } from "./components/CookingComponent";
import { serialiseDoorComponent } from "./components/DoorComponent";
import { serialiseEscapeAIComponent } from "./components/EscapeAIComponent";
import { serialiseFishComponent } from "./entities/mobs/fish";
import { serialiseFollowAIComponent } from "./components/FollowAIComponent";
import { serialiseFrozenYetiComponent } from "./components/FrozenYetiComponent";
import { serialiseHealthComponent } from "./components/HealthComponent";
import { serialiseHutComponent } from "./components/HutComponent";
import { serialiseIceShardComponent } from "./components/IceShardComponent";
import { serialiseItemComponent } from "./components/ItemComponent";
import { serialisePebblumComponent } from "./components/PebblumComponent";
import { serialisePlayerComponent } from "./components/PlayerComponent";
import { serialiseRockSpikeComponent } from "./components/RockSpikeProjectileComponent";
import { serialiseSlimeSpitComponent } from "./components/SlimeSpitComponent";
import { serialiseSlimewispComponent } from "./components/SlimewispComponent";
import { serialiseSnowballComponent } from "./components/SnowballComponent";
import { serialiseThrowingProjectileComponent } from "./components/ThrowingProjectileComponent";
import { serialiseTombstoneComponent } from "./components/TombstoneComponent";
import { serialiseTotemBannerComponent } from "./components/TotemBannerComponent";
import { createTree, serialiseTreeComponent } from "./entities/resources/tree";
import { serialiseTribeComponent } from "./components/TribeComponent";
import { serialiseTribeMemberComponent } from "./components/TribeMemberComponent";
import { serialiseTribesmanComponent } from "./components/TribesmanComponent";
import { serialiseTurretComponent } from "./components/TurretComponent";
import { serialiseWanderAIComponent } from "./components/WanderAIComponent";
import { serialiseYetiComponent } from "./components/YetiComponent";
import { serialiseZombieComponent } from "./components/ZombieComponent";
import SRandom from "./SRandom";
import { createYeti, resetYetiTerritoryTiles } from "./entities/mobs/yeti";
import { resetComponents } from "./components/components";
import { resetPerlinNoiseCache } from "./perlin-noise";
import { serialiseAmmoBoxComponent } from "./components/AmmoBoxComponent";
import { serialiseSlimeComponent } from "./components/SlimeComponent";
import { createTribeTotem } from "./entities/tribes/tribe-totem";
import { createWall } from "./entities/structures/wall";
import { createWorkerHut } from "./entities/tribes/worker-hut";
import { getEntityDebugData } from "./entity-debug-data";
import { getVisiblePathfindingNodeOccupances } from "./pathfinding";
import { createEmbrasure } from "./entities/structures/embrasure";
import { serialiseBlueprintComponent } from "./components/BlueprintComponent";
import { serialiseTunnelComponent } from "./components/TunnelComponent";
import { serialiseBuildingMaterialComponent } from "./components/BuildingMaterialComponent";
import { serialiseSpikesComponent } from "./components/SpikesComponent";
import { createSlime } from "./entities/mobs/slime";
import { serialiseTribeWarriorComponent } from "./components/TribeWarriorComponent";
import { createWarriorHut } from "./entities/tribes/warrior-hut";
import { serialiseResearchBenchComponent } from "./components/ResearchBenchComponent";

// @Incomplete: Make slower
const TIME_PASS_RATE = 300;

const isTimed = process.argv[2] === "timed";
const averageTickTimes = new Array<number>();

/*

Reference for future self:
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

*/

const bundleRectangularHitboxData = (hitbox: RectangularHitbox): RectangularHitboxData => {
   return {
      mass: hitbox.mass,
      offsetX: hitbox.offsetX,
      offsetY: hitbox.offsetY,
      collisionType: hitbox.collisionType,
      localID: hitbox.localID,
      width: hitbox.width,
      height: hitbox.height,
      rotation: hitbox.rotation
   };
}

const bundleCircularHitboxData = (hitbox: CircularHitbox): CircularHitboxData => {
   return {
      mass: hitbox.mass,
      offsetX: hitbox.offsetX,
      offsetY: hitbox.offsetY,
      collisionType: hitbox.collisionType,
      localID: hitbox.localID,
      radius: hitbox.radius
   };
}

const serialiseComponent = <T extends ServerComponentType>(entity: Entity, componentType: T): ComponentData => {
   switch (componentType) {
      case ServerComponentType.aiHelper: return serialiseAIHelperComponent(entity);
      case ServerComponentType.arrow: return serialiseArrowComponent(entity);
      case ServerComponentType.ammoBox: return serialiseAmmoBoxComponent(entity);
      case ServerComponentType.berryBush: return serialiseBerryBushComponent(entity);
      case ServerComponentType.blueprint: return serialiseBlueprintComponent(entity);
      case ServerComponentType.boulder: return serialiseBoulderComponent(entity);
      case ServerComponentType.cactus: return serialiseCactusComponent(entity);
      case ServerComponentType.cooking: return serialiseCookingComponent(entity);
      case ServerComponentType.cow: return serialiseCowComponent(entity);
      case ServerComponentType.door: return serialiseDoorComponent(entity);
      case ServerComponentType.escapeAI: return serialiseEscapeAIComponent(entity);
      case ServerComponentType.fish: return serialiseFishComponent(entity);
      case ServerComponentType.followAI: return serialiseFollowAIComponent(entity);
      case ServerComponentType.frozenYeti: return serialiseFrozenYetiComponent(entity);
      case ServerComponentType.golem: return serialiseGolemComponent(entity);
      case ServerComponentType.health: return serialiseHealthComponent(entity);
      case ServerComponentType.hut: return serialiseHutComponent(entity);
      case ServerComponentType.iceShard: return serialiseIceShardComponent(entity);
      case ServerComponentType.iceSpikes: return serialiseIceSpikesComponent(entity);
      case ServerComponentType.inventory: return serialiseInventoryComponent(entity);
      case ServerComponentType.inventoryUse: return serialiseInventoryUseComponent(entity);
      case ServerComponentType.item: return serialiseItemComponent(entity);
      case ServerComponentType.pebblum: return serialisePebblumComponent(entity);
      case ServerComponentType.physics: return serialisePhysicsComponent(entity);
      case ServerComponentType.player: return serialisePlayerComponent(entity);
      case ServerComponentType.researchBench: return serialiseResearchBenchComponent(entity);
      case ServerComponentType.rockSpike: return serialiseRockSpikeComponent(entity);
      case ServerComponentType.slime: return serialiseSlimeComponent(entity);
      case ServerComponentType.slimeSpit: return serialiseSlimeSpitComponent(entity);
      case ServerComponentType.slimewisp: return serialiseSlimewispComponent(entity);
      case ServerComponentType.snowball: return serialiseSnowballComponent(entity);
      case ServerComponentType.statusEffect: return serialiseStatusEffectComponent(entity);
      case ServerComponentType.throwingProjectile: return serialiseThrowingProjectileComponent(entity);
      case ServerComponentType.tombstone: return serialiseTombstoneComponent(entity);
      case ServerComponentType.totemBanner: return serialiseTotemBannerComponent(entity);
      case ServerComponentType.tree: return serialiseTreeComponent(entity);
      case ServerComponentType.tribe: return serialiseTribeComponent(entity);
      case ServerComponentType.tribeMember: return serialiseTribeMemberComponent(entity);
      case ServerComponentType.tribesman: return serialiseTribesmanComponent(entity);
      case ServerComponentType.turret: return serialiseTurretComponent(entity);
      case ServerComponentType.wanderAI: return serialiseWanderAIComponent(entity);
      case ServerComponentType.yeti: return serialiseYetiComponent(entity);
      case ServerComponentType.zombie: return serialiseZombieComponent(entity);
      case ServerComponentType.tunnel: return serialiseTunnelComponent(entity);
      case ServerComponentType.buildingMaterial: return serialiseBuildingMaterialComponent(entity);
      case ServerComponentType.spikes: return serialiseSpikesComponent(entity);
      case ServerComponentType.tribeWarrior: return serialiseTribeWarriorComponent(entity);
   }

   throw new Error("Unserialised component of type " + componentType);
}

const serialiseEntityData = (entity: Entity): EntityData<EntityType> => {
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

   const components = new Array<ComponentData>();

   const componentTypes = EntityComponents[entity.type];
   for (let i = 0; i < componentTypes.length; i++) {
      const componentType = componentTypes[i];
      components.push(serialiseComponent(entity, componentType));
   }

   return {
      id: entity.id,
      position: entity.position.package(),
      velocity: entity.velocity.package(),
      rotation: entity.rotation,
      circularHitboxes: circularHitboxes,
      rectangularHitboxes: rectangularHitboxes,
      ageTicks: entity.ageTicks,
      type: entity.type as unknown as EntityType,
      collisionBit: entity.collisionBit,
      collisionMask: entity.collisionMask,
      // @Cleanup: Is there some typescript magic we can do to avoid this evil cast
      components: components as unknown as EntityComponentsData<EntityType>
   };
}

const bundleEntityDataArray = (visibleChunkBounds: VisibleChunkBounds): Array<EntityData<EntityType>> => {
   const visibleEntities = getPlayerVisibleEntities(visibleChunkBounds);

   const entityDataArray = new Array<EntityData>();
   for (const entity of visibleEntities) {
      const entityData = serialiseEntityData(entity);
      entityDataArray.push(entityData);
   }

   return entityDataArray;
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

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface PlayerData {
   readonly username: string;
   readonly socket: ISocket;
   /** ID of the player's entity */
   instanceID: number;
   clientIsActive: boolean;
   visibleChunkBounds: VisibleChunkBounds;
   readonly tribe: Tribe;
   /** All hits that have occured to any entity visible to the player */
   hits: Array<HitData>;
   /** All healing done to any entity visible to the player */
   heals: Array<HealData>;
   orbCompletes: Array<ResearchOrbCompleteData>;
   pickedUpItem: boolean;
}

const bundlePlayerTribeData = (playerData: PlayerData): PlayerTribeData => {
   return {
      id: playerData.tribe.id,
      tribeType: playerData.tribe.type,
      hasTotem: playerData.tribe.totem !== null,
      numHuts: playerData.tribe.getNumHuts(),
      tribesmanCap: playerData.tribe.tribesmanCap,
      area: playerData.tribe.getArea().map(tile => [tile.x, tile.y]),
      selectedTechID: playerData.tribe.selectedTechID,
      unlockedTechs: playerData.tribe.unlockedTechs,
      techTreeUnlockProgress: playerData.tribe.techTreeUnlockProgress
   };
}

const bundleEnemyTribesData = (playerData: PlayerData): ReadonlyArray<EnemyTribeData> => {
   const enemyTribesData = new Array<EnemyTribeData>();
   for (const tribe of Board.tribes) {
      if (tribe.id === playerData.tribe.id) {
         continue;
      }
      
      enemyTribesData.push({
         id: tribe.id,
         tribeType: tribe.type
      });
   }
   return enemyTribesData;
}

// @Cleanup: Remove class, just have functions
/** Communicates between the server and players */
class GameServer {
   /** Minimum number of units away from the border that the player will spawn at */
   private static readonly PLAYER_SPAWN_POSITION_PADDING = 100;

   private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

   private readonly playerDataRecord: Record<string, PlayerData> = {};

   private tickInterval: NodeJS.Timeout | undefined;

   private trackedEntityID: number | null = null;

   public isRunning = false;

   private nextTickTime = 0;
   
   /** Sets up the various stuff */
   public setup() {
      spawnInitialEntities();
      forceMaxGrowAllIceSpikes();
   }

   public setTrackedGameObject(id: number | null): void {
      SERVER.trackedEntityID = id;
   }

   public async start(): Promise<void> {
      if (!isTimed) {
         // Seed the random number generator
         if (OPTIONS.inBenchmarkMode) {
            SRandom.seed(40404040404);
         } else {
            SRandom.seed(randInt(0, 9999999999));
         }

         Board.setup();
         SERVER.setup();
      }
      
      if (SERVER.io === null) {
         // Start the server
         SERVER.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SettingsConst.SERVER_PORT);
         SERVER.handlePlayerConnections();
         console.log("Server started on port " + SettingsConst.SERVER_PORT);
      }

      SERVER.isRunning = true;
      
      if (isTimed) {
         if (typeof global.gc === "undefined") {
            throw new Error("GC function is undefined! Most likely need to pass in the '--expose-gc' flag.");
         }

         Math.random = () => SRandom.next();

         let j = 0;
         while (true) {
            // Collect garbage from previous run
            for (let i = 0; i < 10; i++) {
               global.gc();
            }
            
            // Reset the board state
            Board.reset();
            resetYetiTerritoryTiles();
            resetCensus();
            resetComponents();
            resetPerlinNoiseCache();

            // Seed the random number generator
            if (OPTIONS.inBenchmarkMode) {
               SRandom.seed(40404040404);
            } else {
               SRandom.seed(randInt(0, 9999999999));
            }
            
            Board.setup();
            SERVER.setup();

            // Warm up the JIT
            for (let i = 0; i < 50; i++) {
               SERVER.tick();
            }
            
            // @Bug: When at 5000, the average tps starts at around 1.8, while at 1000 it starts at .6
            const numTicks = 1000;
            
            const startTime = performance.now();

            const a = [];
            let l = startTime;
            for (let i = 0; i < numTicks; i++) {
               SERVER.tick();
               const n = performance.now();
               a.push(n - l);
               l = n;
            }

            const timeElapsed = performance.now() - startTime;
            const averageTickTimeMS = timeElapsed / numTicks;
            averageTickTimes.push(averageTickTimeMS);
            console.log("(#" + (j + 1) + ") Average tick MS: " + averageTickTimeMS);
            console.log(Math.min(...a), Math.max(...a));
            j++;
         }
      }

      if (typeof SERVER.tickInterval === "undefined") {
         while (SERVER.isRunning) {
            await SERVER.tick();
         }
         // @Incomplete: warp
         // if (OPTIONS.warp) {
         //    SERVER.tickInterval = setInterval(() => SERVER.tick(), 2);
         // } else {
         //    SERVER.tickInterval = setInterval(() => SERVER.tick(), 1000 / SettingsConst.TPS);
         // }
      }
   }

   public stop(): void {
      if (typeof SERVER.tickInterval !== "undefined") {
         clearInterval(SERVER.tickInterval);
         SERVER.tickInterval = undefined;
      }

      this.io?.close();
   }

   private async tick(): Promise<void> {
      // This is done before each tick to account for player packets causing entities to be removed between ticks.
      Board.removeFlaggedEntities();

      Board.spreadGrass();

      Board.updateTribes();

      Board.updateEntities();
      Board.resolveEntityCollisions();

      runSpawnAttempt();
      runTribeSpawnAttempt();
      
      Board.pushJoinBuffer();
      Board.removeFlaggedEntities();

      // cccc();

      if (!isTimed) {
         await SERVER.sendGameDataPackets();
      }

      // Update server ticks and time
      // This is done at the end of the tick so that information sent by players is associated with the next tick to run
      Board.ticks++;
      Board.time += TIME_PASS_RATE / SettingsConst.TPS / 3600;
      if (Board.time >= 24) {
         Board.time -= 24;
      }
   }

   private getPlayerInstance(data: PlayerData): Entity | null {
      const playerID = data.instanceID;
      if (Board.entityRecord.hasOwnProperty(playerID)) {
         return Board.entityRecord[playerID];
      } else {
         return null;
      }
   }

   public getPlayerFromUsername(username: string): Entity | null {
      for (const data of Object.values(SERVER.playerDataRecord)) {
         if (data.username === username) {
            // Found the player!
            return this.getPlayerInstance(data);
         }
      }

      return null;
   }

   public getPlayerDataFromInstance(instance: Entity): PlayerData | null {
      for (const data of Object.values(SERVER.playerDataRecord)) {
         if (data.instanceID === instance.id) {
            // Found the player!
            return data;
         }
      }

      return null;
   }

   private handlePlayerConnections(): void {
      if (SERVER.io === null) return;
      SERVER.io.on("connection", (socket: ISocket) => {
         let username: string;
         let tribeType: TribeType;
         let visibleChunkBounds: VisibleChunkBounds;
         let spawnPosition: Point;

         // @Temporary
         setTimeout(() => {
            // if(1+1===2)return;
            const barbTribe = new Tribe(TribeType.barbarians);
            
            createTribeTotem(new Point(spawnPosition.x - 500, spawnPosition.y), barbTribe);
            
            {
               // const hut = createWorkerHut(new Point(spawnPosition.x + 250, spawnPosition.y + 800), tribe);
               const hut = createWarriorHut(new Point(spawnPosition.x - 500, spawnPosition.y + 600), barbTribe);
               hut.rotation = Math.PI / 2;
               barbTribe.registerNewWarriorHut(hut);

               const hut2 = createWarriorHut(new Point(spawnPosition.x - 500, spawnPosition.y + 500), barbTribe);
               hut2.rotation = Math.PI / 2;
               barbTribe.registerNewWarriorHut(hut2);
            }





            const gobTribe = new Tribe(TribeType.goblins);
            
            createTribeTotem(new Point(spawnPosition.x + 600, spawnPosition.y - 900), gobTribe);
            
            {
               // const hut = createWorkerHut(new Point(spawnPosition.x + 250, spawnPosition.y + 800), tribe);
               const hut = createWorkerHut(new Point(spawnPosition.x + 650, spawnPosition.y - 300), gobTribe);
               // hut.rotation = -Math.PI/4;
               gobTribe.registerNewWorkerHut(hut);

               const hut2 = createWorkerHut(new Point(spawnPosition.x + 700, spawnPosition.y - 300), gobTribe);
               gobTribe.registerNewWorkerHut(hut2);

               const hut3 = createWorkerHut(new Point(spawnPosition.x + 750, spawnPosition.y - 300), gobTribe);
               gobTribe.registerNewWorkerHut(hut3);

               const hut4 = createWorkerHut(new Point(spawnPosition.x + 800, spawnPosition.y - 300), gobTribe);
               gobTribe.registerNewWorkerHut(hut4);

               const hut5 = createWorkerHut(new Point(spawnPosition.x + 850, spawnPosition.y - 300), gobTribe);
               gobTribe.registerNewWorkerHut(hut5);

               const hut6 = createWorkerHut(new Point(spawnPosition.x + 900, spawnPosition.y - 300), gobTribe);
               // hut6.rotation = 3  * Math.PI / 2;
               gobTribe.registerNewWorkerHut(hut6);
            }
            
            
            
            
            
            
            
            
            
            
            
            
            if(1+1===2)return;

            const tribe = new Tribe(TribeType.barbarians);
            
            createTribeTotem(new Point(spawnPosition.x, spawnPosition.y + 500), tribe);

            const w = 10;
            const h = 8;
            const yo = 300;
            
            // for (let i = -w/2; i < w/2; i++) {
            //    if ((i === 0 || i === 1) && 1+1===1) {
            //       createEmbrasure(new Point(spawnPosition.x + i * 64, spawnPosition.y + yo - 22), tribe, Math.PI, BuildingMaterial.wood);
            //    } else {
            //       createWall(new Point(spawnPosition.x + i * 64, spawnPosition.y + yo), tribe);
            //    }
            // }
            
            for (let i = 0; i < h; i++) {
               createWall(new Point(spawnPosition.x - w/2 * 64, spawnPosition.y + yo + i * 64), tribe);
            }
            
            for (let i = 0; i < h; i++) {
               createWall(new Point(spawnPosition.x + w/2 * 64, spawnPosition.y + yo + i * 64), tribe);
            }

            for (let i = -w/2; i < w/2; i++) {
               // if (i === -1 || i === -2) {
               //    continue;
               // }
               createWall(new Point(spawnPosition.x + i * 64, spawnPosition.y + yo + (h - 1) * 64), tribe);
            }

            // const hut = createWorkerHut(new Point(spawnPosition.x + 250, spawnPosition.y + 800), tribe);
            const hut = createWarriorHut(new Point(spawnPosition.x + 250, spawnPosition.y + 600), tribe);
            hut.rotation = Math.PI;
            tribe.registerNewWarriorHut(hut);

            const hut2 = createWarriorHut(new Point(spawnPosition.x - 50, spawnPosition.y + 630), tribe);
            tribe.registerNewWarriorHut(hut2);
            
            const hut3 = createWarriorHut(new Point(spawnPosition.x - 100, spawnPosition.y + 400), tribe);
            tribe.registerNewWarriorHut(hut3);

            // const hut2 = createWorkerHut(new Point(spawnPosition.x + 150, spawnPosition.y + 600), tribe);
            // hut2.rotation = Math.PI;
            // tribe.registerNewWorkerHut(hut2);

            const hut4 = createWorkerHut(new Point(spawnPosition.x + 50, spawnPosition.y), tribe);
            hut4.rotation = Math.PI;
            tribe.registerNewWorkerHut(hut4);

            // createTree(new Point(spawnPosition.x + 200, spawnPosition.y + 200));
         }, 2000);
         
         socket.on("initial_player_data", (_username: string, _tribeType: TribeType) => {
            username = _username;
            tribeType = _tribeType;
         });

         socket.on("spawn_position_request", () => {
            // Spawn the player in a random position in the world
            spawnPosition = SERVER.generatePlayerSpawnPosition(tribeType);
            socket.emit("spawn_position", spawnPosition.package());
         });

         socket.on("visible_chunk_bounds", (_visibleChunkBounds: VisibleChunkBounds) => {
            visibleChunkBounds = _visibleChunkBounds;
         });

         // When the server receives a request for the initial player data, process it and send back the server player data
         socket.on("initial_game_data_request", () => {
            if (typeof username === "undefined") {
               throw new Error("Player username was undefined when trying to send initial game data.");
            }
            if (typeof visibleChunkBounds === "undefined") {
               throw new Error("Player visible chunk bounds was undefined when trying to send initial game data.");
            }
            
            const tribe = new Tribe(tribeType);
            const player = createPlayer(spawnPosition, tribe);

            const playerData: PlayerData = {
               username: username,
               socket: socket,
               instanceID: player.id,
               clientIsActive: true,
               visibleChunkBounds: visibleChunkBounds,
               tribe: tribe,
               hits: [],
               heals: [],
               orbCompletes: [],
               pickedUpItem: false
            }
            playerData.instanceID = player.id;

            const serverTileData = new Array<ServerTileData>();
            for (let tileIndex = 0; tileIndex < SettingsConst.BOARD_DIMENSIONS * SettingsConst.BOARD_DIMENSIONS; tileIndex++) {
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
               hits: [],
               heals: [],
               orbCompletes: [],
               inventory: {
                  hotbar: {
                     itemSlots: {},
                     width: SettingsConst.INITIAL_PLAYER_HOTBAR_SIZE,
                     height: 1,
                     name: "hotbar"
                  },
                  backpackInventory: {
                     itemSlots: {},
                     width: -1,
                     height: -1,
                     name: "backpack"
                  },
                  backpackSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     name: "backpackSlot"
                  },
                  heldItemSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     name: "heldItemSlot"
                  },
                  craftingOutputItemSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     name: "craftingOutputSlot"
                  },
                  armourSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     name: "armourSlot"
                  },
                  offhand: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     name: "armourSlot"
                  },
                  gloveSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     name: "gloveSlot"
                  }
               },
               tileUpdates: [],
               serverTicks: Board.ticks,
               serverTime: Board.time,
               playerHealth: 20,
               playerTribeData: bundlePlayerTribeData(playerData),
               enemyTribesData: bundleEnemyTribesData(playerData),
               hasFrostShield: false,
               pickedUpItem: false,
               hotbarCrossbowLoadProgressRecord: {},
               visiblePathfindingNodeOccupances: []
            };

            SERVER.playerDataRecord[socket.id] = playerData;

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

            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               processPlayerAttackPacket(player, attackPacket);
            }
         });

         socket.on("crafting_packet", (recipeIndex: number) => {
            if (!SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               return;
            }

            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               processPlayerCraftingPacket(player, recipeIndex);
            }
         });

         socket.on("item_pickup", (entityID: number, inventoryName: string, itemSlot: number, amount: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               const player = this.getPlayerInstance(playerData);
               if (player !== null) {
                  processItemPickupPacket(player, entityID, inventoryName, itemSlot, amount);
               }
            }
         });

         socket.on("item_release", (entityID: number, inventoryName: string, itemSlot: number, amount: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               const player = this.getPlayerInstance(playerData);
               if (player !== null) {
                  processItemReleasePacket(player, entityID, inventoryName, itemSlot, amount);
               }
            }
         });

         socket.on("item_use_packet", (itemSlot: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               const player = this.getPlayerInstance(playerData);
               if (player !== null) {
                  processItemUsePacket(player, itemSlot);
               }
            }
         });

         socket.on("held_item_drop", (dropAmount: number, throwDirection: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               const player = this.getPlayerInstance(playerData);
               if (player !== null) {
                  throwItem(player, "heldItemSlot", 1, dropAmount, throwDirection);
               }
            }
         });

         socket.on("item_drop", (itemSlot: number, dropAmount: number, throwDirection: number) => {
            if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
               const playerData = SERVER.playerDataRecord[socket.id];
               const player = this.getPlayerInstance(playerData);
               if (player !== null) {
                  throwItem(player, "hotbar", itemSlot, dropAmount, throwDirection);
               }
            }
         });

         socket.on("respawn", () => {
            SERVER.respawnPlayer(socket);
         });
         
         socket.on("command", (command: string) => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               registerCommand(command, player);
            }
         });

         socket.on("track_game_object", (id: number | null): void => {
            SERVER.setTrackedGameObject(id);
         });

         socket.on("select_tech", (techID: TechID): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            playerData.tribe.selectedTechID = techID;
         });

         socket.on("unlock_tech", (techID: TechID): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               processTechUnlock(player, techID);
            }
         });

         socket.on("force_unlock_tech", (techID: TechID): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            playerData.tribe.unlockTech(techID);
         })

         socket.on("study_tech", (studyAmount: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               playerData.tribe.studyTech(player.position.x, player.position.y, studyAmount);
            }
         });

         socket.on("place_blueprint", (structureID: number, buildingType: BlueprintType): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               placeBlueprint(player, structureID, buildingType);
            };
         });

         socket.on("modify_building", (structureID: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               modifyBuilding(player, structureID);
            };
         });

         socket.on("deconstruct_building", (structureID: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               deconstructBuilding(structureID);
            };
         });

         socket.on("structure_interact", (structureID: number, interactData: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               interactWithStructure(player, structureID, interactData);
            };
         });

         socket.on("structure_uninteract", (structureID: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               uninteractWithStructure(player, structureID);
            };
         });
      });
   }

   private bundleHotbarCrossbowLoadProgressRecord(player: Entity | null): Record<number, number> {
      if (player === null) {
         return {};
      }
      
      const inventoryUseComponent = InventoryUseComponentArray.getComponent(player.id);
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

      return useInfo.crossbowLoadProgressRecord;
   }

   /** Send data about the server to all players */
   public async sendGameDataPackets(): Promise<void> {
      if (SERVER.io === null) return;
      
      return new Promise(resolve => {
         const currentTime = performance.now();
         while (this.nextTickTime < currentTime) {
            this.nextTickTime += 1000 * SettingsConst.I_TPS;
         }

         setTimeout(() => {
            if (SERVER.trackedEntityID !== null && !Board.entityRecord.hasOwnProperty(SERVER.trackedEntityID)) {
               SERVER.trackedEntityID = null;
            }
   
            let entityDebugData: EntityDebugData | undefined;
            if (SERVER.trackedEntityID !== null) {
               const entity = Board.entityRecord[SERVER.trackedEntityID];
               entityDebugData = getEntityDebugData(entity);
            }
   
            for (const playerData of Object.values(SERVER.playerDataRecord)) {
               if (!playerData.clientIsActive) {
                  continue;
               }
               
               const player = this.getPlayerInstance(playerData);
   
               const tileUpdates = Board.popTileUpdates();
               
               // @Speed @Memory
               const extendedVisibleChunkBounds: VisibleChunkBounds = [
                  Math.max(playerData.visibleChunkBounds[0] - 1, 0),
                  Math.min(playerData.visibleChunkBounds[1] + 1, SettingsConst.BOARD_SIZE - 1),
                  Math.max(playerData.visibleChunkBounds[2] - 1, 0),
                  Math.min(playerData.visibleChunkBounds[3] + 1, SettingsConst.BOARD_SIZE - 1)
               ];
   
               // @Incomplete
               // const playerArmour = player !== null ? getItem(InventoryComponentArray.getComponent(player.id), "armourSlot", 1) : null;
   
               // Initialise the game data packet
               const gameDataPacket: GameDataPacket = {
                  entityDataArray: bundleEntityDataArray(extendedVisibleChunkBounds),
                  inventory: this.bundlePlayerInventoryData(player),
                  hits: playerData.hits,
                  heals: playerData.heals,
                  orbCompletes: playerData.orbCompletes,
                  tileUpdates: tileUpdates,
                  serverTicks: Board.ticks,
                  serverTime: Board.time,
                  playerHealth: player !== null ? HealthComponentArray.getComponent(player.id).health : 0,
                  entityDebugData: entityDebugData,
                  playerTribeData: bundlePlayerTribeData(playerData),
                  enemyTribesData: bundleEnemyTribesData(playerData),
                  // @Incomplete
                  // hasFrostShield: player.immunityTimer === 0 && playerArmour !== null && playerArmour.type === ItemType.deepfrost_armour,
                  hasFrostShield: false,
                  pickedUpItem: playerData.pickedUpItem,
                  hotbarCrossbowLoadProgressRecord: this.bundleHotbarCrossbowLoadProgressRecord(player),
                  // @Incomplete: Only send if dev and the checkbox is enabled
                  visiblePathfindingNodeOccupances: getVisiblePathfindingNodeOccupances(extendedVisibleChunkBounds)
               };
   
               // Send the game data to the player
               playerData.socket.emit("game_data_packet", gameDataPacket);
   
               playerData.hits = [];
               playerData.heals = [];
               playerData.orbCompletes = [];
               playerData.pickedUpItem = false;
            }

            resolve();
         }, this.nextTickTime - currentTime);
      });
   }

   public registerEntityHit(hitData: HitData): void {
      // @Incomplete: Consider all chunks the entity is in instead of just the one at its position
      
      const chunkX = Math.floor(hitData.entityPositionX / SettingsConst.CHUNK_UNITS);
      const chunkY = Math.floor(hitData.entityPositionY / SettingsConst.CHUNK_UNITS);
      for (const playerData of Object.values(this.playerDataRecord)) {
         if (chunkX >= playerData.visibleChunkBounds[0] && chunkX <= playerData.visibleChunkBounds[1] && chunkY >= playerData.visibleChunkBounds[2] && chunkY <= playerData.visibleChunkBounds[3]) {
            playerData.hits.push(hitData);
         }
      }
   }

   public registerEntityHeal(healData: HealData): void {
      // @Incomplete: Consider all chunks the entity is in instead of just the one at its position
      
      const chunkX = Math.floor(healData.entityPositionX / SettingsConst.CHUNK_UNITS);
      const chunkY = Math.floor(healData.entityPositionY / SettingsConst.CHUNK_UNITS);
      for (const playerData of Object.values(this.playerDataRecord)) {
         if (chunkX >= playerData.visibleChunkBounds[0] && chunkX <= playerData.visibleChunkBounds[1] && chunkY >= playerData.visibleChunkBounds[2] && chunkY <= playerData.visibleChunkBounds[3]) {
            playerData.heals.push(healData);
         }
      }
   }

   public registerResearchOrbComplete(orbCompleteData: ResearchOrbCompleteData): void {
      // @Incomplete: Consider all chunks the entity is in instead of just the one at its position
      
      const chunkX = Math.floor(orbCompleteData.x / SettingsConst.CHUNK_UNITS);
      const chunkY = Math.floor(orbCompleteData.y / SettingsConst.CHUNK_UNITS);
      for (const playerData of Object.values(this.playerDataRecord)) {
         if (chunkX >= playerData.visibleChunkBounds[0] && chunkX <= playerData.visibleChunkBounds[1] && chunkY >= playerData.visibleChunkBounds[2] && chunkY <= playerData.visibleChunkBounds[3]) {
            playerData.orbCompletes.push(orbCompleteData);
         }
      }
   }

   public registerPlayerDroppedItemPickup(player: Entity): void {
      for (const playerData of Object.values(this.playerDataRecord)) {
         if (playerData.instanceID === player.id) {
            playerData.pickedUpItem = true;
            
            return;
         }
      }

      console.warn("Couldn't find player to pickup item!");
   }

   private bundlePlayerInventoryData(player: Entity | null): PlayerInventoryData {
      if (player === null) {
         return {
            hotbar: {
               itemSlots: {},
               width: SettingsConst.INITIAL_PLAYER_HOTBAR_SIZE,
               height: 1,
               name: "hotbar"
            },
            backpackInventory: {
               itemSlots: {},
               width: -1,
               height: -1,
               name: "backpack"
            },
            backpackSlot: {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "backpackSlot"
            },
            heldItemSlot: {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "heldItemSlot"
            },
            craftingOutputItemSlot: {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "craftingOutputSlot"
            },
            armourSlot: {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "armourSlot"
            },
            offhand: {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "offhand"
            },
            gloveSlot: {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "gloveSlot"
            }
         };
      } else {
         const tribeComponent = TribeComponentArray.getComponent(player.id);
         
         return {
            hotbar: SERVER.bundleInventory(player, "hotbar"),
            backpackInventory: SERVER.bundleInventory(player, "backpack"),
            backpackSlot: SERVER.bundleInventory(player, "backpackSlot"),
            heldItemSlot: SERVER.bundleInventory(player, "heldItemSlot"),
            craftingOutputItemSlot: SERVER.bundleInventory(player, "craftingOutputSlot"),
            armourSlot: SERVER.bundleInventory(player, "armourSlot"),
            offhand: tribeComponent.tribe.type === TribeType.barbarians ? SERVER.bundleInventory(player, "offhand") : {
               itemSlots: {},
               width: 1,
               height: 1,
               name: "offhand"
            },
            gloveSlot: SERVER.bundleInventory(player, "gloveSlot")
         };
      }
   }

   private bundleInventory(player: Entity, inventoryName: string): Inventory {
      const inventoryComponent = InventoryComponentArray.getComponent(player.id);
      return getInventory(inventoryComponent, inventoryName);
   }

   private handlePlayerDisconnect(socket: ISocket): void {
      if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
         const playerData = SERVER.playerDataRecord[socket.id];
         const player = this.getPlayerInstance(playerData);
         if (player !== null) {
            player.remove();
         }

         delete SERVER.playerDataRecord[socket.id];
      }
   }

   private sendGameDataSyncPacket(socket: ISocket): void {
      if (SERVER.playerDataRecord.hasOwnProperty(socket.id)) {
         const playerData = SERVER.playerDataRecord[socket.id];
         const player = this.getPlayerInstance(playerData);
         if (player === null) {
            // If the player is dead, send a default packet
            socket.emit("game_data_sync_packet", {
               position: [0, 0],
               velocity: [0, 0],
               acceleration: [0, 0],
               rotation: 0,
               health: 0,
               inventory: SERVER.bundlePlayerInventoryData(player)
            });
            return;
         }

         const packet: GameDataSyncPacket = {
            position: player.position.package(),
            velocity: player.velocity.package(),
            acceleration: player.acceleration.package(),
            rotation: player.rotation,
            health: HealthComponentArray.getComponent(player.id).health,
            inventory: SERVER.bundlePlayerInventoryData(player)
         };

         socket.emit("game_data_sync_packet", packet);
      }
   }

   private processPlayerDataPacket(socket: ISocket, playerDataPacket: PlayerDataPacket): void {
      const playerData = SERVER.playerDataRecord[socket.id];
      const player = this.getPlayerInstance(playerData);
      if (player === null) {
         return;
      }

      const inventoryUseComponent = InventoryUseComponentArray.getComponent(player.id);
      const hotbarUseInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

      player.position.x = playerDataPacket.position[0];
      player.position.y = playerDataPacket.position[1];
      player.velocity = Point.unpackage(playerDataPacket.velocity);
      player.acceleration = Point.unpackage(playerDataPacket.acceleration);
      player.rotation = playerDataPacket.rotation;
      playerData.visibleChunkBounds = playerDataPacket.visibleChunkBounds;
      
      const physicsComponent = PhysicsComponentArray.getComponent(player.id);
      physicsComponent.hitboxesAreDirty = true;
      
      hotbarUseInfo.selectedItemSlot = playerDataPacket.selectedItemSlot;

      const playerComponent = PlayerComponentArray.getComponent(player.id);
      playerComponent.interactingEntityID = playerDataPacket.interactingEntityID !== null ? playerDataPacket.interactingEntityID : 0;

      if (playerDataPacket.mainAction === TribeMemberAction.eat && hotbarUseInfo.currentAction !== TribeMemberAction.eat) {
         startEating(player, "hotbar");
      } else if (playerDataPacket.mainAction === TribeMemberAction.chargeBow && hotbarUseInfo.currentAction !== TribeMemberAction.chargeBow) {
         startChargingBow(player, "hotbar");
      } else if (playerDataPacket.mainAction === TribeMemberAction.chargeSpear && hotbarUseInfo.currentAction !== TribeMemberAction.chargeSpear) {
         startChargingSpear(player, "hotbar");
      } else if (playerDataPacket.mainAction === TribeMemberAction.chargeBattleaxe && hotbarUseInfo.currentAction !== TribeMemberAction.chargeBattleaxe) {
         startChargingBattleaxe(player, "hotbar");
      } else {
         hotbarUseInfo.currentAction = playerDataPacket.mainAction;
      }

      const tribeComponent = TribeComponentArray.getComponent(player.id);
      if (tribeComponent.tribe.type === TribeType.barbarians) {
         const offhandUseInfo = getInventoryUseInfo(inventoryUseComponent, "offhand");

         if (playerDataPacket.offhandAction === TribeMemberAction.eat && offhandUseInfo.currentAction !== TribeMemberAction.eat) {
            startEating(player, "offhand");
         } else if (playerDataPacket.offhandAction === TribeMemberAction.chargeBow && offhandUseInfo.currentAction !== TribeMemberAction.chargeBow) {
            startChargingBow(player, "offhand");
         } else if (playerDataPacket.offhandAction === TribeMemberAction.chargeSpear && offhandUseInfo.currentAction !== TribeMemberAction.chargeSpear) {
            startChargingSpear(player, "offhand");
         } else if (playerDataPacket.offhandAction === TribeMemberAction.chargeBattleaxe && offhandUseInfo.currentAction !== TribeMemberAction.chargeBattleaxe) {
            startChargingBattleaxe(player, "offhand");
         } else {
            offhandUseInfo.currentAction = playerDataPacket.offhandAction;
         }
      }
   }

   private generatePlayerSpawnPosition(tribeType: TribeType): Point {
      const tribeInfo = TRIBE_INFO_RECORD[tribeType];
      for (let numAttempts = 0; numAttempts < 50; numAttempts++) {
         const biomeName = randItem(tribeInfo.biomes);
         const tile = randItem(getTilesOfBiome(biomeName));

         const x = (tile.x + Math.random()) * SettingsConst.TILE_SIZE;
         const y = (tile.y + Math.random()) * SettingsConst.TILE_SIZE;

         if (x < GameServer.PLAYER_SPAWN_POSITION_PADDING || x >= SettingsConst.BOARD_UNITS - GameServer.PLAYER_SPAWN_POSITION_PADDING || y < GameServer.PLAYER_SPAWN_POSITION_PADDING || y >= SettingsConst.BOARD_UNITS - GameServer.PLAYER_SPAWN_POSITION_PADDING) {
            continue;
         }

         return new Point(x, y);
      }
      
      // If all else fails, just pick a random position
      const x = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      const y = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      return new Point(x, y);
   }

   private respawnPlayer(socket: ISocket): void {
      const playerData = SERVER.playerDataRecord[socket.id];

      // Calculate spawn position
      let spawnPosition: Point;
      if (playerData.tribe.totem !== null) {
         spawnPosition = playerData.tribe.totem.position.copy();
         const offsetDirection = 2 * Math.PI * Math.random();
         spawnPosition.x += 100 * Math.sin(offsetDirection);
         spawnPosition.y += 100 * Math.cos(offsetDirection);
      } else {
         spawnPosition = this.generatePlayerSpawnPosition(playerData.tribe.type);
      }

      const player = createPlayer(spawnPosition, playerData.tribe);

      // Update the player data's instance
      SERVER.playerDataRecord[socket.id].instanceID = player.id;

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
}

export let SERVER = new GameServer();

// Only start the server if jest isn't running
if (process.env.NODE_ENV !== "test") {
   SERVER.start();
}