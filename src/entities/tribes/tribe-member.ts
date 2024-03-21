import { ArmourItemInfo, AxeItemInfo, BackpackItemInfo, BattleaxeItemInfo, BlueprintType, BowItemInfo, FoodItemInfo, GenericArrowType, HammerItemInfo, HitFlags, IEntityType, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, Item, ItemType, PlaceableItemType, PlayerCauseOfDeath, Point, SettingsConst, STRUCTURE_TYPES_CONST, StatusEffectConst, StructureTypeConst, SwordItemInfo, ToolItemInfo, TribeMemberAction, TribeType, distance, getItemStackSize, itemIsStackable, lerp, getSnapOffsetWidth, getSnapOffsetHeight, HitboxCollisionTypeConst } from "webgl-test-shared";
import Entity from "../../Entity";
import Board from "../../Board";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, TribeComponentArray, TribeMemberComponentArray } from "../../components/ComponentArray";
import { addItemToSlot, consumeItemFromSlot, getInventory, getItem, getItemFromInventory, inventoryHasItemInSlot, removeItemFromInventory, resizeInventory } from "../../components/InventoryComponent";
import { getEntitiesInVisionRange } from "../../ai-shared";
import { addDefence, damageEntity, healEntity, removeDefence } from "../../components/HealthComponent";
import { WORKBENCH_SIZE, createWorkbench } from "../workbench";
import { TRIBE_TOTEM_SIZE, createTribeTotem } from "./tribe-totem";
import { WORKER_HUT_SIZE, createWorkerHut } from "./worker-hut";
import { applyStatusEffect } from "../../components/StatusEffectComponent";
import { BARREL_SIZE, createBarrel } from "./barrel";
import { CAMPFIRE_SIZE, createCampfire } from "../cooking-entities/campfire";
import { FURNACE_SIZE, createFurnace } from "../cooking-entities/furnace";
import { GenericArrowInfo, createWoodenArrow } from "../projectiles/wooden-arrow";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { onFishLeaderHurt } from "../mobs/fish";
import { createSpearProjectile } from "../projectiles/spear-projectile";
import { createResearchBench } from "../research-bench";
import { WARRIOR_HUT_SIZE, createWarriorHut } from "./warrior-hut";
import { createWall } from "../structures/wall";
import { InventoryUseInfo, getInventoryUseInfo } from "../../components/InventoryUseComponent";
import { createBattleaxeProjectile } from "../projectiles/battleaxe-projectile";
import { SERVER } from "../../server";
import { createPlanterBox } from "../structures/planter-box";
import { createIceArrow } from "../projectiles/ice-arrow";
import { createSpikes, spikesAreAttachedToWall } from "../structures/spikes";
import { createPunjiSticks, punjiSticksAreAttachedToWall } from "../structures/punji-sticks";
import { doBlueprintWork } from "../../components/BlueprintComponent";
import { EntityRelationship, getTribeMemberRelationship } from "../../components/TribeComponent";
import { createBlueprintEntity } from "../blueprint-entity";
import { getItemAttackCooldown } from "../../items";
import { applyKnockback } from "../../components/PhysicsComponent";
import Hitbox from "../../hitboxes/Hitbox";

const DEFAULT_ATTACK_KNOCKBACK = 125;

const SWORD_DAMAGEABLE_ENTITIES: ReadonlyArray<IEntityType> = [IEntityType.zombie, IEntityType.krumblid, IEntityType.cactus, IEntityType.tribeWorker, IEntityType.tribeWarrior, IEntityType.player, IEntityType.yeti, IEntityType.frozenYeti, IEntityType.berryBush, IEntityType.fish, IEntityType.tribeTotem, IEntityType.workerHut, IEntityType.warriorHut, IEntityType.cow, IEntityType.golem, IEntityType.slime, IEntityType.slimewisp];
const PICKAXE_DAMAGEABLE_ENTITIES: ReadonlyArray<IEntityType> = [IEntityType.boulder, IEntityType.tombstone, IEntityType.iceSpikes, IEntityType.furnace, IEntityType.golem];
const AXE_DAMAGEABLE_ENTITIES: ReadonlyArray<IEntityType> = [IEntityType.tree, IEntityType.wall, IEntityType.door, IEntityType.embrasure, IEntityType.researchBench, IEntityType.workbench, IEntityType.spikes, IEntityType.punjiSticks, IEntityType.tribeTotem, IEntityType.workerHut, IEntityType.warriorHut, IEntityType.barrel];

const testRectangularHitbox = new RectangularHitbox({position: new Point(0, 0), rotation: 0}, 1, 0, 0, HitboxCollisionTypeConst.soft, 0.1, 0.1);
const testCircularHitbox = new CircularHitbox({position: new Point(0, 0), rotation: 0}, 1, 0, 0, HitboxCollisionTypeConst.soft, 0.1);

// @Cleanup: Copy and paste. This placeable entity stuff is shared between server and client

enum PlaceableItemHitboxType {
   circular = 0,
   rectangular = 1
}

interface PlaceableItemHitboxInfo {
   readonly entityType: IEntityType;
   readonly type: PlaceableItemHitboxType;
   readonly placeOffset: number;
}

interface PlaceableItemCircularHitboxInfo extends PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType.circular;
   readonly radius: number;
}

interface PlaceableItemRectangularHitboxInfo extends PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType.rectangular;
   readonly width: number;
   readonly height: number;
}

