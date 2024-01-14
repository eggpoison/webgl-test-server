import { Server, Socket } from "socket.io";
import { AttackPacket, GameDataPacket, PlayerDataPacket, Point, SETTINGS, randInt, InitialGameDataPacket, ServerTileData, GameDataSyncPacket, RespawnDataPacket, EntityData, EntityType, Mutable, VisibleChunkBounds, GameObjectDebugData, TribeData, RectangularHitboxData, CircularHitboxData, PlayerInventoryData, InventoryData, TribeMemberAction, ItemType, ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData, TileType, HitData, IEntityType, TribeType, FrozenYetiAttackType, SlimeOrbData, StatusEffectData, TechID, Item, TRIBE_INFO_RECORD, randItem, StructureShapeType, randFloat, SlimeSize, ItemData } from "webgl-test-shared";
import Board from "./Board";
import { registerCommand } from "./commands";
import { runSpawnAttempt, spawnInitialEntities } from "./entity-spawning";
import Tribe from "./Tribe";
import { runTribeSpawnAttempt } from "./tribe-spawning";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import CircularHitbox from "./hitboxes/CircularHitbox";
import OPTIONS from "./options";
import Entity, { ID_SENTINEL_VALUE } from "./Entity";
import { BerryBushComponentArray, BoulderComponentArray, CactusComponentArray, CookingEntityComponentArray, CowComponentArray, DoorComponentArray, FishComponentArray, FrozenYetiComponentArray, GolemComponentArray, HealthComponentArray, HutComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, PlayerComponentArray, RockSpikeProjectileComponentArray, SlimeComponentArray, SlimeSpitComponentArray, SnowballComponentArray, StatusEffectComponentArray, TombstoneComponentArray, TotemBannerComponentArray, TreeComponentArray, TribeComponentArray, TribeMemberComponentArray, YetiComponentArray, ZombieComponentArray } from "./components/ComponentArray";
import { getInventory, serialiseItem, serializeInventoryData } from "./components/InventoryComponent";
import { createPlayer, interactWithStructure, processItemPickupPacket, processItemReleasePacket, processItemUsePacket, processPlayerAttackPacket, processPlayerCraftingPacket, processTechUnlock, shapeStructure, startChargingBattleaxe, startChargingBow, startChargingSpear, startEating, throwItem } from "./entities/tribes/player";
import { COW_GRAZE_TIME_TICKS } from "./entities/mobs/cow";
import { getZombieSpawnProgress } from "./entities/tombstone";
import { NUM_STATUS_EFFECTS } from "./components/StatusEffectComponent";
import { getTilesOfBiome } from "./census";
import { SPIT_CHARGE_TIME_TICKS } from "./entities/mobs/slime";
import { getInventoryUseInfo } from "./components/InventoryUseComponent";
import { GOLEM_WAKE_TIME_TICKS, createGolem } from "./entities/mobs/golem";
import { createFrozenYeti } from "./entities/mobs/frozen-yeti";

/*

Reference for future self:
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > processed.txt

*/

const bundleRectangularHitboxData = (hitbox: RectangularHitbox): RectangularHitboxData => {
   return {
      mass: hitbox.mass,
      offsetX: hitbox.offset.x,
      offsetY: hitbox.offset.y,
      localID: hitbox.localID,
      width: hitbox.width,
      height: hitbox.height,
   };
}

const bundleCircularHitboxData = (hitbox: CircularHitbox): CircularHitboxData => {
   return {
      mass: hitbox.mass,
      offsetX: hitbox.offset.x,
      offsetY: hitbox.offset.y,
      localID: hitbox.localID,
      radius: hitbox.radius
   };
}

// @Incomplete
const getFoodEatingType = (tribeMember: Entity, activeItemData: ItemData | null): ItemType | -1 => {
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);
   const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

   if (activeItemData !== null && useInfo.currentAction === TribeMemberAction.eat) {
      return activeItemData.type;
   }
   return -1;
}

