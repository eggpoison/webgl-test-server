import { BiomeName, DecorationInfo, GrassTileInfo, IEntityType, Point, RIVER_STEPPING_STONE_SIZES, RiverSteppingStoneData, SettingsConst, ServerTileUpdateData, TileType, TileTypeConst, WaterRockData, circleAndRectangleDoIntersect, circlesDoIntersect, randItem } from "webgl-test-shared";
import Chunk from "./Chunk";
import Tile from "./Tile";
import CircularHitbox from "./hitboxes/CircularHitbox";
import { addTileToCensus, getTilesOfType, removeEntityFromCensus, removeTileFromCensus } from "./census";
import Tribe from "./Tribe";
import Hitbox from "./hitboxes/Hitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import generateTerrain from "./world-generation/terrain-generation";
import { ArrowComponentArray, BerryBushComponentArray, BoulderComponentArray, CactusComponentArray, ComponentArray, CookingComponentArray, CowComponentArray, EscapeAIComponentArray, FishComponentArray, FollowAIComponentArray, FrozenYetiComponentArray, HealthComponentArray, HutComponentArray, IceShardComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, PlayerComponentArray, RockSpikeProjectileComponentArray, SlimeComponentArray, SlimewispComponentArray, SnowballComponentArray, ThrowingProjectileComponentArray, SlimeSpitComponentArray, TombstoneComponentArray, TotemBannerComponentArray, TreeComponentArray, TribeComponentArray, TribeMemberComponentArray, TribesmanComponentArray, WanderAIComponentArray, YetiComponentArray, ZombieComponentArray, DoorComponentArray, GolemComponentArray, IceSpikesComponentArray, PebblumComponentArray, BlueprintComponentArray, TurretComponentArray, AmmoBoxComponentArray, ResearchBenchComponentArray, SpikesComponentArray } from "./components/ComponentArray";
import { tickInventoryUseComponent } from "./components/InventoryUseComponent";
import { onPlayerRemove, tickPlayer } from "./entities/tribes/player";
import Entity from "./Entity";
import { tickHealthComponent } from "./components/HealthComponent";
import { onBerryBushRemove, tickBerryBush } from "./entities/resources/berry-bush";
import { onIceShardRemove, tickIceShard } from "./entities/projectiles/ice-shards";
import { onCowRemove, tickCow } from "./entities/mobs/cow";
import { onKrumblidRemove, tickKrumblid } from "./entities/mobs/krumblid";
import { tickItemComponent } from "./components/ItemComponent";
import { onTribeWorkerRemove, tickTribeWorker } from "./entities/tribes/tribe-worker";
import { onTombstoneRemove, tickTombstone } from "./entities/tombstone";
import { onZombieRemove, tickZombie } from "./entities/mobs/zombie";
import { onSlimewispRemove, tickSlimewisp } from "./entities/mobs/slimewisp";
import { onSlimeRemove, tickSlime } from "./entities/mobs/slime";
import { onArrowRemove, tickArrowProjectile } from "./entities/projectiles/wooden-arrow";
import { onYetiRemove, tickYeti } from "./entities/mobs/yeti";
import { onSnowballRemove, tickSnowball } from "./entities/snowball";
import { onFishRemove, tickFish } from "./entities/mobs/fish";
import { StatusEffectComponentArray, tickStatusEffectComponent } from "./components/StatusEffectComponent";
import { onTreeRemove } from "./entities/resources/tree";
import { onBoulderRemove } from "./entities/resources/boulder";
import { onCactusRemove } from "./entities/resources/cactus";
import { onIceSpikesRemove, tickIceSpikes } from "./entities/resources/ice-spikes";
import { onTribeTotemRemove } from "./entities/tribes/tribe-totem";
import { onItemEntityRemove, tickItemEntity } from "./entities/item-entity";
import { onBarrelRemove } from "./entities/tribes/barrel";
import { onFrozenYetiRemove, tickFrozenYeti } from "./entities/mobs/frozen-yeti";
import { onRockSpikeRemove, tickRockSpikeProjectile } from "./entities/projectiles/rock-spike";
import { AIHelperComponentArray, tickAIHelperComponent } from "./components/AIHelperComponent";
import { onCampfireRemove, tickCampfire } from "./entities/cooking-entities/campfire";
import { onFurnaceRemove, tickFurnace } from "./entities/cooking-entities/furnace";
import { onSpearProjectileRemove, tickSpearProjectile } from "./entities/projectiles/spear-projectile";
import { onWorkerHutRemove } from "./entities/tribes/worker-hut";
import { onResearchBenchRemove } from "./entities/research-bench";
import { onWarriorHutRemove } from "./entities/tribes/warrior-hut";
import { onTribeWarriorRemove, tickTribeWarrior } from "./entities/tribes/tribe-warrior";
import { onWoodenWallRemove } from "./entities/structures/wooden-wall";
import { onSlimeSpitRemove, tickSlimeSpit } from "./entities/projectiles/slime-spit";
import { tickSpitPoison } from "./entities/projectiles/spit-poison";
import { onWoodenDoorRemove } from "./entities/structures/wooden-door";
import { tickDoorComponent } from "./components/DoorComponent";
import { onBattleaxeProjectileRemove, tickBattleaxeProjectile } from "./entities/projectiles/battleaxe-projectile";
import { onGolemRemove, tickGolem } from "./entities/mobs/golem";
import { onPlanterBoxRemove } from "./entities/structures/planter-box";
import { onIceArrowRemove, tickIceArrow } from "./entities/projectiles/ice-arrow";
import { onPebblumRemove, tickPebblum } from "./entities/mobs/pebblum";
import { PhysicsComponentArray, tickPhysicsComponent } from "./components/PhysicsComponent";
import { onWorkbenchRemove } from "./entities/workbench";
import { onWoodenSpikesRemove } from "./entities/structures/wooden-spikes";
import { onPunjiSticksRemove } from "./entities/structures/punji-sticks";
import { onWoodenEmbrasureRemove } from "./entities/structures/wooden-embrasure";
import { onBlueprintEntityRemove } from "./entities/blueprint-entity";
import { onBallistaRemove, tickBallista } from "./entities/structures/ballista";
import { onSlingTurretRemove, tickSlingTurret } from "./entities/structures/sling-turret";
import { tickResearchBenchComponent } from "./components/ResearchBenchComponent";
import { clearEntityPathfindingNodes, markPathfindingNodeClearance, markWallTileInPathfinding, updateDynamicPathfindingNodes, updateEntityPathfindingNodeOccupance } from "./pathfinding";
import OPTIONS from "./options";
import { onWoodenTunnelRemove } from "./entities/structures/wooden-tunnel";
import { CollisionVars, collide, isColliding } from "./collision";