// @Cleanup: Shared between both client and server
const PLACEABLE_ITEM_HITBOX_INFO: Record<PlaceableItemType, PlaceableItemCircularHitboxInfo | PlaceableItemRectangularHitboxInfo> = {
   [ItemType.workbench]: {
      entityType: IEntityType.workbench,
      type: PlaceableItemHitboxType.rectangular,
      width: WORKBENCH_SIZE,
      height: WORKBENCH_SIZE,
      placeOffset: WORKBENCH_SIZE / 2
   },
   [ItemType.tribe_totem]: {
      entityType: IEntityType.tribeTotem,
      type: PlaceableItemHitboxType.circular,
      radius: TRIBE_TOTEM_SIZE / 2,
      placeOffset: TRIBE_TOTEM_SIZE / 2
   },
   [ItemType.worker_hut]: {
      entityType: IEntityType.workerHut,
      type: PlaceableItemHitboxType.rectangular,
      width: WORKER_HUT_SIZE,
      height: WORKER_HUT_SIZE,
      placeOffset: WORKER_HUT_SIZE / 2
   },
   [ItemType.warrior_hut]: {
      entityType: IEntityType.warriorHut,
      type: PlaceableItemHitboxType.rectangular,
      width: WARRIOR_HUT_SIZE,
      height: WARRIOR_HUT_SIZE,
      placeOffset: WARRIOR_HUT_SIZE / 2
   },
   [ItemType.barrel]: {
      entityType: IEntityType.barrel,
      type: PlaceableItemHitboxType.circular,
      radius: BARREL_SIZE / 2,
      placeOffset: BARREL_SIZE / 2
   },
   [ItemType.campfire]: {
      entityType: IEntityType.campfire,
      type: PlaceableItemHitboxType.rectangular,
      width: CAMPFIRE_SIZE,
      height: CAMPFIRE_SIZE,
      placeOffset: CAMPFIRE_SIZE / 2
   },
   [ItemType.furnace]: {
      entityType: IEntityType.furnace,
      type: PlaceableItemHitboxType.rectangular,
      width: FURNACE_SIZE,
      height: FURNACE_SIZE,
      placeOffset: FURNACE_SIZE / 2
   },
   [ItemType.research_bench]: {
      entityType: IEntityType.researchBench,
      type: PlaceableItemHitboxType.rectangular,
      width: 32 * 4,
      height: 20 * 4,
      placeOffset: 50
   },
   [ItemType.wooden_wall]: {
      entityType: IEntityType.wall,
      type: PlaceableItemHitboxType.rectangular,
      width: 64,
      height: 64,
      placeOffset: 32
   },
   [ItemType.planter_box]: {
      entityType: IEntityType.planterBox,
      type: PlaceableItemHitboxType.rectangular,
      width: 80,
      height: 80,
      placeOffset: 40
   },
   [ItemType.wooden_spikes]: {
      entityType: IEntityType.spikes,
      type: PlaceableItemHitboxType.rectangular,
      width: 48,
      height: 48,
      placeOffset: 20
   },
   [ItemType.punji_sticks]: {
      entityType: IEntityType.punjiSticks,
      type: PlaceableItemHitboxType.rectangular,
      width: 48,
      height: 48,
      placeOffset: 20
   },
   [ItemType.ballista]: {
      entityType: IEntityType.ballista,
      type: PlaceableItemHitboxType.rectangular,
      width: 100,
      height: 100,
      placeOffset: 50
   },
   [ItemType.sling_turret]: {
      entityType: IEntityType.slingTurret,
      type: PlaceableItemHitboxType.circular,
      radius: 36,
      placeOffset: 36
   },
};

const getPlaceableEntityWidth = (itemType: PlaceableItemType, isPlacedOnWall: boolean): number | null => {
   if (itemType === ItemType.wooden_spikes) {
      return isPlacedOnWall ? 56 : 48;
   } else if (itemType === ItemType.punji_sticks) {
      return isPlacedOnWall ? 56 : 48;
   }
   return null;
}

const getPlaceableEntityHeight = (itemType: PlaceableItemType, isPlacedOnWall: boolean): number | null => {
   if (itemType === ItemType.wooden_spikes) {
      return isPlacedOnWall ? 28 : 48;
   } else if (itemType === ItemType.punji_sticks) {
      return isPlacedOnWall ? 32 : 48;
   }
   return null;
}

function assertItemTypeIsPlaceable(itemType: ItemType): asserts itemType is PlaceableItemType {
   if (!PLACEABLE_ITEM_HITBOX_INFO.hasOwnProperty(itemType)) {
      throw new Error(`Entity type '${itemType}' is not placeable.`);
   }
}

export function calculateItemDamage(item: Item | null, entityToAttack: Entity): number {
   if (item === null) {
      return 1;
   }

   const itemCategory = ITEM_TYPE_RECORD[item.type];
   switch (itemCategory) {
      case "battleaxe": {
         const itemInfo = ITEM_INFO_RECORD[item.type] as BattleaxeItemInfo;
         if (SWORD_DAMAGEABLE_ENTITIES.includes(entityToAttack.type) || AXE_DAMAGEABLE_ENTITIES.includes(entityToAttack.type)) {
            return itemInfo.damage;
         }
         return Math.floor(itemInfo.damage / 2);
      }
      case "spear":
      case "sword": {
         const itemInfo = ITEM_INFO_RECORD[item.type] as SwordItemInfo;
         if (SWORD_DAMAGEABLE_ENTITIES.includes(entityToAttack.type)) {
            return itemInfo.damage;
         }
         return Math.floor(itemInfo.damage / 2);
      }
      case "axe": {
         const itemInfo = ITEM_INFO_RECORD[item.type] as AxeItemInfo;
         if (AXE_DAMAGEABLE_ENTITIES.includes(entityToAttack.type)) {
            return itemInfo.damage;
         }
         return Math.ceil(itemInfo.damage / 3);
      }
      case "pickaxe": {
         const itemInfo = ITEM_INFO_RECORD[item.type] as AxeItemInfo;
         if (PICKAXE_DAMAGEABLE_ENTITIES.includes(entityToAttack.type)) {
            return itemInfo.damage;
         } else {
            return Math.floor(itemInfo.damage / 4);
         }
      }
      default: {
         return 1;
      }
   }
}