const getLastActionTicks = (tribeMember: Entity, inventoryName: string): number => {
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);
   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   switch (useInfo.currentAction) {
      case TribeMemberAction.chargeBow: {
         return useInfo.lastBowChargeTicks;
      }
      case TribeMemberAction.chargeSpear: {
         return useInfo.lastSpearChargeTicks;
      }
      case TribeMemberAction.chargeBattleaxe: {
         return useInfo.lastBattleaxeChargeTicks;
      }
      case TribeMemberAction.loadCrossbow: {
         return useInfo.lastCrossbowLoadTicks;
      }
      case TribeMemberAction.eat: {
         return useInfo.lastEatTicks;
      }
      case TribeMemberAction.none: {
         return useInfo.lastAttackTicks;
      }
      case TribeMemberAction.researching: {
         // @Incomplete
         return Board.ticks;
      }
   }
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

   // @Cleanup @Robustness: Somehow make this automatically require the correct type for each entity type
   // Extract each one of these to the appropriate entity file, and make it return that specific entity's client args
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
         const cactusComponent = CactusComponentArray.getComponent(entity);
         clientArgs = [cactusComponent.flowers, cactusComponent.limbs];
         break;
      }
      case IEntityType.campfire: {
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         const cookingEntityComponent = CookingEntityComponentArray.getComponent(entity);

         clientArgs = [
            serializeInventoryData(getInventory(inventoryComponent, "fuelInventory"), "fuelInventory"),
            serializeInventoryData(getInventory(inventoryComponent, "ingredientInventory"), "ingredientInventory"),
            serializeInventoryData(getInventory(inventoryComponent, "outputInventory"), "outputInventory"),
            cookingEntityComponent.currentRecipe !== null ? cookingEntityComponent.heatingTimer / cookingEntityComponent.currentRecipe.cookTime : -1,
            cookingEntityComponent.remainingHeatSeconds > 0
         ];
         break;
      }
      case IEntityType.cow: {
         const cowComponent = CowComponentArray.getComponent(entity);
         clientArgs = [cowComponent.species, cowComponent.grazeProgressTicks > 0 ? cowComponent.grazeProgressTicks / COW_GRAZE_TIME_TICKS : -1];
         break;
      }
      case IEntityType.fish: {
         const fishComponent = FishComponentArray.getComponent(entity);
         clientArgs = [fishComponent.colour];
         break;
      }
      case IEntityType.frozenYeti: {
         const frozenYetiComponent = FrozenYetiComponentArray.getComponent(entity);
         clientArgs = [
            frozenYetiComponent.attackType,
            frozenYetiComponent.attackStage,
            frozenYetiComponent.stageProgress,
            frozenYetiComponent.rockSpikeInfoArray.map(info => [info.positionX, info.positionY])
         ];
         break;
      }
      case IEntityType.furnace: {
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         const cookingEntityComponent = CookingEntityComponentArray.getComponent(entity);

         clientArgs = [
            serializeInventoryData(getInventory(inventoryComponent, "fuelInventory"), "fuelInventory"),
            serializeInventoryData(getInventory(inventoryComponent, "ingredientInventory"), "ingredientInventory"),
            serializeInventoryData(getInventory(inventoryComponent, "outputInventory"), "outputInventory"),
            cookingEntityComponent.currentRecipe !== null ? cookingEntityComponent.heatingTimer / cookingEntityComponent.currentRecipe.cookTime : -1,
            cookingEntityComponent.remainingHeatSeconds > 0
         ];
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
      // @Cleanup: Copy and paste between tribesman and player
      case IEntityType.player: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(entity);
         const tribeMemberComponent = TribeMemberComponentArray.getComponent(entity);

         const hotbarInventory = getInventory(inventoryComponent, "hotbar");

         const playerData = SERVER.getPlayerDataFromInstance(entity);
         if (playerData === null) {
            throw new Error("Can't find player data");
         }

         const hotbarUseInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

         let hotbarActiveItemData: ItemData | null = null;
         if (hotbarInventory.itemSlots.hasOwnProperty(hotbarUseInfo.selectedItemSlot)) {
            const item = hotbarInventory.itemSlots[hotbarUseInfo.selectedItemSlot];
            hotbarActiveItemData = serialiseItem(item);
         }

         let offhandActiveItemData: ItemData | null = null;
         let offhandAction = TribeMemberAction.none;
         let offhandLastActionTicks = 0;
         let offhandThrownBattleaxeItemID = -1;
         if (tribeComponent.tribeType === TribeType.barbarians) {
            const offhandInventory = getInventory(inventoryComponent, "offhand");
            const offhandUseInfo = getInventoryUseInfo(inventoryUseComponent, "offhand")
            
            if (offhandInventory.itemSlots.hasOwnProperty(1)) {
               const item = offhandInventory.itemSlots[1];
               offhandActiveItemData = serialiseItem(item);
            }

            offhandAction = offhandUseInfo.currentAction;
            offhandLastActionTicks = getLastActionTicks(entity, "offhand");
            offhandThrownBattleaxeItemID = offhandUseInfo.thrownBattleaxeItemID;
         }
         
         // @Incomplete
         clientArgs = [
            tribeComponent.tribe !== null ? tribeComponent.tribe.id : null,
            tribeComponent.tribeType,
            serializeInventoryData(getInventory(inventoryComponent, "armourSlot"), "armourSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpackSlot"), "backpackSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpack"), "backpack"),
            hotbarActiveItemData,
            hotbarUseInfo.currentAction,
            getFoodEatingType(entity, hotbarActiveItemData),
            getLastActionTicks(entity, "hotbar"),
            hotbarUseInfo.thrownBattleaxeItemID,
            offhandActiveItemData,
            offhandAction,
            getFoodEatingType(entity, offhandActiveItemData),
            offhandLastActionTicks,
            offhandThrownBattleaxeItemID,
            false,
            tribeMemberComponent.warPaintType,
            playerData.username
         ];
         break;
      }
      case IEntityType.tribeWorker: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(entity);
         const tribeMemberComponent = TribeMemberComponentArray.getComponent(entity);

         const hotbarInventory = getInventory(inventoryComponent, "hotbar");

         const hotbarUseInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

         let hotbarActiveItem: ItemData | null = null;
         if (hotbarInventory.itemSlots.hasOwnProperty(hotbarUseInfo.selectedItemSlot)) {
            const item = hotbarInventory.itemSlots[hotbarUseInfo.selectedItemSlot];
            hotbarActiveItem = serialiseItem(item);
         }

         let offhandActiveItem: ItemData | null = null;
         let offhandAction = TribeMemberAction.none;
         let offhandLastActionTicks = 0;
         let offhandThrownBattleaxeItemID = -1;
         if (tribeComponent.tribeType === TribeType.barbarians) {
            const offhandInventory = getInventory(inventoryComponent, "offhand");
            const offhandUseInfo = getInventoryUseInfo(inventoryUseComponent, "offhand")
            
            if (offhandInventory.itemSlots.hasOwnProperty(1)) {
               const item = offhandInventory.itemSlots[1];
               offhandActiveItem = serialiseItem(item);
            }

            offhandAction = offhandUseInfo.currentAction;
            offhandLastActionTicks = getLastActionTicks(entity, "offhand");
            offhandThrownBattleaxeItemID = offhandUseInfo.thrownBattleaxeItemID;
         }
         
         // @Incomplete
         clientArgs = [
            tribeComponent.tribe !== null ? tribeComponent.tribe.id : null,
            tribeComponent.tribeType,
            serializeInventoryData(getInventory(inventoryComponent, "armourSlot"), "armourSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpackSlot"), "backpackSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpack"), "backpack"),
            hotbarActiveItem,
            hotbarUseInfo.currentAction,
            getFoodEatingType(entity, hotbarActiveItem),
            getLastActionTicks(entity, "hotbar"),
            hotbarUseInfo.thrownBattleaxeItemID,
            offhandActiveItem,
            offhandAction,
            getFoodEatingType(entity, offhandActiveItem),
            offhandLastActionTicks,
            offhandThrownBattleaxeItemID,
            false,
            tribeMemberComponent.warPaintType,
            serializeInventoryData(hotbarInventory, "hotbar"),
            hotbarUseInfo.selectedItemSlot,
            0
         ];
         break;
      }
      case IEntityType.tribeWarrior: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(entity);
         const tribeMemberComponent = TribeMemberComponentArray.getComponent(entity);

         const hotbarInventory = getInventory(inventoryComponent, "hotbar");
         const hotbarUseInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

         let hotbarActiveItem: ItemData | null = null;
         if (hotbarInventory.itemSlots.hasOwnProperty(hotbarUseInfo.selectedItemSlot)) {
            const item = hotbarInventory.itemSlots[hotbarUseInfo.selectedItemSlot];
            hotbarActiveItem = serialiseItem(item);
         }

         let offhandActiveItem: ItemData | null = null;
         let offhandAction = TribeMemberAction.none;
         let offhandLastActionTicks = 0;
         let offhandThrownBattleaxeItemID = -1;
         if (tribeComponent.tribeType === TribeType.barbarians) {
            const offhandInventory = getInventory(inventoryComponent, "offhand");
            const offhandUseInfo = getInventoryUseInfo(inventoryUseComponent, "offhand")
            
            if (offhandInventory.itemSlots.hasOwnProperty(1)) {
               const item = offhandInventory.itemSlots[1];
               offhandActiveItem = serialiseItem(item);
            }

            offhandAction = offhandUseInfo.currentAction;
            offhandLastActionTicks = getLastActionTicks(entity, "offhand");
            offhandThrownBattleaxeItemID = offhandUseInfo.thrownBattleaxeItemID;
         }
         
         // @Incomplete
         clientArgs = [
            tribeComponent.tribe !== null ? tribeComponent.tribe.id : null,
            tribeComponent.tribeType,
            serializeInventoryData(getInventory(inventoryComponent, "armourSlot"), "armourSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpackSlot"), "backpackSlot"),
            serializeInventoryData(getInventory(inventoryComponent, "backpack"), "backpack"),
            hotbarActiveItem,
            hotbarUseInfo.currentAction,
            getFoodEatingType(entity, hotbarActiveItem),
            getLastActionTicks(entity, "hotbar"),
            hotbarUseInfo.thrownBattleaxeItemID,
            offhandActiveItem,
            offhandAction,
            getFoodEatingType(entity, offhandActiveItem),
            offhandLastActionTicks,
            offhandThrownBattleaxeItemID,
            false,
            tribeMemberComponent.warPaintType,
            serializeInventoryData(hotbarInventory, "hotbar"),
            hotbarUseInfo.selectedItemSlot,
            0
         ];
         break;
      }
      case IEntityType.slime: {
         const slimeComponent = SlimeComponentArray.getComponent(entity);

         // Convert from moving orbs to regular orbs
         const orbs = new Array<SlimeOrbData>();
         for (const orb of slimeComponent.orbs) {
            orbs.push({
               offset: orb.offset,
               rotation: orb.rotation,
               size: orb.size
            });
         }

         let anger = -1;
         if (slimeComponent.angeredEntities.length > 0) {
            // Find maximum anger
            for (const angerInfo of slimeComponent.angeredEntities) {
               if (angerInfo.angerAmount > anger) {
                  anger = angerInfo.angerAmount;
               }
            }
         }

         const spitChargeProgress = slimeComponent.spitChargeProgress > 0 ? slimeComponent.spitChargeProgress / SPIT_CHARGE_TIME_TICKS : -1;

         clientArgs = [
            slimeComponent.size,
            slimeComponent.eyeRotation,
            orbs,
            anger,
            spitChargeProgress
         ];
         break;
      }
      case IEntityType.slimewisp: {
         clientArgs = [];
         break;
      }
      case IEntityType.snowball: {
         const snowballComponent = SnowballComponentArray.getComponent(entity);
         clientArgs = [snowballComponent.size];
         break;
      }
      case IEntityType.tombstone: {
         const tombstoneComponent = TombstoneComponentArray.getComponent(entity);
         clientArgs = [
            tombstoneComponent.tombstoneType,
            getZombieSpawnProgress(tombstoneComponent),
            tombstoneComponent.zombieSpawnPositionX,
            tombstoneComponent.zombieSpawnPositionY,
            tombstoneComponent.deathInfo
         ];
         break;
      }
      case IEntityType.tree: {
         const treeComponent = TreeComponentArray.getComponent(entity);
         clientArgs = [treeComponent.treeSize];
         break;
      }
      case IEntityType.workerHut: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const hutComponent = HutComponentArray.getComponent(entity);

         clientArgs = [
            tribeComponent.tribe !== null ? tribeComponent.tribe.id : null,
            hutComponent.lastDoorSwingTicks
         ];
         break;
      }
      case IEntityType.warriorHut: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const hutComponent = HutComponentArray.getComponent(entity);

         clientArgs = [
            tribeComponent.tribe !== null ? tribeComponent.tribe.id : null,
            hutComponent.lastDoorSwingTicks
         ];
         break;
      }
      case IEntityType.tribeTotem: {
         const tribeComponent = TribeComponentArray.getComponent(entity);
         const totemBannerComponent = TotemBannerComponentArray.getComponent(entity);

         clientArgs = [
            tribeComponent.tribe!.id, // Totems always have a tribe
            tribeComponent.tribeType,
            // @Speed
            Object.values(totemBannerComponent.banners)
         ];
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
         const rockSpikeComponent = RockSpikeProjectileComponentArray.getComponent(entity);
         clientArgs = [rockSpikeComponent.size, rockSpikeComponent.lifetimeTicks / SETTINGS.TPS];
         break;
      }
      case IEntityType.workbench: {
         clientArgs = [];
         break;
      }
      case IEntityType.yeti: {
         const yetiComponent = YetiComponentArray.getComponent(entity);
         clientArgs = [yetiComponent.snowThrowAttackProgress];
         break;
      }
      case IEntityType.zombie: {
         const inventoryComponent = InventoryComponentArray.getComponent(entity);
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(entity);
         const zombieComponent = ZombieComponentArray.getComponent(entity);

         const inventory = getInventory(inventoryComponent, "handSlot");
         const useInfo = getInventoryUseInfo(inventoryUseComponent, "handSlot");
         
         let activeItem: ItemType | null = null;
         if (inventory.itemSlots.hasOwnProperty(useInfo.selectedItemSlot)) {
            const item = inventory.itemSlots[useInfo.selectedItemSlot];
            activeItem = item.type;
         }

         clientArgs = [
            zombieComponent.zombieType,
            activeItem,
            getLastActionTicks(entity, "handSlot"),
            useInfo.currentAction
         ];
         break;
      }
      case IEntityType.spearProjectile: {
         clientArgs = [];
         break;
      }
      case IEntityType.researchBench: {
         clientArgs = [];
         break;
      }
      case IEntityType.woodenWall: {
         clientArgs = [];
         break;
      }
      case IEntityType.slimeSpit: {
         const slimeSpitComponent = SlimeSpitComponentArray.getComponent(entity);
         clientArgs = [slimeSpitComponent.size];
         break;
      }
      case IEntityType.spitPoison: {
         clientArgs = [];
         break;
      }
      case IEntityType.woodenDoor: {
         const doorComponent = DoorComponentArray.getComponent(entity);
         clientArgs = [doorComponent.toggleType];
         break;
      }
      case IEntityType.battleaxeProjectile: {
         clientArgs = [];
         break;
      }
      case IEntityType.golem: {
         const golemComponent = GolemComponentArray.getComponent(entity);
         clientArgs = [golemComponent.wakeTimerTicks / GOLEM_WAKE_TIME_TICKS];
         break;
      }
      case IEntityType.planterBox: {
         clientArgs = [];
         break;
      }
      case IEntityType.iceArrow: {
         clientArgs = [];
         break;
      }
   }

   const statusEffectData = new Array<StatusEffectData>();
   if (StatusEffectComponentArray.hasComponent(entity)) {
      const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);
      for (let i = 0; i < NUM_STATUS_EFFECTS; i++) {
         if (statusEffectComponent.ticksRemaining[i] > 0) {
            statusEffectData.push({
               type: i,
               ticksElapsed: statusEffectComponent.ticksElapsed[i]
            });
         }
      }
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
      clientArgs: clientArgs,
      statusEffects: statusEffectData,
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
   hitsTaken: Array<HitData>;
   pickedUpItem: boolean;
}

