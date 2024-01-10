import { ArmourItemInfo, AxeItemInfo, BackpackItemInfo, BattleaxeItemInfo, BowItemInfo, FoodItemInfo, HitFlags, IEntityType, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, Item, ItemType, PlaceableItemType, PlayerCauseOfDeath, Point, SETTINGS, SNAP_OFFSETS, StatusEffectConst, StructureType, SwordItemInfo, ToolItemInfo, TribeMemberAction, TribeType, distance, getItemStackSize, itemIsStackable, lerp } from "webgl-test-shared";
import Entity, { RESOURCE_ENTITY_TYPES } from "../../Entity";
import Board from "../../Board";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, TribeComponentArray, TribeMemberComponentArray } from "../../components/ComponentArray";
import { InventoryComponent, addItemToInventory, addItemToSlot, consumeItem, getInventory, getItem, getItemFromInventory, removeItemFromInventory, resizeInventory } from "../../components/InventoryComponent";
import { getEntitiesInVisionRange } from "../../ai-shared";
import { addDefence, damageEntity, healEntity, removeDefence } from "../../components/HealthComponent";
import { WORKBENCH_SIZE, createWorkbench } from "../workbench";
import { TRIBE_TOTEM_SIZE, createTribeTotem } from "./tribe-totem";
import { WORKER_HUT_SIZE, createWorkerHut } from "./worker-hut";
import { applyStatusEffect } from "../../components/StatusEffectComponent";
import { BARREL_SIZE, createBarrel } from "./barrel";
import { CAMPFIRE_SIZE, createCampfire } from "../cooking-entities/campfire";
import { FURNACE_SIZE, createFurnace } from "../cooking-entities/furnace";
import Hitbox from "../../hitboxes/Hitbox";
import { createWoodenArrow } from "../projectiles/wooden-arrow";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { itemEntityCanBePickedUp } from "../item-entity";
import { onFishLeaderHurt } from "../mobs/fish";
import { createSpearProjectile } from "../projectiles/spear-projectile";
import { createResearchBench } from "../research-bench";
import { WARRIOR_HUT_SIZE, createWarriorHut } from "./warrior-hut";
import { createWoodenWall } from "../structures/wooden-wall";
import { InventoryUseInfo, getInventoryUseInfo } from "../../components/InventoryUseComponent";
import { createBattleaxeProjectile } from "../projectiles/battleaxe-projectile";

const DEFAULT_ATTACK_KNOCKBACK = 125;

const SWORD_DAMAGEABLE_ENTITIES: ReadonlyArray<IEntityType> = [IEntityType.zombie, IEntityType.krumblid, IEntityType.cactus, IEntityType.tribeWorker, IEntityType.tribeWarrior, IEntityType.player, IEntityType.yeti, IEntityType.frozenYeti, IEntityType.berryBush, IEntityType.fish, IEntityType.tribeTotem, IEntityType.workerHut, IEntityType.warriorHut, IEntityType.cow, IEntityType.golem];
const PICKAXE_DAMAGEABLE_ENTITIES: ReadonlyArray<IEntityType> = [IEntityType.boulder, IEntityType.tombstone, IEntityType.iceSpikes, IEntityType.furnace, IEntityType.golem];
const AXE_DAMAGEABLE_ENTITIES: ReadonlyArray<IEntityType> = [IEntityType.tree];
const HOSTILE_MOB_TYPES: ReadonlyArray<IEntityType> = [IEntityType.yeti, IEntityType.frozenYeti, IEntityType.zombie, IEntityType.slime];

const testRectangularHitbox = new RectangularHitbox({position: new Point(0, 0), rotation: 0}, 0, 0, -1, -1, 0);
const testCircularHitbox = new CircularHitbox({position: new Point(0, 0), rotation: 0}, 0, 0, -1, 0);

enum PlaceableItemHitboxType {
   circular = 0,
   rectangular = 1
}