const calculateItemKnockback = (item: Item | null): number => {
   if (item === null) {
      return DEFAULT_ATTACK_KNOCKBACK;
   }

   const itemInfo = ITEM_INFO_RECORD[item.type];
   if (itemInfo.hasOwnProperty("toolType")) {
      return (itemInfo as ToolItemInfo).knockback;
   }

   return DEFAULT_ATTACK_KNOCKBACK;
}

// @Cleanup: Maybe split this up into repair and work functions
export function repairBuilding(tribeMember: Entity, targetEntity: Entity, itemSlot: number, inventoryName: string): boolean {
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember.id);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   // Don't attack if on cooldown or not doing another action
   if (useInfo.itemAttackCooldowns.hasOwnProperty(itemSlot) || useInfo.currentAction !== TribeMemberAction.none) {
      return false;
   }
   
   // Find the selected item
   const item = getItem(inventoryComponent, inventoryName, itemSlot);
   if (item === null) {
      console.warn("Tried to repair a building without a hammer!");
      return false;
   }

   // Reset attack cooldown
   if (item !== null) {
      useInfo.itemAttackCooldowns[itemSlot] = getItemAttackCooldown(item);
   } else {
      useInfo.itemAttackCooldowns[itemSlot] = SettingsConst.DEFAULT_ATTACK_COOLDOWN;
   }

   // @Incomplete: Should this instead be its own lastConstructTicks?
   useInfo.lastAttackTicks = Board.ticks;

   if (targetEntity.type === IEntityType.blueprintEntity) {
      // If holding a hammer and attacking a friendly blueprint, work on the blueprint instead of damaging it
      const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
      const blueprintTribeComponent = TribeComponentArray.getComponent(targetEntity.id);
      if (blueprintTribeComponent.tribe === tribeComponent.tribe) {
         doBlueprintWork(targetEntity, item);
         return true;
      }
   } else if (STRUCTURE_TYPES_CONST.includes(targetEntity.type as StructureTypeConst)) {
      // Heal friendly structures
      const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
      const buildingTribeComponent = TribeComponentArray.getComponent(targetEntity.id);
      if (buildingTribeComponent.tribe === tribeComponent.tribe) {
         const itemInfo = ITEM_INFO_RECORD[item.type] as HammerItemInfo;
         healEntity(targetEntity, itemInfo.repairAmount, tribeMember.id);
         return true;
      }
   }

   console.warn("Couldn't repair/build the entity: not a blueprint or in STRUCTURE_TYPES_CONST.")
   return false;
}

/**
 * @param targetEntity The entity to attack
 * @param itemSlot The item slot being used to attack the entity
 */
// @Cleanup: (?) Pass in the item to use directly instead of passing in the item slot and inventory name
// @Cleanup: Not just for tribe members, move to different file
export function attackEntity(tribeMember: Entity, targetEntity: Entity, itemSlot: number, inventoryName: string): boolean {
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember.id);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   // Don't attack if on cooldown or not doing another action
   if (useInfo.itemAttackCooldowns.hasOwnProperty(itemSlot) || useInfo.currentAction !== TribeMemberAction.none) {
      return false;
   }
   
   // Find the selected item
   const item = getItem(inventoryComponent, inventoryName, itemSlot);

   // Reset attack cooldown
   if (item !== null) {
      useInfo.itemAttackCooldowns[itemSlot] = getItemAttackCooldown(item);
   } else {
      useInfo.itemAttackCooldowns[itemSlot] = SettingsConst.DEFAULT_ATTACK_COOLDOWN;
   }

   const attackDamage = calculateItemDamage(item, targetEntity);
   const attackKnockback = calculateItemKnockback(item);

   const hitDirection = tribeMember.position.calculateAngleBetween(targetEntity.position);

   // Register the hit
   damageEntity(targetEntity, attackDamage, tribeMember, PlayerCauseOfDeath.tribe_member);
   applyKnockback(targetEntity, attackKnockback, hitDirection);
   SERVER.registerEntityHit({
      entityPositionX: targetEntity.position.x,
      entityPositionY: targetEntity.position.y,
      hitEntityID: targetEntity.id,
      damage: attackDamage,
      knockback: attackKnockback,
      angleFromAttacker: hitDirection,
      attackerID: tribeMember.id,
      flags: item !== null && item.type === ItemType.flesh_sword ? HitFlags.HIT_BY_FLESH_SWORD : 0
   });

   if (item !== null && item.type === ItemType.flesh_sword) {
      applyStatusEffect(targetEntity, StatusEffectConst.poisoned, 3 * SettingsConst.TPS);
   }

   useInfo.lastAttackTicks = Board.ticks;

   return true;
}

// @Cleanup: Not just for tribe members, move to different file
export function calculateAttackTarget(tribeMember: Entity, targetEntities: ReadonlyArray<Entity>, attackableEntityRelationshipMask: number): Entity | null {
   const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
   
   let closestEntity: Entity | null = null;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const targetEntity of targetEntities) {
      // Don't attack entities without health components
      if (!HealthComponentArray.hasComponent(targetEntity)) {
         continue;
      }

      const relationship = getTribeMemberRelationship(tribeComponent, targetEntity);
      if ((relationship & attackableEntityRelationshipMask) === 0) {
         continue;
      }

      const dist = tribeMember.position.calculateDistanceBetween(targetEntity.position);
      if (dist < minDistance) {
         closestEntity = targetEntity;
         minDistance = dist;
      }
   }
   
   if (closestEntity === null) return null;

   return closestEntity;
}