const bundleTribeData = (playerData: PlayerData): TribeData => {
   return {
      id: playerData.tribe.id,
      tribeType: playerData.tribe.tribeType,
      hasTotem: playerData.tribe.totem !== null,
      numHuts: playerData.tribe.getNumHuts(),
      tribesmanCap: playerData.tribe.tribesmanCap,
      area: playerData.tribe.getArea().map(tile => [tile.x, tile.y]),
      selectedTechID: playerData.tribe.selectedTechID,
      unlockedTechs: playerData.tribe.unlockedTechs,
      techTreeUnlockProgress: playerData.tribe.techTreeUnlockProgress
   };
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
      // This is done before each tick to account for player packets causing entities to be removed between ticks.
      Board.removeFlaggedGameObjects();

      Board.updateTribes();

      Board.updateGameObjects();
      Board.resolveOtherCollisions();
      Board.resolveGameObjectCollisions();

      runSpawnAttempt();
      runTribeSpawnAttempt();
      
      Board.pushJoinBuffer();

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

         setTimeout(() => {
            createGolem(new Point(spawnPosition.x + 200, spawnPosition.y));
         }, 200);
         
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
               hitsTaken: [],
               pickedUpItem: false
            }
            playerData.instanceID = player.id;

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
                  },
                  offhand: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     inventoryName: "armourSlot"
                  },
                  gloveSlot: {
                     itemSlots: {},
                     width: 1,
                     height: 1,
                     inventoryName: "gloveSlot"
                  }
               },
               tileUpdates: [],
               serverTicks: Board.ticks,
               serverTime: Board.time,
               playerHealth: 20,
               tribeData: bundleTribeData(playerData),
               hasFrostShield: false,
               pickedUpItem: false
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

         socket.on("study_tech", (studyAmount: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            playerData.tribe.studyTech(studyAmount);
         });

         socket.on("shape_structure", (structureID: number, type: StructureShapeType): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               shapeStructure(player, structureID, type);
            };
         });

         socket.on("structure_interact", (structureID: number): void => {
            const playerData = SERVER.playerDataRecord[socket.id];
            const player = this.getPlayerInstance(playerData);
            if (player !== null) {
               interactWithStructure(player, structureID);
            };
         });
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
         
         const player = this.getPlayerInstance(playerData);

         const tileUpdates = Board.popTileUpdates();
         
         // @Speed @Memory
         const extendedVisibleChunkBounds: VisibleChunkBounds = [
            Math.max(playerData.visibleChunkBounds[0] - 1, 0),
            Math.min(playerData.visibleChunkBounds[1] + 1, SETTINGS.BOARD_SIZE - 1),
            Math.max(playerData.visibleChunkBounds[2] - 1, 0),
            Math.min(playerData.visibleChunkBounds[3] + 1, SETTINGS.BOARD_SIZE - 1)
         ];

         // @Incomplete
         // const playerArmour = player !== null ? getItem(InventoryComponentArray.getComponent(player), "armourSlot", 1) : null;

         // Initialise the game data packet
         const gameDataPacket: GameDataPacket = {
            entityDataArray: bundleEntityDataArray(extendedVisibleChunkBounds),
            inventory: this.bundlePlayerInventoryData(player),
            hitsTaken: playerData.hitsTaken,
            tileUpdates: tileUpdates,
            serverTicks: Board.ticks,
            serverTime: Board.time,
            playerHealth: player !== null ? HealthComponentArray.getComponent(player).health : 0,
            gameObjectDebugData: gameObjectDebugData,
            tribeData: bundleTribeData(playerData),
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
            },
            offhand: {
               itemSlots: {},
               width: 1,
               height: 1,
               inventoryName: "offhand"
            },
            gloveSlot: {
               itemSlots: {},
               width: 1,
               height: 1,
               inventoryName: "gloveSlot"
            }
         };
      } else {
         const tribeComponent = TribeComponentArray.getComponent(player);
         
         return {
            hotbar: SERVER.bundleInventory(player, "hotbar"),
            backpackInventory: SERVER.bundleInventory(player, "backpack"),
            backpackSlot: SERVER.bundleInventory(player, "backpackSlot"),
            heldItemSlot: SERVER.bundleInventory(player, "heldItemSlot"),
            craftingOutputItemSlot: SERVER.bundleInventory(player, "craftingOutputSlot"),
            armourSlot: SERVER.bundleInventory(player, "armourSlot"),
            offhand: tribeComponent.tribeType === TribeType.barbarians ? SERVER.bundleInventory(player, "offhand") : {
               itemSlots: {},
               width: 1,
               height: 1,
               inventoryName: "offhand"
            },
            gloveSlot: SERVER.bundleInventory(player, "gloveSlot")
         };
      }
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
            health: HealthComponentArray.getComponent(player).health,
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

      const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);
      const hotbarUseInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");

      player.position.x = playerDataPacket.position[0];
      player.position.y = playerDataPacket.position[1];
      player.velocity = Point.unpackage(playerDataPacket.velocity);
      player.acceleration = Point.unpackage(playerDataPacket.acceleration);
      player.rotation = playerDataPacket.rotation;
      player.hitboxesAreDirty = true;
      playerData.visibleChunkBounds = playerDataPacket.visibleChunkBounds;
      
      hotbarUseInfo.selectedItemSlot = playerDataPacket.selectedItemSlot;

      const playerComponent = PlayerComponentArray.getComponent(player);
      playerComponent.interactingEntityID = playerDataPacket.interactingEntityID !== null ? playerDataPacket.interactingEntityID : ID_SENTINEL_VALUE;

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

      const tribeComponent = TribeComponentArray.getComponent(player);
      if (tribeComponent.tribeType === TribeType.barbarians) {
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

         const x = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
         const y = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;

         if (x < GameServer.PLAYER_SPAWN_POSITION_PADDING || x >= SETTINGS.BOARD_UNITS - GameServer.PLAYER_SPAWN_POSITION_PADDING || y < GameServer.PLAYER_SPAWN_POSITION_PADDING || y >= SETTINGS.BOARD_UNITS - GameServer.PLAYER_SPAWN_POSITION_PADDING) {
            continue;
         }

         return new Point(x, y);
      }
      
      // If all else fails, just pick a random position
      const x = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
      const y = randInt(GameServer.PLAYER_SPAWN_POSITION_PADDING, SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - GameServer.PLAYER_SPAWN_POSITION_PADDING);
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
         spawnPosition = this.generatePlayerSpawnPosition(playerData.tribe.tribeType);
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