interface PlaceableItemHitboxInfo {
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

const PLACEABLE_ITEM_HITBOX_INFO: Record<PlaceableItemType, PlaceableItemCircularHitboxInfo | PlaceableItemRectangularHitboxInfo> = {
   [ItemType.workbench]: {
      type: PlaceableItemHitboxType.rectangular,
      width: WORKBENCH_SIZE,
      height: WORKBENCH_SIZE,
      placeOffset: WORKBENCH_SIZE / 2
   },
   [ItemType.tribe_totem]: {
      type: PlaceableItemHitboxType.circular,
      radius: TRIBE_TOTEM_SIZE / 2,
      placeOffset: TRIBE_TOTEM_SIZE / 2
   },
   [ItemType.worker_hut]: {
      type: PlaceableItemHitboxType.rectangular,
      width: WORKER_HUT_SIZE,
      height: WORKER_HUT_SIZE,
      placeOffset: WORKER_HUT_SIZE / 2
   },
   [ItemType.warrior_hut]: {
      type: PlaceableItemHitboxType.rectangular,
      width: WARRIOR_HUT_SIZE,
      height: WARRIOR_HUT_SIZE,
      placeOffset: WARRIOR_HUT_SIZE / 2
   },
   [ItemType.barrel]: {
      type: PlaceableItemHitboxType.circular,
      radius: BARREL_SIZE / 2,
      placeOffset: BARREL_SIZE / 2
   },
   [ItemType.campfire]: {
      type: PlaceableItemHitboxType.rectangular,
      width: CAMPFIRE_SIZE,
      height: CAMPFIRE_SIZE,
      placeOffset: CAMPFIRE_SIZE / 2
   },
   [ItemType.furnace]: {
      type: PlaceableItemHitboxType.rectangular,
      width: FURNACE_SIZE,
      height: FURNACE_SIZE,
      placeOffset: FURNACE_SIZE / 2
   },
   [ItemType.research_bench]: {
      type: PlaceableItemHitboxType.rectangular,
      width: 32 * 4,
      height: 20 * 4,
      placeOffset: 50
   },
   [ItemType.wooden_wall]: {
      type: PlaceableItemHitboxType.rectangular,
      width: 64,
      height: 64,
      placeOffset: 32
   }
};

function assertItemTypeIsPlaceable(itemType: ItemType): asserts itemType is PlaceableItemType {
   if (!PLACEABLE_ITEM_HITBOX_INFO.hasOwnProperty(itemType)) {
      throw new Error(`Entity type '${itemType}' is not placeable.`);
   }
}

export enum AttackToolType {
   weapon,
   pickaxe,
   axe
}

// /** Relationships a tribe member can have, in increasing order of threat */
export enum EntityRelationship {
   friendly,
   neutral,
   resource,
   hostileMob,
   enemyBuilding,
   enemy
}

export function getTribeMemberRelationship(tribeMember: Entity, entity: Entity): EntityRelationship {
   // Necessary for when the tribe member is not in a tribe
   if (entity === tribeMember) {
      return EntityRelationship.friendly;
   }

   const tribeComponent = TribeComponentArray.getComponent(tribeMember);
   
   switch (entity.type) {
      case IEntityType.workerHut: {
         if (tribeComponent.tribe === null || !tribeComponent.tribe.hasHut(entity)) {
            return EntityRelationship.enemyBuilding;
         }
         return EntityRelationship.friendly;
      }
      case IEntityType.warriorHut: {
         if (tribeComponent.tribe === null || !tribeComponent.tribe.hasHut(entity)) {
            return EntityRelationship.enemyBuilding;
         }
         return EntityRelationship.friendly;
      }
      case IEntityType.tribeTotem: {
         if (tribeComponent.tribe === null || !tribeComponent.tribe.hasTotem(entity)) {
            return EntityRelationship.enemyBuilding;
         }
         return EntityRelationship.friendly;
      }
      case IEntityType.barrel: {
         const entityTribeComponent = TribeComponentArray.getComponent(entity);
         if (tribeComponent.tribe === null || entityTribeComponent === null) {
            return EntityRelationship.neutral;
         }
         if (entityTribeComponent.tribe === tribeComponent.tribe) {
            return EntityRelationship.friendly;
         }
         return EntityRelationship.enemyBuilding;
      }
      case IEntityType.player:
      case IEntityType.tribeWorker:
      case IEntityType.tribeWarrior: {
         const entityTribeComponent = TribeComponentArray.getComponent(entity);
         if (tribeComponent.tribe !== null && entityTribeComponent.tribe === tribeComponent.tribe) {
            return EntityRelationship.friendly;
         }
         return EntityRelationship.enemy;
      }
   }

   if (HOSTILE_MOB_TYPES.includes(entity.type)) {
      return EntityRelationship.hostileMob;
   }

   if (RESOURCE_ENTITY_TYPES.includes(entity.type)) {
      return EntityRelationship.resource;
   }

   return EntityRelationship.neutral;
}

export function getEntityAttackToolType(entity: Entity): AttackToolType | null {
   // @Cleanup: This shouldn't be hardcoded ideally
   
   if (SWORD_DAMAGEABLE_ENTITIES.includes(entity.type)) {
      return AttackToolType.weapon;
   }
   if (PICKAXE_DAMAGEABLE_ENTITIES.includes(entity.type)) {
      return AttackToolType.pickaxe;
   }
   if (AXE_DAMAGEABLE_ENTITIES.includes(entity.type)) {
      return AttackToolType.axe;
   }

   return null;
}

export function calculateItemDamage(item: Item | null, entityToAttack: Entity): number {
   if (item === null) {
      return 1;
   }

   const attackToolType = getEntityAttackToolType(entityToAttack);
   const itemCategory = ITEM_TYPE_RECORD[item.type];
   switch (itemCategory) {
      case "battleaxe": {
         if (attackToolType === AttackToolType.weapon || attackToolType === AttackToolType.axe) {
            const itemInfo = ITEM_INFO_RECORD[item.type] as BattleaxeItemInfo;
            return itemInfo.damage;
         }
         return 1;
      }
      case "spear":
      case "sword": {
         if (attackToolType === AttackToolType.weapon) {
            const itemInfo = ITEM_INFO_RECORD[item.type] as SwordItemInfo;
            return itemInfo.damage;
         }
         return 1;
      }
      case "axe": {
         const itemInfo = ITEM_INFO_RECORD[item.type] as AxeItemInfo;
         if (attackToolType === AttackToolType.axe) {
            return itemInfo.damage;
         }
         return Math.floor(itemInfo.damage / 2);
      }
      case "pickaxe": {
         const itemInfo = ITEM_INFO_RECORD[item.type] as AxeItemInfo;
         if (attackToolType === AttackToolType.pickaxe) {
            return itemInfo.damage;
         } else {
            return Math.floor(itemInfo.damage / 2);
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

/**
 * @param targetEntity The entity to attack
 * @param itemSlot The item slot being used to attack the entity
 */
// @Cleanup: Pass in the item to use directly instead of passing in the item slot and inventory name
// @Cleanup: Not just for tribe members, move to different file
export function attackEntity(tribeMember: Entity, targetEntity: Entity, itemSlot: number, inventoryName: string): boolean {
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   // Don't attack if on cooldown
   if (useInfo.itemAttackCooldowns.hasOwnProperty(itemSlot)) {
      return false;
   }
   
   // Find the selected item
   const item = getItem(inventoryComponent, inventoryName, itemSlot);

   // Reset attack cooldown
   if (item !== null) {
      const itemTypeInfo = ITEM_TYPE_RECORD[item.type];
      if (itemTypeInfo === "axe" || itemTypeInfo === "pickaxe" || itemTypeInfo === "sword" || itemTypeInfo === "spear" || itemTypeInfo === "hammer" || itemTypeInfo === "battleaxe") {
         const itemInfo = ITEM_INFO_RECORD[item.type];
         useInfo.itemAttackCooldowns[itemSlot] = (itemInfo as ToolItemInfo).attackCooldown;
      } else {
         useInfo.itemAttackCooldowns[itemSlot] = SETTINGS.DEFAULT_ATTACK_COOLDOWN;
      }
   } else {
      useInfo.itemAttackCooldowns[itemSlot] = SETTINGS.DEFAULT_ATTACK_COOLDOWN;
   }

   const attackDamage = calculateItemDamage(item, targetEntity);
   const attackKnockback = calculateItemKnockback(item);

   const hitDirection = tribeMember.position.calculateAngleBetween(targetEntity.position);

   // Register the hit
   const hitFlags = item !== null && item.type === ItemType.flesh_sword ? HitFlags.HIT_BY_FLESH_SWORD : 0
   damageEntity(targetEntity, attackDamage, attackKnockback, hitDirection, tribeMember, PlayerCauseOfDeath.tribe_member, hitFlags);

   if (item !== null && item.type === ItemType.flesh_sword) {
      applyStatusEffect(targetEntity, StatusEffectConst.poisoned, 3 * SETTINGS.TPS);
   }

   useInfo.lastAttackTicks = Board.ticks;

   return true;
}

// @Cleanup: Not just for tribe members, move to different file
export function calculateAttackTarget(tribeMember: Entity, targetEntities: ReadonlyArray<Entity>): Entity | null {
   let closestEntity: Entity | null = null;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const targetEntity of targetEntities) {
      // Don't attack entities without health components
      if (!HealthComponentArray.hasComponent(targetEntity)) {
         continue;
      }

      // @Cleanup: Don't hardcode the zombie condition. Instead move the relationship check to outside this function
      if (tribeMember.type === IEntityType.zombie || getTribeMemberRelationship(tribeMember, targetEntity) !== EntityRelationship.friendly) {
         const dist = tribeMember.position.calculateDistanceBetween(targetEntity.position);
         if (dist < minDistance) {
            closestEntity = targetEntity;
            minDistance = dist;
         }
      }
   }

   if (closestEntity === null) return null;

   return closestEntity;
}

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
   const placePositionX = entity.position.x + (SETTINGS.ITEM_PLACE_DISTANCE + placeInfo.placeOffset) * Math.sin(entity.rotation);
   const placePositionY = entity.position.y + (SETTINGS.ITEM_PLACE_DISTANCE + placeInfo.placeOffset) * Math.cos(entity.rotation);
   return new Point(placePositionX, placePositionY);
}

interface BuildingSnapInfo {
   /** -1 if no snap was found */
   readonly x: number;
   readonly y: number;
   readonly direction: number;
}
export function calculateSnapInfo(entity: Entity, placeInfo: PlaceableItemHitboxInfo): BuildingSnapInfo {
   const regularPlacePosition = calculateRegularPlacePosition(entity, placeInfo);

   const minChunkX = Math.max(Math.floor((regularPlacePosition.x - SETTINGS.STRUCTURE_SNAP_RANGE) / SETTINGS.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor((regularPlacePosition.x + SETTINGS.STRUCTURE_SNAP_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor((regularPlacePosition.y - SETTINGS.STRUCTURE_SNAP_RANGE) / SETTINGS.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor((regularPlacePosition.y + SETTINGS.STRUCTURE_SNAP_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
   
   const snappableEntities = new Array<Entity>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const currentEntity of chunk.entities) {
            const distance = regularPlacePosition.calculateDistanceBetween(currentEntity.position);
            if (distance > SETTINGS.STRUCTURE_SNAP_RANGE) {
               continue;
            }
            
            if (currentEntity.type === IEntityType.woodenWall) {
               snappableEntities.push(currentEntity);
            }
         }
      }
   }

   for (const snapEntity of snappableEntities) {
      const snapOffset = SNAP_OFFSETS[snapEntity.type as unknown as StructureType];
      // Check the 4 potential snap positions for matches
      for (let i = 0; i < 4; i++) {
         const direction = i * Math.PI / 2;
         const placeDirection = (snapEntity.rotation + direction + Math.PI) % (Math.PI * 2) - Math.PI;
         const x = snapEntity.position.x + snapOffset * Math.sin(placeDirection);
         const y = snapEntity.position.y + snapOffset * Math.cos(placeDirection);
         
         if (distance(regularPlacePosition.x, regularPlacePosition.y, x, y) > SETTINGS.STRUCTURE_POSITION_SNAP) {
            continue;
         }

         const placingEntityRotation = (entity.rotation + Math.PI) % (Math.PI * 2) - Math.PI;
         for (let i = 0; i < 4; i++) {
            const direction = i * Math.PI / 2;
            const placeDirection = (snapEntity.rotation + direction + Math.PI) % (Math.PI * 2) - Math.PI;
            let angleDiff = placingEntityRotation - placeDirection;
            angleDiff = (angleDiff + Math.PI) % (Math.PI * 2) - Math.PI;
            if (Math.abs(angleDiff) <= SETTINGS.STRUCTURE_ROTATION_SNAP) {
               return {
                  x: x,
                  y: y,
                  direction: placeDirection
               };
            }
         }
      }
   }
   
   return {
      x: -1,
      y: -1,
      direction: -1
   };
}

const calculatePlacePosition = (entity: Entity, placeInfo: PlaceableItemHitboxInfo, snapInfo: BuildingSnapInfo): Point => {
   if (snapInfo.x === -1) {
      return calculateRegularPlacePosition(entity, placeInfo);
   }

   return new Point(snapInfo.x, snapInfo.y);
}

const calculatePlaceRotation = (entity: Entity, snapInfo: BuildingSnapInfo): number => {
   if (snapInfo.x === -1) {
      return entity.rotation;
   }

   console.log("getting snapDir");
   return snapInfo.direction;
}

const buildingCanBePlaced = (spawnPositionX: number, spawnPositionY: number, placeRotation: number, itemType: PlaceableItemType): boolean => {
   // Update the place test hitbox to match the placeable item's info
   const testHitboxInfo = PLACEABLE_ITEM_HITBOX_INFO[itemType]!

   let placeTestHitbox: Hitbox;
   if (testHitboxInfo.type === PlaceableItemHitboxType.circular) {
      // Circular
      testCircularHitbox.radius = testHitboxInfo.radius;
      placeTestHitbox = testCircularHitbox;
   } else {
      // Rectangular
      testRectangularHitbox.width = testHitboxInfo.width;
      testRectangularHitbox.height = testHitboxInfo.height;
      placeTestHitbox = testRectangularHitbox;
   }

   placeTestHitbox.object.position.x = spawnPositionX;
   placeTestHitbox.object.position.y = spawnPositionY;
   placeTestHitbox.object.rotation = placeRotation;

   const hitboxBoundsMinX = placeTestHitbox.calculateHitboxBoundsMinX();
   const hitboxBoundsMaxX = placeTestHitbox.calculateHitboxBoundsMaxX();
   const hitboxBoundsMinY = placeTestHitbox.calculateHitboxBoundsMinY();
   const hitboxBoundsMaxY = placeTestHitbox.calculateHitboxBoundsMaxY();

   const minChunkX = Math.max(Math.min(Math.floor(hitboxBoundsMinX / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor(hitboxBoundsMaxX / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor(hitboxBoundsMinY / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor(hitboxBoundsMaxY / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
   
   const previouslyCheckedEntityIDs = new Set<number>();

   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.entities) {
            if (!previouslyCheckedEntityIDs.has(entity.id)) {
               for (const hitbox of entity.hitboxes) {   
                  if (placeTestHitbox.isColliding(hitbox)) {
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

   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember);

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
      case "food": {
         const healthComponent = HealthComponentArray.getComponent(tribeMember);

         // Don't use food if already at maximum health
         if (healthComponent.health >= healthComponent.maxHealth) return;

         const itemInfo = ITEM_INFO_RECORD[item.type] as FoodItemInfo;

         healEntity(tribeMember, itemInfo.healAmount);
         consumeItem(inventoryComponent, inventoryName, itemSlot, 1);

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);
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
         if (!buildingCanBePlaced(placePosition.x, placePosition.y, placeRotation, item.type)) return;
         
         // Spawn the placeable entity
         let placedEntity: Entity;
         switch (item.type) {
            case ItemType.workbench: {
               placedEntity = createWorkbench(placePosition);
               break;
            }
            case ItemType.tribe_totem: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember);
               // Don't place a tribe totem if they aren't in a tribe
               if (tribeComponent.tribe === null) {
                  return;
               }

               placedEntity = createTribeTotem(placePosition, tribeComponent.tribe);
               break;
            }
            case ItemType.worker_hut: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember);
               if (tribeComponent.tribe === null) {
                  throw new Error("Tribe member didn't belong to a tribe when placing a hut");
               }
               
               placedEntity = createWorkerHut(placePosition, tribeComponent.tribe);
               placedEntity.rotation = placeRotation; // This has to be done before the hut is registered in its tribe
               tribeComponent.tribe.registerNewWorkerHut(placedEntity);
               break;
            }
            case ItemType.warrior_hut: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember);
               if (tribeComponent.tribe === null) {
                  throw new Error("Tribe member didn't belong to a tribe when placing a hut");
               }
               
               placedEntity = createWarriorHut(placePosition, tribeComponent.tribe);
               placedEntity.rotation = placeRotation; // This has to be done before the hut is registered in its tribe
               tribeComponent.tribe.registerNewWarriorHut(placedEntity);
               break;
            }
            case ItemType.barrel: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember);

               placedEntity = createBarrel(placePosition, tribeComponent.tribeType, tribeComponent.tribe);
               if (tribeComponent.tribe !== null) {
                  tribeComponent.tribe.addBarrel(placedEntity);
               }
               break;
            }
            case ItemType.campfire: {
               placedEntity = createCampfire(placePosition);
               break;
            }
            case ItemType.furnace: {
               placedEntity = createFurnace(placePosition);
               break;
            }
            case ItemType.research_bench: {
               placedEntity = createResearchBench(placePosition);
               break;
            }
            case ItemType.wooden_wall: {
               const tribeComponent = TribeComponentArray.getComponent(tribeMember);
               placedEntity = createWoodenWall(placePosition, tribeComponent.tribe);
               break;
            }
            default: {
               // @Robustness: Should automatically detect this before compiled
               throw new Error("No case for placing item type '" + item.type + "'.");
            }
         }

         // Rotate it to match the entity's rotation
         placedEntity.rotation = placeRotation;

         consumeItem(inventoryComponent, "hotbar", itemSlot, 1);

         break;
      }
      case "bow": {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);
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

         createWoodenArrow(spawnPosition, tribeMember);
         
         break;
      }
      case "spear": {
         // 
         // Throw the spear
         // 

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

         const offsetDirection = tribeMember.rotation + Math.PI / 1.5 - Math.PI / 14;
         const x = tribeMember.position.x + 35 * Math.sin(offsetDirection);
         const y = tribeMember.position.y + 35 * Math.cos(offsetDirection);
         const spear = createSpearProjectile(new Point(x, y), tribeMember.id, item);

         const ticksSinceLastAction = Board.ticks - useInfo.lastSpearChargeTicks;
         const secondsSinceLastAction = ticksSinceLastAction / SETTINGS.TPS;
         const velocityMagnitude = lerp(1000, 1700, Math.min(secondsSinceLastAction / 3, 1));

         spear.velocity.x = velocityMagnitude * Math.sin(tribeMember.rotation);
         spear.velocity.y = velocityMagnitude * Math.cos(tribeMember.rotation);
         spear.rotation = tribeMember.rotation;

         consumeItem(inventoryComponent, inventoryName, itemSlot, 1);

         useInfo.lastSpearChargeTicks = Board.ticks;
         
         break;
      }
      case "battleaxe": {
         // 
         // Throw the battleaxe
         // 

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

         const offsetDirection = tribeMember.rotation + Math.PI / 1.5 - Math.PI / 14;
         const x = tribeMember.position.x + 35 * Math.sin(offsetDirection);
         const y = tribeMember.position.y + 35 * Math.cos(offsetDirection);
         const battleaxe = createBattleaxeProjectile(new Point(x, y), tribeMember.id, item);

         const ticksSinceLastAction = Board.ticks - useInfo.lastBattleaxeChargeTicks;
         const secondsSinceLastAction = ticksSinceLastAction / SETTINGS.TPS;
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
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember);
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

/**
 * Attempts to pick up an item and add it to the inventory
 * @param itemEntity The dropped item to attempt to pick up
 * @returns Whether some non-zero amount of the item was picked up or not
 */
export function pickupItemEntity(tribeMember: Entity, itemEntity: Entity): boolean {
   // Don't pick up dropped items which are on pickup cooldown
   if (!itemEntityCanBePickedUp(itemEntity, tribeMember.id)) return false;

   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember);
   const itemComponent = ItemComponentArray.getComponent(itemEntity);

   for (const [inventoryName, _inventory] of inventoryComponent.inventoryArray) {
      if (!_inventory.acceptsPickedUpItems) {
         continue;
      }
      
      const amountPickedUp = addItemToInventory(inventoryComponent, inventoryName, itemComponent.itemType, itemComponent.amount);

      itemComponent.amount -= amountPickedUp;

      // When all of the item stack is picked up, don't attempt to add to any other inventories.
      if (itemComponent.amount === 0) {
         break;
      }
   }

   // If all of the item was added, destroy it
   if (itemComponent.amount === 0) {
      itemEntity.remove();
      return true;
   }

   return false;
}

const tickInventoryUseInfo = (tribeMember: Entity, inventoryUseInfo: InventoryUseInfo): void => {
   if (inventoryUseInfo.currentAction === TribeMemberAction.eat) {
      inventoryUseInfo.foodEatingTimer -= 1 / SETTINGS.TPS;

      if (inventoryUseInfo.foodEatingTimer <= 0) {
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
   }
}

export function tickTribeMember(tribeMember: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(tribeMember);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribeMember);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
   tickInventoryUseInfo(tribeMember, useInfo);

   const tribeComponent = TribeComponentArray.getComponent(tribeMember);
   if (tribeComponent.tribeType === TribeType.barbarians && tribeMember.type !== IEntityType.tribeWorker) {
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
   const healthComponent = HealthComponentArray.getComponent(tribeMember);
   if (armourSlotInventory.itemSlots.hasOwnProperty(1)) {
      const itemInfo = ITEM_INFO_RECORD[armourSlotInventory.itemSlots[1].type] as ArmourItemInfo;
      addDefence(healthComponent, itemInfo.defence, "armour");
   } else {
      removeDefence(healthComponent, "armour");
   }
}

export function onTribeMemberHurt(tribeMember: Entity, attackingEntity: Entity): void {
   const tribeMemberComponent = TribeMemberComponentArray.getComponent(tribeMember);
   for (let i = 0; i < tribeMemberComponent.fishFollowerIDs.length; i++) {
      const fishID = tribeMemberComponent.fishFollowerIDs[i];
      const fish = Board.entityRecord[fishID];
      onFishLeaderHurt(fish, attackingEntity);
   }
}