export function calculateRepairTarget(tribeMember: Entity, targetEntities: ReadonlyArray<Entity>): Entity | null {
   const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
   
   let closestEntity: Entity | null = null;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const targetEntity of targetEntities) {
      // Don't attack entities without health components
      if (!HealthComponentArray.hasComponent(targetEntity)) {
         continue;
      }

      // Only repair damaged buildings
      const healthComponent = HealthComponentArray.getComponent(targetEntity.id);
      if (healthComponent.health === healthComponent.maxHealth) {
         continue;
      }

      const relationship = getTribeMemberRelationship(tribeComponent, targetEntity);
      if (relationship !== EntityRelationship.friendlyBuilding) {
         continue;
      }

      const dist = tribeMember.position.calculateDistanceBetween(targetEntity.position);
      if (dist < minDistance) {
         closestEntity = targetEntity;
         minDistance = dist;
      }
   }
   
   if (closestEntity === null) return null;

   return closestEntity;
}


export function calculateBlueprintWorkTarget(tribeMember: Entity, targetEntities: ReadonlyArray<Entity>): Entity | null {
   let closestEntity: Entity | null = null;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const targetEntity of targetEntities) {
      // Don't attack entities without health components
      if (targetEntity.type !== IEntityType.blueprintEntity) {
         continue;
      }

      const dist = tribeMember.position.calculateDistanceBetween(targetEntity.position);
      if (dist < minDistance) {
         closestEntity = targetEntity;
         minDistance = dist;
      }
   }
   
   if (closestEntity === null) return null;

   return closestEntity;
}

// @Cleanup: Rename function. shouldn't be 'attack'
// @Cleanup: Not just for tribe members, move to different file
export function calculateRadialAttackTargets(entity: Entity, attackOffset: number, attackRadius: number): ReadonlyArray<Entity> {
   const attackPositionX = entity.position.x + attackOffset * Math.sin(entity.rotation);
   const attackPositionY = entity.position.y + attackOffset * Math.cos(entity.rotation);
   const attackedEntities = getEntitiesInVisionRange(attackPositionX, attackPositionY, attackRadius);
   
   // Don't attack yourself
   while (true) {
      const idx = attackedEntities.indexOf(entity);
      if (idx !== -1) {
         attackedEntities.splice(idx, 1);
      } else {
         break;
      }
   }

   return attackedEntities;
}

const calculateRegularPlacePosition = (entity: Entity, placeInfo: PlaceableItemHitboxInfo): Point => {
   const placePositionX = entity.position.x + (SettingsConst.ITEM_PLACE_DISTANCE + placeInfo.placeOffset) * Math.sin(entity.rotation);
   const placePositionY = entity.position.y + (SettingsConst.ITEM_PLACE_DISTANCE + placeInfo.placeOffset) * Math.cos(entity.rotation);
   return new Point(placePositionX, placePositionY);
}

const entityIsPlacedOnWall = (entity: Entity): boolean => {
   if (entity.type === IEntityType.spikes) {
      return spikesAreAttachedToWall(entity);
   } else if (entity.type === IEntityType.punjiSticks) {
      return punjiSticksAreAttachedToWall(entity);
   }
   return false;
}

const calculateStructureSnapPositions = (snapOrigin: Point, snapEntity: Entity, placeRotation: number, isPlacedOnWall: boolean, placeInfo: PlaceableItemHitboxInfo): ReadonlyArray<Point> => {
   const snapPositions = new Array<Point>();
   for (let i = 0; i < 4; i++) {
      const direction = i * Math.PI / 2 + snapEntity.rotation;
      let snapEntityOffset: number;
      if (i % 2 === 0) {
         // Top and bottom snap positions
         snapEntityOffset = getSnapOffsetHeight(snapEntity.type as unknown as StructureTypeConst, entityIsPlacedOnWall(snapEntity)) * 0.5;
      } else {
         // Left and right snap positions
         snapEntityOffset = getSnapOffsetWidth(snapEntity.type as unknown as StructureTypeConst, entityIsPlacedOnWall(snapEntity)) * 0.5;
      }

      const epsilon = 0.01; // @Speed: const enum?
      let structureOffsetI = i;
      // If placing on the left or right side of the snap entity, use the width offset
      if (!(Math.abs(direction - placeRotation) < epsilon || Math.abs(direction - (placeRotation + Math.PI)) < epsilon)) {
         structureOffsetI++;
      }

      let structureOffset: number;
      if (structureOffsetI % 2 === 0 || (isPlacedOnWall && (placeInfo.entityType === IEntityType.spikes || placeInfo.entityType === IEntityType.punjiSticks))) {
         // Top and bottom
         structureOffset = getSnapOffsetHeight(placeInfo.entityType as StructureTypeConst, isPlacedOnWall) * 0.5;
      } else {
         // Left and right
         structureOffset = getSnapOffsetWidth(placeInfo.entityType as StructureTypeConst, isPlacedOnWall) * 0.5;
      }

      const offset = snapEntityOffset + structureOffset;
      const positionX = snapOrigin.x + offset * Math.sin(direction);
      const positionY = snapOrigin.y + offset * Math.cos(direction);
      snapPositions.push(new Point(positionX, positionY));
   }

   return snapPositions;
}