const START_TIME = 6;

const OFFSETS: ReadonlyArray<[xOffest: number, yOffset: number]> = [
   [-1, -1],
   [0, -1],
   [1, -1],
   [-1, 0],
   [1, 0],
   [-1, 1],
   [0, 1],
   [1, 1],
];

interface Testt {
   readonly entity1: Entity;
   readonly entity2: Entity;
   readonly collisionNum: number;
}

abstract class Board {
   public static ticks = 0;

   /** The time of day the server is currently in (from 0 to 23) */
   public static time = START_TIME;

   public static entities = new Array<Entity>();

   public static entityRecord: { [id: number]: Entity } = {};

   public static tiles: Array<Tile>;
   public static chunks = new Array<Chunk>();

   private static riverFlowDirections: Record<number, Record<number, number>>;
   public static waterRocks: ReadonlyArray<WaterRockData>;
   public static riverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;

   private static tileUpdateCoordinates: Set<number>;

   private static entityJoinBuffer = new Array<Entity>();
   private static entityRemoveBuffer = new Array<Entity>();

   public static tribes = new Array<Tribe>();

   // @Incomplete @Bug: These shouldn't be tiles but instead serverdata, so that they aren't counted in the census
   public static edgeTiles = new Array<Tile>();
   public static edgeRiverFlowDirections: Record<number, Record<number, number>>;
   public static edgeRiverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;

   public static grassInfo: Record<number, Record<number, GrassTileInfo>>;

   public static decorations: ReadonlyArray<DecorationInfo>;