const calculateStructureSnapPosition = (snapPositions: ReadonlyArray<Point>, regularPlacePosition: Point): Point | null => {
   let minDist = Number.MAX_SAFE_INTEGER;
   let closestPosition: Point | null = null;
   for (let i = 0; i < 4; i++) {
      const position = snapPositions[i];

      const dist = position.calculateDistanceBetween(regularPlacePosition);
      if (dist < minDist) {
         minDist = dist;
         closestPosition = position;
      }
   }

   return closestPosition;
}

interface BuildingSnapInfo {
   /** -1 if no snap was found */
   readonly x: number;
   readonly y: number;
   readonly rotation: number;
   readonly entityType: IEntityType;
   readonly snappedEntityID: number;
}
export function calculateSnapInfo(entity: Entity, placeInfo: PlaceableItemHitboxInfo): BuildingSnapInfo | null {
   const regularPlacePosition = calculateRegularPlacePosition(entity, placeInfo);

   const minChunkX = Math.max(Math.floor((regularPlacePosition.x - SettingsConst.STRUCTURE_SNAP_RANGE) / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor((regularPlacePosition.x + SettingsConst.STRUCTURE_SNAP_RANGE) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor((regularPlacePosition.y - SettingsConst.STRUCTURE_SNAP_RANGE) / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor((regularPlacePosition.y + SettingsConst.STRUCTURE_SNAP_RANGE) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   
   const snappableEntities = new Array<Entity>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const currentEntity of chunk.entities) {
            const distance = regularPlacePosition.calculateDistanceBetween(currentEntity.position);
            if (distance > SettingsConst.STRUCTURE_SNAP_RANGE) {
               continue;
            }
            
            if (STRUCTURE_TYPES_CONST.includes(currentEntity.type as StructureTypeConst)) {
               snappableEntities.push(currentEntity);
            }
         }
      }
   }

   for (const snapEntity of snappableEntities) {
      const snapOrigin = snapEntity.position.copy();
      if (snapEntity.type === IEntityType.embrasure) {
         snapOrigin.x -= 22 * Math.sin(snapEntity.rotation);
         snapOrigin.y -= 22 * Math.cos(snapEntity.rotation);
      }

      const isPlacedOnWall = snapEntity.type === IEntityType.wall;

      // @Cleanup
      let clampedSnapRotation = snapEntity.rotation;
      while (clampedSnapRotation >= Math.PI * 0.25) {
         clampedSnapRotation -= Math.PI * 0.5;
      }
      while (clampedSnapRotation < Math.PI * 0.25) {
         clampedSnapRotation += Math.PI * 0.5;
      }
      const placeRotation = Math.round(entity.rotation / (Math.PI * 0.5)) * Math.PI * 0.5 + clampedSnapRotation;

      const snapPositions = calculateStructureSnapPositions(snapOrigin, snapEntity, placeRotation, isPlacedOnWall, placeInfo);
      const snapPosition = calculateStructureSnapPosition(snapPositions, regularPlacePosition);
      if (snapPosition !== null) {
         let finalPlaceRotation = placeRotation;
         if (isPlacedOnWall && (placeInfo.entityType === IEntityType.spikes || placeInfo.entityType === IEntityType.punjiSticks)) {
            finalPlaceRotation = snapEntity.position.calculateAngleBetween(snapPosition);
         }
         return {
            x: snapPosition.x,
            y: snapPosition.y,
            rotation: finalPlaceRotation,
            entityType: placeInfo.entityType,
            snappedEntityID: snapEntity.id
         };
      }
   }
   
   return null;
}

const calculatePlacePosition = (entity: Entity, placeInfo: PlaceableItemHitboxInfo, snapInfo: BuildingSnapInfo | null): Point => {
   if (snapInfo === null) {
      return calculateRegularPlacePosition(entity, placeInfo);
   }

   return new Point(snapInfo.x, snapInfo.y);
}

const calculatePlaceRotation = (entity: Entity, snapInfo: BuildingSnapInfo | null): number => {
   if (snapInfo === null) {
      return entity.rotation;
   }

   return snapInfo.rotation;
}

const buildingCanBePlaced = (spawnPositionX: number, spawnPositionY: number, placeRotation: number, itemType: PlaceableItemType, isPlacedOnWall: boolean): boolean => {
   // Update the place test hitbox to match the placeable item's info
   const testHitboxInfo = PLACEABLE_ITEM_HITBOX_INFO[itemType]!

   let placeTestHitbox: Hitbox;
   if (testHitboxInfo.type === PlaceableItemHitboxType.circular) {
      // Circular
      testCircularHitbox.radius = testHitboxInfo.radius;
      placeTestHitbox = testCircularHitbox;
   } else {
      const width = getPlaceableEntityWidth(itemType, isPlacedOnWall);
      const height = getPlaceableEntityHeight(itemType, isPlacedOnWall);
      
      // Rectangular
      testRectangularHitbox.width = width !== null ? width : testHitboxInfo.width;
      testRectangularHitbox.height = height !== null ? height : testHitboxInfo.height;
      // @Incomplete(?): Do we need to update vertices and axes?
      placeTestHitbox = testRectangularHitbox;
   }

   placeTestHitbox.object.position.x = spawnPositionX;
   placeTestHitbox.object.position.y = spawnPositionY;
   placeTestHitbox.object.rotation = placeRotation;

   const hitboxBoundsMinX = placeTestHitbox.calculateHitboxBoundsMinX();
   const hitboxBoundsMaxX = placeTestHitbox.calculateHitboxBoundsMaxX();
   const hitboxBoundsMinY = placeTestHitbox.calculateHitboxBoundsMinY();
   const hitboxBoundsMaxY = placeTestHitbox.calculateHitboxBoundsMaxY();

   const minChunkX = Math.max(Math.min(Math.floor(hitboxBoundsMinX / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor(hitboxBoundsMaxX / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor(hitboxBoundsMinY / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor(hitboxBoundsMaxY / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   
   const previouslyCheckedEntityIDs = new Set<number>();

   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.entities) {
            if (!previouslyCheckedEntityIDs.has(entity.id)) {
               for (const hitbox of entity.hitboxes) {   
                  if (placeTestHitbox.isColliding(hitbox, entity.rotation)) {
                     return false;
                  }
               }
               
               previouslyCheckedEntityIDs.add(entity.id);
            }
         }
      }
   }

   return true;
}

export function useItem(tribeMember: Entity, item: Item, inventoryName: string, itemSlot: number): void {
   const itemCategory = ITEM_TYPE_RECORD[item.type];

   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember.id);

   // @Cleanup: Extract each one of these cases into their own function

   switch (itemCategory) {
      case "armour": {
         // 
         // Equip the armour
         // 
         
         const targetItem = getItem(inventoryComponent, "armourSlot", 1);
         // If the target item slot has a different item type, don't attempt to transfer
         if (targetItem !== null && targetItem.type !== item.type) {
            return;
         }

         // Move from hotbar to armour slot
         removeItemFromInventory(inventoryComponent, inventoryName, itemSlot);
         addItemToSlot(inventoryComponent, "armourSlot", 1, item.type, 1);
         break;
      }
      case "glove": {
         // 
         // Equip the glove
         // 
         
         const targetItem = getItem(inventoryComponent, "gloveSlot", 1);
         // If the target item slot has a different item type, don't attempt to transfer
         if (targetItem !== null && targetItem.type !== item.type) {
            return;
         }

         // Move from hotbar to glove slot
         removeItemFromInventory(inventoryComponent, inventoryName, itemSlot);
         addItemToSlot(inventoryComponent, "gloveSlot", 1, item.type, 1);
         break;
      }
      case "food": {
         const healthComponent = HealthComponentArray.getComponent(tribeMember.id);

         // Don't use food if already at maximum health
         if (healthComponent.health >= healthComponent.maxHealth) return;

         const itemInfo = ITEM_INFO_RECORD[item.type] as FoodItemInfo;

         healEntity(tribeMember, itemInfo.healAmount, tribeMember.id);
         consumeItemFromSlot(inventoryComponent, inventoryName, itemSlot, 1);

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName)
         useInfo.lastEatTicks = Board.ticks;
         break;
      }
      case "placeable": {
         assertItemTypeIsPlaceable(item.type);

         const placeInfo = PLACEABLE_ITEM_HITBOX_INFO[item.type];

         const snapInfo = calculateSnapInfo(tribeMember, placeInfo);
         const placePosition = calculatePlacePosition(tribeMember, placeInfo, snapInfo);
         const placeRotation = calculatePlaceRotation(tribeMember, snapInfo);

         // Make sure the placeable item can be placed
         if (!buildingCanBePlaced(placePosition.x, placePosition.y, placeRotation, item.type, snapInfo !== null && Board.entityRecord[snapInfo.snappedEntityID].type === IEntityType.wall)) return;
         
         // Spawn the placeable entity
         let placedEntity: Entity;
         const placedEntityType = snapInfo !== null ? snapInfo.entityType : placeInfo.entityType;
         switch (placedEntityType) {
            case IEntityType.workbench: {
               placedEntity = createWorkbench(placePosition);
               break;
            }
            case IEntityType.tribeTotem: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createTribeTotem(placePosition, tribeComponent.tribe);
               break;
            }
            case IEntityType.workerHut: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               
               placedEntity = createWorkerHut(placePosition, tribeComponent.tribe);
               // @Incomplete @Bug
               placedEntity.rotation = placeRotation; // This has to be done before the hut is registered in its tribe
               // @Cleanup: Move to create function
               tribeComponent.tribe.registerNewWorkerHut(placedEntity);
               break;
            }
            case IEntityType.warriorHut: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               
               placedEntity = createWarriorHut(placePosition, tribeComponent.tribe);
               // @Incomplete @Bug
               placedEntity.rotation = placeRotation; // This has to be done before the hut is registered in its tribe
               // @Cleanup: Move to create function
               tribeComponent.tribe.registerNewWarriorHut(placedEntity);
               break;
            }
            case IEntityType.barrel: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);

               placedEntity = createBarrel(placePosition, tribeComponent.tribe);
               break;
            }
            case IEntityType.campfire: {
               placedEntity = createCampfire(placePosition);
               break;
            }
            case IEntityType.furnace: {
               placedEntity = createFurnace(placePosition);
               break;
            }
            case IEntityType.researchBench: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createResearchBench(placePosition, tribeComponent.tribe);
               break;
            }
            case IEntityType.wall: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createWall(placePosition, tribeComponent.tribe);
               break;
            }
            case IEntityType.planterBox: {
               placedEntity = createPlanterBox(placePosition);
               break;
            }
            case IEntityType.spikes: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createSpikes(placePosition, tribeComponent.tribe, snapInfo !== null && Board.entityRecord[snapInfo.snappedEntityID].type === IEntityType.wall ? snapInfo.snappedEntityID : 0);
               break;
            }
            case IEntityType.punjiSticks: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createPunjiSticks(placePosition, tribeComponent.tribe, snapInfo !== null && Board.entityRecord[snapInfo.snappedEntityID].type === IEntityType.wall ? snapInfo.snappedEntityID : 0);
               break;
            }
            case IEntityType.ballista: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createBlueprintEntity(placePosition, BlueprintType.ballista, 0, tribeComponent.tribe, placeRotation);
               break;
            }
            case IEntityType.slingTurret: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               placedEntity = createBlueprintEntity(placePosition, BlueprintType.slingTurret, 0, tribeComponent.tribe, placeRotation);
               break;
            }
            default: {
               // @Robustness: Should automatically detect this before compiled
               throw new Error("No case for placing item type '" + item.type + "'.");
            }
         }

         // @Incomplete @Bug: This will mess up the hitboxes of the entity as we don't clean the hitboxes!
         // Rotate it to match the entity's rotation
         placedEntity.rotation = placeRotation;

         consumeItemFromSlot(inventoryComponent, "hotbar", itemSlot, 1);

         break;
      }
      case "bow": {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);
         if (useInfo.bowCooldownTicks !== 0) {
            return;
         }

         useInfo.lastBowChargeTicks = Board.ticks;

         const itemInfo = ITEM_INFO_RECORD[item.type] as BowItemInfo;
         useInfo.bowCooldownTicks = itemInfo.shotCooldownTicks;

         // Offset the arrow's spawn to be just outside of the tribe member's hitbox
         // @Speed: Garbage collection
         const spawnPosition = tribeMember.position.copy();
         const offset = Point.fromVectorForm(35, tribeMember.rotation);
         spawnPosition.add(offset);

         let arrow: Entity;
         switch (item.type) {
            case ItemType.wooden_bow:
            case ItemType.reinforced_bow: {
               const arrowInfo: GenericArrowInfo = {
                  type: GenericArrowType.woodenArrow,
                  damage: itemInfo.projectileDamage,
                  knockback: itemInfo.projectileKnockback,
                  hitboxWidth: 12,
                  hitboxHeight: 64,
                  ignoreFriendlyBuildings: false,
                  statusEffect: null
               }
               arrow = createWoodenArrow(spawnPosition, tribeMember, arrowInfo);
               break;
            }
            case ItemType.ice_bow: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
               arrow = createIceArrow(spawnPosition, tribeMember.rotation, tribeComponent.tribe);
               break;
            }
            default: {
               throw new Error("No case for bow type " + item.type);
            }
         }

         arrow.velocity.x = itemInfo.projectileSpeed * Math.sin(tribeMember.rotation);
         arrow.velocity.y = itemInfo.projectileSpeed * Math.cos(tribeMember.rotation);
         
         break;
      }
      case "crossbow": {
         // Don't fire if not loaded
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);
         if (!useInfo.crossbowLoadProgressRecord.hasOwnProperty(itemSlot) || useInfo.crossbowLoadProgressRecord[itemSlot] < 1) {
            return;
         }

         // Offset the arrow's spawn to be just outside of the tribe member's hitbox
         // @Speed: Garbage collection
         const spawnPosition = tribeMember.position.copy();
         const offset = Point.fromVectorForm(35, tribeMember.rotation);
         spawnPosition.add(offset);
         
         const itemInfo = ITEM_INFO_RECORD[item.type] as BowItemInfo;
         // @Copynpaste from bow above
         const arrowInfo: GenericArrowInfo = {
            type: GenericArrowType.woodenArrow,
            damage: itemInfo.projectileDamage,
            knockback: itemInfo.projectileKnockback,
            hitboxWidth: 12,
            hitboxHeight: 64,
            ignoreFriendlyBuildings: false,
            statusEffect: null
         }
         const arrow = createWoodenArrow(spawnPosition, tribeMember, arrowInfo);
         
         arrow.velocity.x = itemInfo.projectileSpeed * Math.sin(tribeMember.rotation);
         arrow.velocity.y = itemInfo.projectileSpeed * Math.cos(tribeMember.rotation);

         delete useInfo.crossbowLoadProgressRecord[itemSlot];
         
         break;
      }
      case "spear": {
         // 
         // Throw the spear
         // 

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

         const offsetDirection = tribeMember.rotation + Math.PI / 1.5 - Math.PI / 14;
         const x = tribeMember.position.x + 35 * Math.sin(offsetDirection);
         const y = tribeMember.position.y + 35 * Math.cos(offsetDirection);
         const spear = createSpearProjectile(new Point(x, y), tribeMember.id, item);

         const ticksSinceLastAction = Board.ticks - useInfo.lastSpearChargeTicks;
         const secondsSinceLastAction = ticksSinceLastAction / SettingsConst.TPS;
         const velocityMagnitude = lerp(1000, 1700, Math.min(secondsSinceLastAction / 3, 1));

         spear.velocity.x = velocityMagnitude * Math.sin(tribeMember.rotation);
         spear.velocity.y = velocityMagnitude * Math.cos(tribeMember.rotation);
         spear.rotation = tribeMember.rotation;

         consumeItemFromSlot(inventoryComponent, inventoryName, itemSlot, 1);

         useInfo.lastSpearChargeTicks = Board.ticks;
         
         break;
      }
      case "battleaxe": {
         // 
         // Throw the battleaxe
         // 

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

         const offsetDirection = tribeMember.rotation + Math.PI / 1.5 - Math.PI / 14;
         const x = tribeMember.position.x + 35 * Math.sin(offsetDirection);
         const y = tribeMember.position.y + 35 * Math.cos(offsetDirection);
         const battleaxe = createBattleaxeProjectile(new Point(x, y), tribeMember.id, item);

         const ticksSinceLastAction = Board.ticks - useInfo.lastBattleaxeChargeTicks;
         const secondsSinceLastAction = ticksSinceLastAction / SettingsConst.TPS;
         const velocityMagnitude = lerp(600, 1100, Math.min(secondsSinceLastAction / 3, 1));

         battleaxe.velocity.x = velocityMagnitude * Math.sin(tribeMember.rotation);
         battleaxe.velocity.y = velocityMagnitude * Math.cos(tribeMember.rotation);
         battleaxe.rotation = tribeMember.rotation;

         // Add velocity from thrower
         battleaxe.velocity.x += tribeMember.velocity.x;
         battleaxe.velocity.y += tribeMember.velocity.y;

         useInfo.lastBattleaxeChargeTicks = Board.ticks;
         useInfo.thrownBattleaxeItemID = item.id;
         
         break;
      }
   }
}

export function tribeMemberCanPickUpItem(tribeMember: Entity, itemType: ItemType): boolean {
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember.id);
   const inventory = getInventory(inventoryComponent, "hotbar");
   
   for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
      if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
         return true;
      }

      const item = inventory.itemSlots[itemSlot];
      if (item.type === itemType && itemIsStackable(item.type) && getItemStackSize(item) - item.count > 0) {
         return true;
      }
   }

   return false;
}

const tickInventoryUseInfo = (tribeMember: Entity, inventoryUseInfo: InventoryUseInfo): void => {
   switch (inventoryUseInfo.currentAction) {
      case TribeMemberAction.eat: {
         inventoryUseInfo.foodEatingTimer -= SettingsConst.I_TPS;
   
         if (inventoryUseInfo.foodEatingTimer <= 0 && inventoryHasItemInSlot(inventoryUseInfo.inventory, inventoryUseInfo.selectedItemSlot)) {
            const selectedItem = getItemFromInventory(inventoryUseInfo.inventory, inventoryUseInfo.selectedItemSlot);
            if (selectedItem !== null) {
               const itemCategory = ITEM_TYPE_RECORD[selectedItem.type];
               if (itemCategory === "food") {
                  useItem(tribeMember, selectedItem, inventoryUseInfo.inventory.name, inventoryUseInfo.selectedItemSlot);
   
                  const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as FoodItemInfo;
                  inventoryUseInfo.foodEatingTimer = itemInfo.eatTime;
               }
            }
         }
         break;
      }
      case TribeMemberAction.loadCrossbow: {
         if (!inventoryUseInfo.crossbowLoadProgressRecord.hasOwnProperty(inventoryUseInfo.selectedItemSlot)) {
            inventoryUseInfo.crossbowLoadProgressRecord[inventoryUseInfo.selectedItemSlot] = SettingsConst.I_TPS;
         } else {
            inventoryUseInfo.crossbowLoadProgressRecord[inventoryUseInfo.selectedItemSlot] += SettingsConst.I_TPS;
         }
         
         if (inventoryUseInfo.crossbowLoadProgressRecord[inventoryUseInfo.selectedItemSlot] >= 1) {
            inventoryUseInfo.crossbowLoadProgressRecord[inventoryUseInfo.selectedItemSlot] = 1;
            inventoryUseInfo.currentAction = TribeMemberAction.none;
         }
         
         break;
      }
   }
}