   public static setup(): void {
      this.initialiseChunks();

      const generationInfo = generateTerrain();
      this.tiles = generationInfo.tiles;
      this.riverFlowDirections = generationInfo.riverFlowDirections;
      this.waterRocks = generationInfo.waterRocks;
      this.riverSteppingStones = generationInfo.riverSteppingStones;
      this.edgeTiles = generationInfo.edgeTiles;
      this.edgeRiverFlowDirections = generationInfo.edgeRiverFlowDirections;
      this.edgeRiverSteppingStones = generationInfo.edgeRiverSteppingStones;
      this.grassInfo = generationInfo.grassInfo;
      this.decorations = generationInfo.decorations;

      if (OPTIONS.generateWalls) {
         for (let i = 0; i < generationInfo.tiles.length; i++) {
            const tile = generationInfo.tiles[i];

            if (tile.isWall) {
               // Mark which chunks have wall tiles
               const chunkX = Math.floor(tile.x / SettingsConst.CHUNK_SIZE);
               const chunkY = Math.floor(tile.y / SettingsConst.CHUNK_SIZE);
               const chunk = this.getChunk(chunkX, chunkY);
               chunk.hasWallTiles = true;
               
               // Mark inaccessible pathfinding nodes
               markWallTileInPathfinding(tile.x, tile.y);
            }
         }
      }

      this.tileUpdateCoordinates = new Set<number>();

      // Add river stepping stones to chunks
      for (const steppingStoneData of generationInfo.riverSteppingStones) {
         const size = RIVER_STEPPING_STONE_SIZES[steppingStoneData.size];
         const minChunkX = Math.max(Math.min(Math.floor((steppingStoneData.positionX - size/2) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor((steppingStoneData.positionX + size/2) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor((steppingStoneData.positionY - size/2) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor((steppingStoneData.positionY + size/2) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
         
         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = this.getChunk(chunkX, chunkY);
               chunk.riverSteppingStones.push(steppingStoneData);
            }
         }
      }
   }

   public static reset(): void {
      this.time = START_TIME;
      this.ticks = 0;
      this.chunks = [];
      this.entities = [];
      this.entityRecord = {};
      this.entityJoinBuffer = [];
      this.entityRemoveBuffer = [];
      this.tribes = [];
      this.edgeTiles = [];
   }

   public static isNight(): boolean {
      return Board.time < 6 || Board.time >= 18;
   }

   private static initialiseChunks(): void {
      for (let y = 0; y < SettingsConst.BOARD_SIZE; y++) {
         for (let x = 0; x < SettingsConst.BOARD_SIZE; x++) {
            const chunk = new Chunk(x, y);
            this.chunks.push(chunk);
         }
      }
   }

   public static tickIntervalHasPassed(intervalSeconds: number): boolean {
      const ticksPerInterval = intervalSeconds * SettingsConst.TPS;
      
      const previousCheck = (this.ticks - 1) / ticksPerInterval;
      const check = this.ticks / ticksPerInterval;
      return Math.floor(previousCheck) !== Math.floor(check);
   }

   public static getRiverFlowDirections(): Record<number, Record<number, number>> {
      return this.riverFlowDirections;
   }

   public static getTile(tileX: number, tileY: number): Tile {
      const tileIndex = tileY * SettingsConst.BOARD_DIMENSIONS + tileX;
      return this.tiles[tileIndex];
   }

   public static replaceTile(tileX: number, tileY: number, tileType: TileTypeConst, biomeName: BiomeName, isWall: boolean, riverFlowDirection: number): void {
      const tileIndex = tileY * SettingsConst.BOARD_DIMENSIONS + tileX;
      const tile = this.tiles[tileIndex];

      removeTileFromCensus(tile);
      
      tile.type = tileType;
      tile.biomeName = biomeName;
      tile.isWall = isWall;
      tile.riverFlowDirection = riverFlowDirection;

      addTileToCensus(tile);
   }

   public static getChunk(chunkX: number, chunkY: number): Chunk {
      const chunkIndex = chunkY * SettingsConst.BOARD_SIZE + chunkX;
      return this.chunks[chunkIndex];
   }

   public static addTribe(tribe: Tribe): void {
      this.tribes.push(tribe);
   }

   public static removeTribe(tribe: Tribe): void {
      const idx = this.tribes.indexOf(tribe);
      if (idx !== -1) {
         this.tribes.splice(idx, 1);
      }
   }

   public static updateTribes(): void {
      for (const tribe of this.tribes) {
         tribe.tick();
      }
   }

   public static entityIsFlaggedForRemoval(entity: Entity): boolean {
      return this.entityRemoveBuffer.indexOf(entity) !== -1;
   }

   /** Removes game objects flagged for deletion */
   public static removeFlaggedEntities(): void {
      for (const entity of this.entityRemoveBuffer) {
         const idx = this.entities.indexOf(entity);
         if (idx === -1) {
            throw new Error("Tried to remove a game object which doesn't exist or was already removed.");
         }
   
         this.entities.splice(idx, 1);
   
         for (let i = 0; i < entity.chunks.length; i++) {
            const chunk = entity.chunks[i];
            entity.removeFromChunk(chunk);
         }

         if (AIHelperComponentArray.hasComponent(entity)) {
            const aiHelperComponent = AIHelperComponentArray.getComponent(entity.id);
            for (let i = 0; i < aiHelperComponent.visibleChunks.length; i++) {
               const chunk = aiHelperComponent.visibleChunks[i];
               chunk.viewingEntities.splice(chunk.viewingEntities.indexOf(entity), 1);
            }
         }

         delete this.entityRecord[entity.id];
         removeEntityFromCensus(entity);

         clearEntityPathfindingNodes(entity);

         switch (entity.type) {
            case IEntityType.cow: onCowRemove(entity); break;
            case IEntityType.fish: onFishRemove(entity); break;
            case IEntityType.krumblid: onKrumblidRemove(entity); break;
            case IEntityType.slime: onSlimeRemove(entity); break;
            case IEntityType.slimewisp: onSlimewispRemove(entity); break;
            case IEntityType.woodenArrowProjectile: onArrowRemove(entity); break;
            case IEntityType.iceShardProjectile: onIceShardRemove(entity); break;
            case IEntityType.yeti: onYetiRemove(entity); break;
            case IEntityType.tree: onTreeRemove(entity); break;
            case IEntityType.zombie: onZombieRemove(entity); break;
            case IEntityType.berryBush: onBerryBushRemove(entity); break;
            case IEntityType.boulder: onBoulderRemove(entity); break;
            case IEntityType.cactus: onCactusRemove(entity); break;
            case IEntityType.iceSpikes: onIceSpikesRemove(entity); break;
            case IEntityType.tribeTotem: onTribeTotemRemove(entity); break;
            case IEntityType.barrel: onBarrelRemove(entity); break;
            case IEntityType.frozenYeti: onFrozenYetiRemove(entity); break;
            case IEntityType.campfire: onCampfireRemove(entity); break;
            case IEntityType.furnace: onFurnaceRemove(entity); break;
            case IEntityType.spearProjectile: onSpearProjectileRemove(entity); break;
            case IEntityType.snowball: onSnowballRemove(entity); break;
            case IEntityType.tombstone: onTombstoneRemove(entity); break;
            case IEntityType.player: onPlayerRemove(entity); break;
            case IEntityType.workerHut: onWorkerHutRemove(entity); break;
            case IEntityType.warriorHut: onWarriorHutRemove(entity); break;
            case IEntityType.tribeWorker: onTribeWorkerRemove(entity); break;
            case IEntityType.tribeWarrior: onTribeWarriorRemove(entity); break;
            case IEntityType.researchBench: onResearchBenchRemove(entity); break;
            case IEntityType.woodenWall: onWoodenWallRemove(entity); break;
            case IEntityType.woodenDoor: onWoodenDoorRemove(entity); break;
            case IEntityType.battleaxeProjectile: onBattleaxeProjectileRemove(entity); break;
            case IEntityType.golem: onGolemRemove(entity); break;
            case IEntityType.planterBox: onPlanterBoxRemove(entity); break;
            case IEntityType.iceArrow: onIceArrowRemove(entity); break;
            case IEntityType.pebblum: onPebblumRemove(entity); break;
            case IEntityType.slimeSpit: onSlimeSpitRemove(entity); break;
            case IEntityType.rockSpikeProjectile: onRockSpikeRemove(entity); break;
            case IEntityType.itemEntity: onItemEntityRemove(entity); break;
            case IEntityType.workbench: onWorkbenchRemove(entity); break;
            case IEntityType.woodenSpikes: onWoodenSpikesRemove(entity); break;
            case IEntityType.punjiSticks: onPunjiSticksRemove(entity); break;
            case IEntityType.woodenEmbrasure: onWoodenEmbrasureRemove(entity); break;
            case IEntityType.blueprintEntity: onBlueprintEntityRemove(entity); break;
            case IEntityType.ballista: onBallistaRemove(entity); break;
            case IEntityType.slingTurret: onSlingTurretRemove(entity); break;
            case IEntityType.woodenTunnel: onWoodenTunnelRemove(entity); break;
         }
      }

      this.entityRemoveBuffer = new Array<Entity>();
   }

   public static updateEntities(): void {
      if (Board.ticks % 3 === 0) {
         for (let i = 0; i < AIHelperComponentArray.components.length; i++) {
            const entity = AIHelperComponentArray.getEntity(i);
            tickAIHelperComponent(entity);
         }
      }

      // @Speed: Ideally we should remove this as there are many entities which the switch won't fire for at all
      for (let i = 0; i < this.entities.length; i++) {
         const entity = this.entities[i];

         switch (entity.type) {
            case IEntityType.player: tickPlayer(entity); break;
            case IEntityType.tribeWorker: tickTribeWorker(entity); break;
            case IEntityType.tribeWarrior: tickTribeWarrior(entity); break;
            case IEntityType.berryBush: tickBerryBush(entity); break;
            case IEntityType.iceShardProjectile: tickIceShard(entity); break;
            case IEntityType.cow: tickCow(entity); break;
            case IEntityType.krumblid: tickKrumblid(entity); break;
            case IEntityType.tombstone: tickTombstone(entity); break;
            case IEntityType.zombie: tickZombie(entity); break;
            case IEntityType.slimewisp: tickSlimewisp(entity); break;
            case IEntityType.slime: tickSlime(entity); break;
            case IEntityType.woodenArrowProjectile: tickArrowProjectile(entity); break;
            case IEntityType.yeti: tickYeti(entity); break;
            case IEntityType.snowball: tickSnowball(entity); break;
            case IEntityType.fish: tickFish(entity); break;
            case IEntityType.itemEntity: tickItemEntity(entity); break;
            case IEntityType.frozenYeti: tickFrozenYeti(entity); break;
            case IEntityType.rockSpikeProjectile: tickRockSpikeProjectile(entity); break;
            case IEntityType.campfire: tickCampfire(entity); break;
            case IEntityType.furnace: tickFurnace(entity); break;
            case IEntityType.spearProjectile: tickSpearProjectile(entity); break;
            case IEntityType.slimeSpit: tickSlimeSpit(entity); break;
            case IEntityType.spitPoison: tickSpitPoison(entity); break;
            case IEntityType.battleaxeProjectile: tickBattleaxeProjectile(entity); break;
            case IEntityType.golem: tickGolem(entity); break;
            case IEntityType.iceSpikes: tickIceSpikes(entity); break;
            case IEntityType.iceArrow: tickIceArrow(entity); break;
            case IEntityType.pebblum: tickPebblum(entity); break;
            case IEntityType.ballista: tickBallista(entity); break;
            case IEntityType.slingTurret: tickSlingTurret(entity); break;
         }

         entity.tick();
      }

      for (let i = 0; i < InventoryUseComponentArray.components.length; i++) {
         const inventoryUseComponent = InventoryUseComponentArray.components[i];
         tickInventoryUseComponent(inventoryUseComponent);
      }

      for (let i = 0; i < HealthComponentArray.components.length; i++) {
         const healthComponent = HealthComponentArray.components[i];
         tickHealthComponent(healthComponent);
      }

      for (let i = 0; i < ItemComponentArray.components.length; i++) {
         const itemComponent = ItemComponentArray.components[i];
         tickItemComponent(itemComponent);
      }

      for (let i = 0; i < StatusEffectComponentArray.components.length; i++) {
         const entity = StatusEffectComponentArray.getEntity(i);
         tickStatusEffectComponent(entity);
      }

      for (let i = 0; i < DoorComponentArray.components.length; i++) {
         const door = DoorComponentArray.getEntity(i);
         tickDoorComponent(door);
      }

      for (let i = 0; i < ResearchBenchComponentArray.components.length; i++) {
         const entity = ResearchBenchComponentArray.getEntity(i);
         tickResearchBenchComponent(entity);
      }

      // The physics component ticking must be done at the end so there is time for the positionIsDirty and hitboxesAreDirty flags to collect
      for (let i = 0; i < PhysicsComponentArray.components.length; i++) {
         const entity = PhysicsComponentArray.getEntity(i);
         tickPhysicsComponent(entity);
      }

      updateDynamicPathfindingNodes();
   }

   public static resolveEntityCollisions(): void {
      // @Speed: Multithreading
      
      const a = new Array<Testt>();
      
      const numChunks = SettingsConst.BOARD_SIZE * SettingsConst.BOARD_SIZE;
      for (let i = 0; i < numChunks; i++) {
         const chunk = this.chunks[i];
         for (let j = 0; j <= chunk.entities.length - 2; j++) {
            const entity1 = chunk.entities[j];
            for (let k = j + 1; k <= chunk.entities.length - 1; k++) {
               const entity2 = chunk.entities[k];

               const collisionNum = isColliding(entity1, entity2);
               if (collisionNum !== CollisionVars.NO_COLLISION) {
                  a.push({
                     entity1: entity1,
                     entity2: entity2,
                     collisionNum: collisionNum
                  });
               }
            }
         }
      }

      for (let i = 0; i < a.length; i++) {
         const test = a[i];

         // Check for duplicates
         // @Speed O(n^2)
         let isDupe = false;
         for (let j = 0; j < i; j++) {
            const test2 = a[j];
            if (test.entity1.id === test2.entity1.id && test.entity2.id === test2.entity2.id && test.collisionNum === test2.collisionNum) {
               isDupe = true;
               break;
            }
         }
         if (isDupe) {
            continue;
         }
                  
         const entity1HitboxIndex = test.collisionNum & 0xFF;
         const entity2HitboxIndex = (test.collisionNum & 0xFF00) >> 8;
         
         collide(test.entity1, test.entity2, entity1HitboxIndex, entity2HitboxIndex);
         collide(test.entity2, test.entity1, entity2HitboxIndex, entity1HitboxIndex);
      }
   }

   /** Registers a tile update to be sent to the clients */
   public static registerNewTileUpdate(x: number, y: number): void {
      const tileIndex = y * SettingsConst.BOARD_DIMENSIONS + x;
      this.tileUpdateCoordinates.add(tileIndex);
   }

   /** Get all tile updates and reset them */
   public static popTileUpdates(): ReadonlyArray<ServerTileUpdateData> {
      // Generate the tile updates array
      const tileUpdates = new Array<ServerTileUpdateData>();
      for (const tileIndex of this.tileUpdateCoordinates) {
         const tileX = tileIndex % SettingsConst.BOARD_DIMENSIONS;
         const tileY = Math.floor(tileIndex / SettingsConst.BOARD_DIMENSIONS);
         
         const tile = this.getTile(tileX, tileY);
         tileUpdates.push({
            tileIndex: tileIndex,
            type: tile.type as unknown as TileType,
            isWall: tile.isWall
         });
      }

      // reset the tile update coordiantes
      this.tileUpdateCoordinates.clear();

      return tileUpdates;
   }

   public static spreadGrass(): void {
      const grassTiles = getTilesOfType(TileType.grass);

      let numSpreadedGrass = grassTiles.length / SettingsConst.BOARD_DIMENSIONS / SettingsConst.BOARD_DIMENSIONS / SettingsConst.TPS;
      if (Math.random() > numSpreadedGrass % 1) {
         numSpreadedGrass = Math.ceil(numSpreadedGrass);
      } else {
         numSpreadedGrass = Math.floor(numSpreadedGrass);
      }
      for (let i = 0; i < numSpreadedGrass; i++) {
         const tile = randItem(grassTiles);
         
         const offset = randItem(OFFSETS);
         const tileX = tile.x + offset[0];
         const tileY = tile.y + offset[1];
         if (!Board.tileIsInBoard(tileX, tileY)) {
            continue;
         }

         const dirtTile = Board.getTile(tileX, tileY);
         if (dirtTile.type === TileTypeConst.dirt) {
            this.replaceTile(tileX, tileY, TileTypeConst.grass, "grasslands", false, 0);
         }
      }
   }

   public static addEntityToJoinBuffer(entity: Entity): void {
      this.entityJoinBuffer.push(entity);
   }

   public static removeEntityFromJoinBuffer(entity: Entity): void {
      const idx = this.entityJoinBuffer.indexOf(entity);
      if (idx !== -1) {
         this.entityJoinBuffer.splice(idx, 1);
      }
   }

   public static addEntityToRemoveBuffer(entity: Entity): void {
      this.entityRemoveBuffer.push(entity);
   }

   private static pushComponentsFromArray(componentArray: ComponentArray): void {
      while (componentArray.componentBuffer.length > 0) {
         componentArray.pushComponentFromBuffer();
      }
   }

   public static pushJoinBuffer(): void {
      this.pushComponentsFromArray(TribeComponentArray);
      this.pushComponentsFromArray(InventoryComponentArray);
      this.pushComponentsFromArray(HealthComponentArray);
      this.pushComponentsFromArray(ItemComponentArray);
      this.pushComponentsFromArray(StatusEffectComponentArray);
      this.pushComponentsFromArray(TotemBannerComponentArray);
      this.pushComponentsFromArray(TreeComponentArray);
      this.pushComponentsFromArray(BerryBushComponentArray);
      this.pushComponentsFromArray(InventoryUseComponentArray);
      this.pushComponentsFromArray(BoulderComponentArray);
      this.pushComponentsFromArray(IceShardComponentArray);
      this.pushComponentsFromArray(CowComponentArray);
      this.pushComponentsFromArray(WanderAIComponentArray);
      this.pushComponentsFromArray(EscapeAIComponentArray);
      this.pushComponentsFromArray(AIHelperComponentArray);
      this.pushComponentsFromArray(FollowAIComponentArray);
      this.pushComponentsFromArray(CactusComponentArray);
      this.pushComponentsFromArray(TribeMemberComponentArray);
      this.pushComponentsFromArray(PlayerComponentArray);
      this.pushComponentsFromArray(TribesmanComponentArray);
      this.pushComponentsFromArray(TombstoneComponentArray);
      this.pushComponentsFromArray(ZombieComponentArray);
      this.pushComponentsFromArray(SlimewispComponentArray);
      this.pushComponentsFromArray(SlimeComponentArray);
      this.pushComponentsFromArray(ArrowComponentArray);
      this.pushComponentsFromArray(YetiComponentArray);
      this.pushComponentsFromArray(SnowballComponentArray);
      this.pushComponentsFromArray(FishComponentArray);
      this.pushComponentsFromArray(FrozenYetiComponentArray);
      this.pushComponentsFromArray(RockSpikeProjectileComponentArray);
      this.pushComponentsFromArray(CookingComponentArray);
      this.pushComponentsFromArray(ThrowingProjectileComponentArray);
      this.pushComponentsFromArray(HutComponentArray);
      this.pushComponentsFromArray(SlimeSpitComponentArray);
      this.pushComponentsFromArray(DoorComponentArray);
      this.pushComponentsFromArray(GolemComponentArray);
      this.pushComponentsFromArray(IceSpikesComponentArray);
      this.pushComponentsFromArray(PebblumComponentArray);
      this.pushComponentsFromArray(PhysicsComponentArray);
      this.pushComponentsFromArray(BlueprintComponentArray);
      this.pushComponentsFromArray(TurretComponentArray);
      this.pushComponentsFromArray(AmmoBoxComponentArray);
      this.pushComponentsFromArray(ResearchBenchComponentArray);
      this.pushComponentsFromArray(SpikesComponentArray);

      // Push entities
      for (const entity of this.entityJoinBuffer) {
         // Only now add the entity to chunks, as if they are added when the entity is created then the entity will be
         // accessible but its components won't.
         entity.updateContainingChunks();

         updateEntityPathfindingNodeOccupance(entity);

         this.entities.push(entity);
         this.entityRecord[entity.id] = entity;

         // @Speed @Cleanup: Should be in its associated file!
         if (entity.type === IEntityType.researchBench) {
            const tribeComponent = TribeComponentArray.getComponent(entity.id);
            tribeComponent.tribe.addResearchBench(entity);
         }
      }

      this.entityJoinBuffer = new Array<Entity>();
   }

   public static isInBoard(position: Point): boolean {
      return position.x >= 0 && position.x <= SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - 1 && position.y >= 0 && position.y <= SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - 1;
   }

   public static distanceToClosestEntity(position: Point): number {
      let minDistance = 2000;

      const minChunkX = Math.max(Math.min(Math.floor((position.x - 2000) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((position.x + 2000) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((position.y - 2000) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((position.y + 2000) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);

      const checkedEntities = new Set<Entity>();
      
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.entities) {
               if (checkedEntities.has(entity)) continue;
               
               const distance = position.calculateDistanceBetween(entity.position);
               if (distance <= minDistance) {
                  minDistance = distance;
               }

               checkedEntities.add(entity);
            }
         }
      }

      return minDistance;
   }

   public static getEntitiesAtPosition(x: number, y: number): Set<Entity> {
      if (!this.positionIsInBoard(x, y)) {
         throw new Error("Position isn't in the board");
      }
      
      // @Speed: Garbage collection
      const testPosition = new Point(x, y);

      const chunkX = Math.floor(x / SettingsConst.CHUNK_UNITS);
      const chunkY = Math.floor(y / SettingsConst.CHUNK_UNITS);

      const entities = new Set<Entity>();
      
      const chunk = this.getChunk(chunkX, chunkY);
      for (const entity of chunk.entities) {
         for (const hitbox of entity.hitboxes) {
            if (this.hitboxIsInRange(testPosition, hitbox, 1)) {
               entities.add(entity);
               break;
            }
         }
      }

      return entities;
   }

   // @Cleanup: Move this into ai-shared
   public static hitboxIsInRange(testPosition: Point, hitbox: Hitbox, range: number): boolean {
      // @Speed: This check is slow
      if (hitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circlesDoIntersect(testPosition.x, testPosition.y, range, hitbox.object.position.x + hitbox.rotatedOffsetX, hitbox.object.position.y + hitbox.rotatedOffsetY, (hitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         // @Speed
         return circleAndRectangleDoIntersect(testPosition.x, testPosition.y, range, hitbox.object.position.x + hitbox.rotatedOffsetX, hitbox.object.position.y + hitbox.rotatedOffsetY, (hitbox as RectangularHitbox).width, (hitbox as RectangularHitbox).height, (hitbox as RectangularHitbox).rotation);
      }
   }

   public static tileIsInBoard(tileX: number, tileY: number): boolean {
      return tileX >= 0 && tileX < SettingsConst.BOARD_DIMENSIONS && tileY >= 0 && tileY < SettingsConst.BOARD_DIMENSIONS;
   }

   public static positionIsInBoard(x: number, y: number): boolean {
      return x >= 0 && x < SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE && y >= 0 && y < SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE;
   }

   public static getTileAtPosition(position: Point): Tile {
      const tileX = Math.floor(position.x / SettingsConst.TILE_SIZE);
      const tileY = Math.floor(position.y / SettingsConst.TILE_SIZE);
      return this.getTile(tileX, tileY);
   }

   public static getEntitiesInRange(position: Point, range: number): Array<Entity> {
      const minChunkX = Math.max(Math.min(Math.floor((position.x - range) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((position.x + range) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((position.y - range) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((position.y + range) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);

      const checkedEntities = new Set<Entity>();
      const entities = new Array<Entity>();
      
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.entities) {
               if (checkedEntities.has(entity)) continue;
               
               const distance = position.calculateDistanceBetween(entity.position);
               if (distance <= range) {
                  entities.push(entity);
               }

               checkedEntities.add(entity);
            }
         }
      }

      return entities;
   }
}

export default Board;

/** Returns false if any of the tiles in the raycast don't match the inputted tile types. */
export function tileRaytraceMatchesTileTypes(startX: number, startY: number, endX: number, endY: number, tileTypes: ReadonlyArray<TileTypeConst>): boolean {
   /*
   Kindly yoinked from https://playtechs.blogspot.com/2007/03/raytracing-on-grid.html
   */
   
   // Convert to tile coordinates
   const x0 = startX / SettingsConst.TILE_SIZE;
   const x1 = endX / SettingsConst.TILE_SIZE;
   const y0 = startY / SettingsConst.TILE_SIZE;
   const y1 = endY / SettingsConst.TILE_SIZE;
   
   const dx = Math.abs(x0 - x1);
   const dy = Math.abs(y0 - y1);

   // Starting tile coordinates
   let x = Math.floor(x0);
   let y = Math.floor(y0);

   const dt_dx = 1 / dx;
   const dt_dy = 1 / dy;

   let n = 1;
   let x_inc, y_inc;
   let t_next_vertical, t_next_horizontal;

   if (dx === 0) {
      x_inc = 0;
      t_next_horizontal = dt_dx; // Infinity
   } else if (x1 > x0) {
      x_inc = 1;
      n += Math.floor(x1) - x;
      t_next_horizontal = (Math.floor(x0) + 1 - x0) * dt_dx;
   } else {
      x_inc = -1;
      n += x - Math.floor(x1);
      t_next_horizontal = (x0 - Math.floor(x0)) * dt_dx;
   }

   if (dy === 0) {
      y_inc = 0;
      t_next_vertical = dt_dy; // Infinity
   } else if (y1 > y0) {
      y_inc = 1;
      n += Math.floor(y1) - y;
      t_next_vertical = (Math.floor(y0) + 1 - y0) * dt_dy;
   } else {
      y_inc = -1;
      n += y - Math.floor(y1);
      t_next_vertical = (y0 - Math.floor(y0)) * dt_dy;
   }

   for (; n > 0; n--) {
      const tile = Board.getTile(x, y);
      if (!tileTypes.includes(tile.type)) {
         return false;
      }

      if (t_next_vertical < t_next_horizontal) {
         y += y_inc;
         t_next_vertical += dt_dy;
      } else {
         x += x_inc;
         t_next_horizontal += dt_dx;
      }
   }

   return true;
}

// @Cleanup: Copy and paste
export function raytraceHasWallTile(startX: number, startY: number, endX: number, endY: number): boolean {
   /*
   Kindly yoinked from https://playtechs.blogspot.com/2007/03/raytracing-on-grid.html
   */
   
   // Convert to tile coordinates
   const x0 = startX / SettingsConst.TILE_SIZE;
   const x1 = endX / SettingsConst.TILE_SIZE;
   const y0 = startY / SettingsConst.TILE_SIZE;
   const y1 = endY / SettingsConst.TILE_SIZE;
   
   const dx = Math.abs(x0 - x1);
   const dy = Math.abs(y0 - y1);

   // Starting tile coordinates
   let x = Math.floor(x0);
   let y = Math.floor(y0);

   const dt_dx = 1 / dx;
   const dt_dy = 1 / dy;

   let n = 1;
   let x_inc, y_inc;
   let t_next_vertical, t_next_horizontal;

   if (dx === 0) {
      x_inc = 0;
      t_next_horizontal = dt_dx; // Infinity
   } else if (x1 > x0) {
      x_inc = 1;
      n += Math.floor(x1) - x;
      t_next_horizontal = (Math.floor(x0) + 1 - x0) * dt_dx;
   } else {
      x_inc = -1;
      n += x - Math.floor(x1);
      t_next_horizontal = (x0 - Math.floor(x0)) * dt_dx;
   }

   if (dy === 0) {
      y_inc = 0;
      t_next_vertical = dt_dy; // Infinity
   } else if (y1 > y0) {
      y_inc = 1;
      n += Math.floor(y1) - y;
      t_next_vertical = (Math.floor(y0) + 1 - y0) * dt_dy;
   } else {
      y_inc = -1;
      n += y - Math.floor(y1);
      t_next_vertical = (y0 - Math.floor(y0)) * dt_dy;
   }

   for (; n > 0; n--) {
      const tile = Board.getTile(x, y);
      if (tile.isWall) {
         return true;
      }

      if (t_next_vertical < t_next_horizontal) {
         y += y_inc;
         t_next_vertical += dt_dy;
      } else {
         x += x_inc;
         t_next_horizontal += dt_dx;
      }
   }

   return false;
}