export function tickTribeMember(tribeMember: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember.id);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember.id);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
   tickInventoryUseInfo(tribeMember, useInfo);

   const tribeComponent = TribeComponentArray.getComponent(tribeMember.id);
   if (tribeComponent.tribe.type === TribeType.barbarians && tribeMember.type !== IEntityType.tribeWorker) {
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "offhand");
      tickInventoryUseInfo(tribeMember, useInfo);
   }


   // @Speed: Shouldn't be done every tick, only do when the backpack changes
   // Update backpack
   const backpackSlotInventory = getInventory(inventoryComponent, "backpackSlot");
   if (backpackSlotInventory.itemSlots.hasOwnProperty(1)) {
      const itemInfo = ITEM_INFO_RECORD[backpackSlotInventory.itemSlots[1].type] as BackpackItemInfo;
      resizeInventory(inventoryComponent, "backpack", itemInfo.inventoryWidth, itemInfo.inventoryHeight);
   } else {
      resizeInventory(inventoryComponent, "backpack", -1, -1);
   }
      
   // @Speed: Shouldn't be done every tick, only do when the armour changes
   // Armour defence
   const armourSlotInventory = getInventory(inventoryComponent, "armourSlot");
   const healthComponent = HealthComponentArray.getComponent(tribeMember.id);
   if (armourSlotInventory.itemSlots.hasOwnProperty(1)) {
      const itemInfo = ITEM_INFO_RECORD[armourSlotInventory.itemSlots[1].type] as ArmourItemInfo;
      addDefence(healthComponent, itemInfo.defence, "armour");
   } else {
      removeDefence(healthComponent, "armour");
   }
}

export function onTribeMemberHurt(tribeMember: Entity, attackingEntity: Entity): void {
   const tribeMemberComponent = TribeMemberComponentArray.getComponent(tribeMember.id);
   for (let i = 0; i < tribeMemberComponent.fishFollowerIDs.length; i++) {
      const fishID = tribeMemberComponent.fishFollowerIDs[i];
      const fish = Board.entityRecord[fishID];
      onFishLeaderHurt(fish, attackingEntity);
   }
}

export function wasTribeMemberKill(attackingEntity: Entity | null): boolean {
   return attackingEntity !== null && (attackingEntity.type === IEntityType.player || attackingEntity.type === IEntityType.tribeWorker || attackingEntity.type === IEntityType.tribeWarrior || attackingEntity.type === IEntityType.spikes || attackingEntity.type === IEntityType.punjiSticks || attackingEntity.type === IEntityType.ballista || attackingEntity.type === IEntityType.slingTurret);
}