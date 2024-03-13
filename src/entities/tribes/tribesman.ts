import { ITEM_TYPE_RECORD, ITEM_INFO_RECORD, ToolItemInfo, ArmourItemInfo, Item, FoodItemInfo, IEntityType, TribeMemberAction, ItemType, BowItemInfo, angle, distance, TRIBE_INFO_RECORD, HammerItemInfo, distBetweenPointAndRectangle, randInt, PathfindingSettingsConst, Inventory, SettingsConst, TribesmanAIType, PathfindingNodeIndex } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../Entity";
import { getEntitiesInVisionRange, willStopAtDesiredDistance, getClosestAccessibleEntity, stopEntity, moveEntityToPosition } from "../../ai-shared";
import { InventoryComponentArray, TribeComponentArray, TribesmanComponentArray, HealthComponentArray, InventoryUseComponentArray, PlayerComponentArray, ItemComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { getInventory, addItemToInventory, consumeItem, addItemToSlot, removeItemFromInventory, getItem, inventoryIsFull, inventoryHasItemInSlot } from "../../components/InventoryComponent";
import { TribesmanPathType } from "../../components/TribesmanComponent";
import { tickTribeMember, tribeMemberCanPickUpItem, attackEntity, calculateAttackTarget, calculateItemDamage, calculateRadialAttackTargets, useItem, repairBuilding, calculateRepairTarget } from "./tribe-member";
import { TRIBE_WORKER_RADIUS, TRIBE_WORKER_VISION_RANGE } from "./tribe-worker";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { getInventoryUseInfo } from "../../components/InventoryUseComponent";
import Board from "../../Board";
import { TRIBE_WARRIOR_VISION_RANGE } from "./tribe-warrior";
import { AIHelperComponentArray } from "../../components/AIHelperComponent";
import { EntityRelationship, TribeComponent, getTribeMemberRelationship } from "../../components/TribeComponent";
import { getItemAttackCooldown } from "../../items";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { attemptToOccupyResearchBench, canResearchAtBench, continueResearching, markPreemptiveMoveToBench, shouldMoveToResearchBench } from "../../components/ResearchBenchComponent";
import { entityHasReachedNode, getAngleToNode, getClosestPathfindNode, pathfind, positionIsAccessible, radialPathfind, smoothPath } from "../../pathfinding";
import { PhysicsComponentArray } from "../../components/PhysicsComponent";

// @Cleanup: Move all of this to the TribesmanComponent file

const SLOW_ACCELERATION = 200;
const ACCELERATION = 400;

/** How far away from the entity the attack is done */
const ATTACK_OFFSET = 50;
/** Max distance from the attack position that the attack will be registered from */
const ATTACK_RADIUS = 50;

/** How far the tribesmen will try to stay away from the entity they're attacking */
const DESIRED_MELEE_ATTACK_DISTANCE = 60;
const DESIRED_RANGED_ATTACK_DISTANCE = 260;

const DESIRED_MELEE_ATTACK_DISTANCE_NODES = Math.floor(60 / PathfindingSettingsConst.NODE_SEPARATION);

const BARREL_INTERACT_DISTANCE = 80;

const TURN_SPEED = 2 * Math.PI;

/** How far off the target the pathfinding can be before recalculating */
const PATH_RECALCULATE_DIST = 32;

export const TRIBESMAN_COMMUNICATION_RANGE = 1000;

const RESOURCE_PRODUCTS: Partial<Record<IEntityType, ReadonlyArray<ItemType>>> = {
   [IEntityType.cow]: [ItemType.leather, ItemType.raw_beef],
   [IEntityType.berryBush]: [ItemType.berry],
   [IEntityType.tree]: [ItemType.wood],
   [IEntityType.iceSpikes]: [ItemType.frostcicle],
   [IEntityType.cactus]: [ItemType.cactus_spine],
   [IEntityType.boulder]: [ItemType.rock],
   [IEntityType.krumblid]: [ItemType.leather]
}

const MESSAGE_INTERVAL_TICKS = 2 * SettingsConst.TPS;

// @Incomplete: unused
/** Messages tribesman send to each-other to communicate what is happening */
const enum CommunicationMessageType {
   callToArms,
   /** Called when the tribesman is in urgent need of backup while fighting a threat, calling other tribesman to the one which needs help */
   help
}

const getCommunicationTargets = (tribesman: Entity): ReadonlyArray<Entity> => {
   const minChunkX = Math.max(Math.floor((tribesman.position.x - TRIBESMAN_COMMUNICATION_RANGE) / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor((tribesman.position.x + TRIBESMAN_COMMUNICATION_RANGE) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor((tribesman.position.y - TRIBESMAN_COMMUNICATION_RANGE) / SettingsConst.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor((tribesman.position.y + TRIBESMAN_COMMUNICATION_RANGE) / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1);

   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
   
   const communcationTargets = new Array<Entity>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (entity === tribesman || !TribesmanComponentArray.hasComponent(entity)) {
               continue;
            }

            // Make sure the tribesman are of the same tribe
            const otherTribeComponent = TribeComponentArray.getComponent(entity.id);
            if (tribeComponent.tribe.id === otherTribeComponent.tribe.id) {
               communcationTargets.push(entity);
            }
         }
      }
   }

   return communcationTargets;
}

/** Called while fighting an enemy, it calls other tribesman to move to the position of the fighting */
const sendCallToArmsMessage = (communicationTargets: ReadonlyArray<Entity>, targetEntity: Entity): void => {
   for (let i = 0; i < communicationTargets.length; i++) {
      const tribesman = communicationTargets[i];

      const healthComponent = HealthComponentArray.getComponent(tribesman.id);
      if (!shouldEscape(healthComponent)) {
         pathfindToPosition(tribesman, targetEntity.position.x, targetEntity.position.y, targetEntity.id, TribesmanPathType.tribesmanRequest, 0);
      }
   }
}

const sendHelpMessage = (communicatingTribesman: Entity, communicationTargets: ReadonlyArray<Entity>): void => {
   for (let i = 0; i < communicationTargets.length; i++) {
      const tribesman = communicationTargets[i];

      const healthComponent = HealthComponentArray.getComponent(tribesman.id);
      if (!shouldEscape(healthComponent)) {
         pathfindToPosition(tribesman, communicatingTribesman.position.x, communicatingTribesman.position.y, communicatingTribesman.id, TribesmanPathType.tribesmanRequest, Math.floor(64 / PathfindingSettingsConst.NODE_SEPARATION));
      }
   }
}

export function getTribesmanVisionRange(tribesman: Entity): number {
   if (tribesman.type === IEntityType.tribeWorker) {
      return TRIBE_WORKER_VISION_RANGE;
   } else {
      return TRIBE_WARRIOR_VISION_RANGE;
   }
}

const getHuntingVisionRange = (tribesman: Entity): number => {
   return getTribesmanVisionRange(tribesman) * 1.3;
}

const getRadius = (tribesman: Entity): number => {
   if (tribesman.type === IEntityType.tribeWorker) {
      return TRIBE_WORKER_RADIUS;
   } else {
      return 32;
   }
}

const getSlowAcceleration = (tribesman: Entity): number => {
   let acceleration = SLOW_ACCELERATION;

   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
   acceleration *= TRIBE_INFO_RECORD[tribeComponent.tribe.type].moveSpeedMultiplier;

   return acceleration;
}

const getAcceleration = (tribesman: Entity): number => {
   let acceleration = ACCELERATION;

   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
   acceleration *= TRIBE_INFO_RECORD[tribeComponent.tribe.type].moveSpeedMultiplier;

   return acceleration;
}

const getFoodItemSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   // @Speed
   for (const [_itemSlot, item] of Object.entries(hotbarInventory.itemSlots)) {
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "food") {
         return Number(_itemSlot);
      }
   }
   return null;
}

const shouldEscape = (healthComponent: HealthComponent): boolean => {
   return healthComponent.health <= healthComponent.maxHealth / 2;
}

const positionIsSafe = (tribesman: Entity, x: number, y: number): boolean => {
   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
   
   const visibleEntitiesFromItem = getEntitiesInVisionRange(x, y, getTribesmanVisionRange(tribesman));
   for (const entity of visibleEntitiesFromItem) {
      const relationship = getTribeMemberRelationship(tribeComponent, entity);
      if (relationship >= EntityRelationship.hostileMob) {
         return false;
      }
   }
   return true;
}

const findNearestBarrel = (tribesman: Entity): Entity | null => {
   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
   
   let minDistance = Number.MAX_SAFE_INTEGER;
   let closestBarrel: Entity | null = null;
   for (const barrel of tribeComponent.tribe.barrels) {
      const distance = tribesman.position.calculateDistanceBetween(barrel.position);
      if (distance < minDistance) {
         minDistance = distance;
         closestBarrel = barrel;
      }
   }
   
   return closestBarrel;
}

/** Deposit all resources from the tribesman's inventory into a barrel */
const depositResources = (tribesman: Entity, barrel: Entity): void => {
   const tribesmanInventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const barrelInventoryComponent = InventoryComponentArray.getComponent(barrel.id);
   const tribesmanInventory = getInventory(tribesmanInventoryComponent, "hotbar");

   // 
   // Isolate the items the tribesman will want to keep
   // 
   const bestWeaponItemSlot = getBestWeaponSlot(tribesman);
   let bestPickaxeLevel = -1;
   let bestPickaxeItemSlot = -1;
   let bestAxeLevel = -1;
   let bestAxeItemSlot = -1;
   let bestArmourLevel = -1;
   let bestArmourItemSlot = -1;
   let bestHammerLevel = -1;
   let bestHammerItemSlot = -1;
   let firstFoodItemSlot = -1; // Tribesman will only keep the first food item type in their inventory
   for (let itemSlot = 1; itemSlot <= tribesmanInventory.width * tribesmanInventory.height; itemSlot++) {
      if (!tribesmanInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = tribesmanInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      switch (itemCategory) {
         case "pickaxe": {
            if ((itemInfo as ToolItemInfo).level > bestPickaxeLevel) {
               bestPickaxeLevel = (itemInfo as ToolItemInfo).level;
               bestPickaxeItemSlot = itemSlot;
            }
            break;
         }
         case "axe": {
            if ((itemInfo as ToolItemInfo).level > bestAxeLevel) {
               bestAxeLevel = (itemInfo as ToolItemInfo).level;
               bestAxeItemSlot = itemSlot;
            }
            break;
         }
         case "armour": {
            if ((itemInfo as ArmourItemInfo).level > bestArmourLevel) {
               bestArmourLevel = (itemInfo as ArmourItemInfo).level;
               bestArmourItemSlot = itemSlot;
            }
            break;
         }
         case "hammer": {
            if ((itemInfo as ArmourItemInfo).level > bestHammerLevel) {
               bestHammerLevel = (itemInfo as ArmourItemInfo).level;
               bestHammerItemSlot = itemSlot;
            }
            break;
         }
         case "food": {
            if (firstFoodItemSlot === -1) {
               firstFoodItemSlot = itemSlot;
            }
            break;
         }
      }
   }
   
   // @Speed
   for (const [_itemSlot, item] of Object.entries(tribesmanInventory.itemSlots)) {
      const itemSlot = Number(_itemSlot);
      
      if (itemSlot === bestWeaponItemSlot || itemSlot === bestAxeItemSlot || itemSlot === bestPickaxeItemSlot || itemSlot === bestArmourItemSlot || itemSlot === firstFoodItemSlot || itemSlot === bestHammerItemSlot) {
         continue;
      }
      
      // Add the item to the barrel inventory and remove from tribesman inventory
      const amountAdded = addItemToInventory(barrelInventoryComponent, "inventory", item.type, item.count);
      consumeItem(tribesmanInventoryComponent, "hotbar", itemSlot, amountAdded);
   }
}

const haulToBarrel = (tribesman: Entity, barrel: Entity): void => {
   // @Incomplete: goal radius
   pathfindToPosition(tribesman, barrel.position.x, barrel.position.y, barrel.id, TribesmanPathType.default, 0);

   if (tribesman.position.calculateDistanceBetween(barrel.position) <= BARREL_INTERACT_DISTANCE) {
      depositResources(tribesman, barrel);
   }
}

const hasFood = (tribesman: Entity): boolean => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   for (let slotNum = 1; slotNum <= hotbarInventory.width * hotbarInventory.height; slotNum++) {
      if (hotbarInventory.itemSlots.hasOwnProperty(slotNum)) {
         const item = hotbarInventory.itemSlots[slotNum];

         if (ITEM_TYPE_RECORD[item.type] === "food") {
            return true;
         }
      }
   }

   return false;
}

const grabBarrelFood = (tribesman: Entity, barrel: Entity): void => {
   // 
   // Grab the food stack with the highest total heal amount
   // 

   const barrelInventoryComponent = InventoryComponentArray.getComponent(barrel.id);
   const barrelInventory = getInventory(barrelInventoryComponent, "inventory");

   let foodItemSlot = -1;
   let food: Item | undefined;
   let maxFoodValue = 0;
   for (let slotNum = 1; slotNum <= barrelInventory.width * barrelInventory.height; slotNum++) {
      if (barrelInventory.itemSlots.hasOwnProperty(slotNum)) {
         const item = barrelInventory.itemSlots[slotNum];

         // Skip non-food
         if (ITEM_TYPE_RECORD[item.type] !== "food") {
            continue;
         }

         const foodValue = (ITEM_INFO_RECORD[item.type] as FoodItemInfo).healAmount * item.count;
         if (typeof food === "undefined" || foodValue > maxFoodValue) {
            food = item;
            foodItemSlot = slotNum;
            maxFoodValue = foodValue;
         }
      }
   }
   if (typeof food === "undefined") {
      throw new Error("Couldn't find a food item to grab.");
   }

   const tribesmanInventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   addItemToInventory(tribesmanInventoryComponent, "hotbar", food.type, food.count);
   consumeItem(barrelInventoryComponent, "inventory", foodItemSlot, 999);
}

const hasAvailableHotbarSlot = (hotbarInventory: Inventory): boolean => {
   for (let slotNum = 1; slotNum <= hotbarInventory.width * hotbarInventory.height; slotNum++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(slotNum)) {
         return true;
      }
   }

   return false;
}

const barrelHasFood = (barrel: Entity): boolean => {
   const inventoryComponent = InventoryComponentArray.getComponent(barrel.id);
   const inventory = getInventory(inventoryComponent, "inventory");

   for (let slotNum = 1; slotNum <= inventory.width * inventory.height; slotNum++) {
      if (inventory.itemSlots.hasOwnProperty(slotNum)) {
         const item = inventory.itemSlots[slotNum];
         if (ITEM_TYPE_RECORD[item.type] === "food") {
            return true;
         }
      }
   }

   return false;
}

/** Returns 0 if no hammer is in the inventory */
const getHammerItemSlot = (inventory: Inventory): number => {
   let bestLevel = 0;
   let bestItemSlot = 0;
   for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
      if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = inventory.itemSlots[itemSlot];
      if (item.type === ItemType.wooden_hammer || item.type === ItemType.stone_hammer) {
         const itemInfo = ITEM_INFO_RECORD[item.type] as HammerItemInfo;
         if (itemInfo.level > bestLevel) {
            bestLevel = itemInfo.level;
            bestItemSlot = itemSlot;
         }
      }
   }

   return bestItemSlot;
}

const getOccupiedResearchBenchID = (tribesman: Entity, tribeComponent: TribeComponent): number => {
   for (let i = 0; i < tribeComponent.tribe.researchBenches.length; i++) {
      const bench = tribeComponent.tribe.researchBenches[i];
      if (canResearchAtBench(bench, tribesman)) {
         return bench.id;
      }
   }

   return ID_SENTINEL_VALUE;
}

const getAvailableResearchBenchID = (tribesman: Entity, tribeComponent: TribeComponent): number => {
   let id = ID_SENTINEL_VALUE;
   let minDist = Number.MAX_SAFE_INTEGER;

   for (let i = 0; i < tribeComponent.tribe.researchBenches.length; i++) {
      const bench = tribeComponent.tribe.researchBenches[i];

      if (!shouldMoveToResearchBench(bench, tribesman)) {
         continue;
      }

      const dist = tribesman.position.calculateDistanceBetween(bench.position);
      if (dist < minDist) {
         minDist = dist;
         id = bench.id;
      }
   }

   return id;
}

const shouldRecalculatePath = (tribesman: Entity, x: number, y: number): boolean => {
   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id); // @Speed

   if (tribesmanComponent.path.length === 0) {
      const targetNode = getClosestPathfindNode(x, y);
      return tribesmanComponent.pathfindingTargetNode !== targetNode;
   } else {
      const pathTarget = tribesmanComponent.path[tribesmanComponent.path.length - 1];
      const pathTargetX = pathTarget % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH * PathfindingSettingsConst.NODE_SEPARATION;
      const pathTargetY = Math.floor(pathTarget / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) * PathfindingSettingsConst.NODE_SEPARATION;

      return distance(x, y, pathTargetX, pathTargetY) >= PATH_RECALCULATE_DIST;
   }
}

const continueCurrentPath = (tribesman: Entity): boolean => {
   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id); // @Speed

   if (entityHasReachedNode(tribesman, tribesmanComponent.path[0])) {
      // If passed the next node, remove it
      tribesmanComponent.path.splice(0, 1);
   }

   if (tribesmanComponent.path.length > 0) {
      const nextNode = tribesmanComponent.path[0];
      
      const targetDirection = getAngleToNode(tribesman, nextNode);
      tribesman.turn(targetDirection, TURN_SPEED)

      const acceleration = getAcceleration(tribesman);
      tribesman.acceleration.x = acceleration * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = acceleration * Math.cos(tribesman.rotation);
      return true;
   } else {
      // Reached path!
      stopEntity(tribesman);
      tribesmanComponent.rawPath = [];
      tribesmanComponent.pathType = TribesmanPathType.default;
      return false;
   }
}

const clearPath = (tribesman: Entity): void => {
   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id); // @Speed

   tribesmanComponent.rawPath = [];
   tribesmanComponent.pathType = TribesmanPathType.default;
   while (tribesmanComponent.path.length > 0) {
      tribesmanComponent.path.splice(0, 1);
   }
   tribesmanComponent.pathfindingTargetNode = 9999999999999;
}

const pathfindToPosition = (tribesman: Entity, goalX: number, goalY: number, targetEntityID: number, pathType: TribesmanPathType, goalRadius: number): boolean => {
   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id); // @Speed

   tribesmanComponent.pathType = pathType;

   // If moving to a new target node, recalculate path
   if (shouldRecalculatePath(tribesman, goalX, goalY)) {
      const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
      tribeComponent.tribe.friendlyTribesmenIDs.push(targetEntityID);
      
      const footprint = getRadius(tribesman);

      let rawPath: Array<PathfindingNodeIndex>;
      if (goalRadius === 0) {
         rawPath = pathfind(tribesman.position.x, tribesman.position.y, goalX, goalY, tribeComponent.tribe.friendlyTribesmenIDs, footprint);
      } else {
         rawPath = radialPathfind(tribesman.position.x, tribesman.position.y, goalX, goalY, tribeComponent.tribe.friendlyTribesmenIDs, footprint, goalRadius);
      }
      
      // @Incomplete: figure out why this happens
      // If the pathfinding failed, don't do anything
      if (rawPath.length === 0) {
         stopEntity(tribesman);
         tribeComponent.tribe.friendlyTribesmenIDs.pop();
         return false;
      }
      
      const path = smoothPath(rawPath, tribeComponent.tribe.friendlyTribesmenIDs, footprint);

      // @Speed(??? might be fine)
      while (tribesmanComponent.path.length > 0) {
         tribesmanComponent.path.splice(0, 1);
      }
      for (let i = 0; i < path.length; i++) {
         const node = path[i];
         tribesmanComponent.path.push(node);
      }

      tribesmanComponent.rawPath = rawPath;
      tribeComponent.tribe.friendlyTribesmenIDs.pop();
   }

   return continueCurrentPath(tribesman);
}

const entityIsAccessible = (tribesman: Entity, entity: Entity): boolean => {
   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);
   tribeComponent.tribe.friendlyTribesmenIDs.push(entity.id);

   const isAccessible = positionIsAccessible(entity.position.x, entity.position.y, tribeComponent.tribe.friendlyTribesmenIDs, getRadius(tribesman));

   tribeComponent.tribe.friendlyTribesmenIDs.pop();

   return isAccessible;
}

export function tickTribesman(tribesman: Entity): void {
   // @Cleanup: This is an absolutely massive function
   
   tickTribeMember(tribesman);
   
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);

   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   const armourInventory = getInventory(inventoryComponent, "armourSlot");

   // Automatically equip armour from the hotbar
   if (!armourInventory.itemSlots.hasOwnProperty(1)) {
      for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
         if (hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
            const item = hotbarInventory.itemSlots[itemSlot];
            if (ITEM_TYPE_RECORD[item.type] === "armour") {
               addItemToSlot(inventoryComponent, "armourSlot", 1, item.type, 1);
               removeItemFromInventory(inventoryComponent, "hotbar", itemSlot);
               break;
            }
         }
      }
   }

   const aiHelperComponent = AIHelperComponentArray.getComponent(tribesman.id);
   const tribeComponent = TribeComponentArray.getComponent(tribesman.id);

   // @Cleanup: A nicer way to do this might be to sort the visible entities array based on the 'threat level' of each entity
   // @Cleanup: A perhaps combine the visible enemies and visible hostile mobs arrays?

   // Categorise visible entities
   const visibleEnemies = new Array<Entity>();
   const visibleEnemyBuildings = new Array<Entity>();
   const visibleHostileMobs = new Array<Entity>();
   const visibleResources = new Array<Entity>();
   const visibleItemEntities = new Array<Entity>();
   for (let i = 0; i < aiHelperComponent.visibleEntities.length; i++) {
      const entity = aiHelperComponent.visibleEntities[i];

      if (!entityIsAccessible(tribesman, entity)) {
         continue;
      }

      switch (getTribeMemberRelationship(tribeComponent, entity)) {
         case EntityRelationship.enemy: {
            visibleEnemies.push(entity);
            break;
         }
         case EntityRelationship.enemyBuilding: {
            visibleEnemyBuildings.push(entity);
            break;
         }
         case EntityRelationship.hostileMob: {
            visibleHostileMobs.push(entity);
            break;
         }
         case EntityRelationship.resource: {
            visibleResources.push(entity);
            break;
         }
         case EntityRelationship.neutral: {
            if (entity.type === IEntityType.itemEntity) {
               visibleItemEntities.push(entity);
            }
            break;
         }
      }
   }

   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id);
   tribesmanComponent.targetResearchBenchID = ID_SENTINEL_VALUE;

   // As soon as the tribesman stops patrolling, clear the existing target patrol position.
   if (tribesmanComponent.currentAIType !== TribesmanAIType.patrolling) {
      tribesmanComponent.targetPatrolPositionX = -1;
   }

   // Escape from enemies when low on health
   const healthComponent = HealthComponentArray.getComponent(tribesman.id);
   if (shouldEscape(healthComponent) && (visibleEnemies.length > 0 || visibleHostileMobs.length > 0)) {
      escape(tribesman, visibleEnemies, visibleHostileMobs);

      if (tribesman.ageTicks % MESSAGE_INTERVAL_TICKS === 0) {
         const communicationTargets = getCommunicationTargets(tribesman);
         sendHelpMessage(tribesman, communicationTargets);
      }

      const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
      
      tribesmanComponent.currentAIType = TribesmanAIType.escaping;
      useInfo.currentAction = TribeMemberAction.none;
      return;
   }

   // @Speed
   // If the player is interacting with the tribesman, move towards the player
   for (const entity of aiHelperComponent.visibleEntities) {
      if (entity.type !== IEntityType.player) {
         continue;
      }

      const playerComponent = PlayerComponentArray.getComponent(entity.id);
      if (playerComponent.interactingEntityID === tribesman.id) {
         const physicsComponent = PhysicsComponentArray.getComponent(tribesman.id);
         physicsComponent.hitboxesAreDirty = true;

         tribesman.turn(tribesman.position.calculateAngleBetween(entity.position), TURN_SPEED);
         const distance = tribesman.position.calculateDistanceBetween(entity.position);
         if (willStopAtDesiredDistance(tribesman, 80, distance)) {
            tribesman.acceleration.x = 0;
            tribesman.acceleration.y = 0;
         } else {
            tribesman.acceleration.x = getAcceleration(tribesman) * Math.sin(tribesman.rotation);
            tribesman.acceleration.y = getAcceleration(tribesman) * Math.cos(tribesman.rotation);
         }

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
         
         tribesmanComponent.currentAIType = TribesmanAIType.idle;
         useInfo.currentAction = TribeMemberAction.none;
         return;
      }
   }
      
   // Attack enemies
   if (visibleEnemies.length > 0) {
      const target = getClosestAccessibleEntity(tribesman, visibleEnemies);
      tribesmanComponent.huntedEntityID = target.id;
      huntEntity(tribesman, target);

      if (tribesman.ageTicks % MESSAGE_INTERVAL_TICKS === 0) {
         const communcationTargets = getCommunicationTargets(tribesman);
         sendCallToArmsMessage(communcationTargets, target);
      }
      return;
   }

   // Continue hunting existing entity
   if (shouldEscape(healthComponent) || (tribesmanComponent.huntedEntityID !== ID_SENTINEL_VALUE && !Board.entityRecord.hasOwnProperty(tribesmanComponent.huntedEntityID))) {
      tribesmanComponent.huntedEntityID = ID_SENTINEL_VALUE;
   }
   if (tribesmanComponent.huntedEntityID !== ID_SENTINEL_VALUE) {
      const huntedEntity = Board.entityRecord[tribesmanComponent.huntedEntityID];
      
      const distance = calculateDistanceFromEntity(tribesman, huntedEntity);
      if (distance > getHuntingVisionRange(tribesman)) {
         tribesmanComponent.huntedEntityID = ID_SENTINEL_VALUE;
      } else {
         huntEntity(tribesman, huntedEntity);
      }
      return;
   }
   
   // Attack hostile mobs
   if (visibleHostileMobs.length > 0) {
      const target = getClosestAccessibleEntity(tribesman, visibleHostileMobs);
      huntEntity(tribesman, target);

      // @Cleanup: Copy and paste from hunting enemies section
      if (tribesman.ageTicks % MESSAGE_INTERVAL_TICKS === 0) {
         const communcationTargets = getCommunicationTargets(tribesman);
         sendCallToArmsMessage(communcationTargets, target);
      }
      return;
   }

   // Help other tribesmen
   if (tribesmanComponent.pathType === TribesmanPathType.tribesmanRequest) {
      continueCurrentPath(tribesman);
      tribesmanComponent.currentAIType = TribesmanAIType.assistingOtherTribesmen;

      const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
      useInfo.currentAction = TribeMemberAction.none;
      return;
   }
   
   // Attack enemy buildings
   if (visibleEnemyBuildings.length > 0) {
      huntEntity(tribesman, getClosestAccessibleEntity(tribesman, visibleEnemyBuildings));
      return;
   }

   // Heal when missing health
   if (healthComponent.health < healthComponent.maxHealth) {
      const foodItemSlot = getFoodItemSlot(tribesman);
      if (foodItemSlot !== null) {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
         useInfo.selectedItemSlot = foodItemSlot;

         // If the food is only just being eaten, reset the food timer so that the food isn't immediately eaten
         if (useInfo.currentAction !== TribeMemberAction.eat) {
            const foodItem = getItem(inventoryComponent, "hotbar", foodItemSlot)!;
            const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
            useInfo.foodEatingTimer = itemInfo.eatTime;
         }
         
         stopEntity(tribesman);
         
         useInfo.currentAction = TribeMemberAction.eat;
         tribesmanComponent.currentAIType = TribesmanAIType.eating;
         return;
      }
   }


   // @Incomplete: Doesn't work if hammer is in offhand
   const hammerItemSlot = getHammerItemSlot(hotbarInventory);
   if (hammerItemSlot !== 0) {
      // @Cleanup
      // @Cleanup
      // @Cleanup
      
      // 
      // Repair damaged buildings
      // 

      {
         let closestDamagedBuilding: Entity | undefined;
         let minDistance = Number.MAX_SAFE_INTEGER;
         for (const entity of aiHelperComponent.visibleEntities) {
            const relationship = getTribeMemberRelationship(tribeComponent, entity);
            if (relationship !== EntityRelationship.friendlyBuilding) {
               continue;
            }

            const healthComponent = HealthComponentArray.getComponent(entity.id);
            if (healthComponent.health === healthComponent.maxHealth) {
               continue;
            }
   
            const distance = tribesman.position.calculateDistanceBetween(entity.position);
            if (distance < minDistance) {
               closestDamagedBuilding = entity;
               minDistance = distance;
            }
         }

         if (typeof closestDamagedBuilding !== "undefined") {
            // Select the hammer item slot
            const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
            const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
            useInfo.selectedItemSlot = hammerItemSlot;
            useInfo.currentAction = TribeMemberAction.none;

            // @Cleanup: Copy and paste from huntEntity
            const distance = calculateDistanceFromEntity(tribesman, closestDamagedBuilding);
            if (willStopAtDesiredDistance(tribesman, DESIRED_MELEE_ATTACK_DISTANCE, distance)) {
               // If the tribesman will stop too close to the target, move back a bit
               if (willStopAtDesiredDistance(tribesman, DESIRED_MELEE_ATTACK_DISTANCE - 20, distance)) {
                  tribesman.acceleration.x = getSlowAcceleration(tribesman) * Math.sin(tribesman.rotation + Math.PI);
                  tribesman.acceleration.y = getSlowAcceleration(tribesman) * Math.cos(tribesman.rotation + Math.PI);
               } else {
                  stopEntity(tribesman);
               }

               const targetRotation = tribesman.position.calculateAngleBetween(closestDamagedBuilding.position);
               tribesman.turn(targetRotation, TURN_SPEED);
            
               // If in melee range, try to repair the building
               const targets = calculateRadialAttackTargets(tribesman, ATTACK_OFFSET, ATTACK_RADIUS);
               const repairTarget = calculateRepairTarget(tribesman, targets);
               if (repairTarget !== null) {
                  repairBuilding(tribesman, repairTarget, hammerItemSlot, "hotbar");
               }
            } else {
               pathfindToPosition(tribesman, closestDamagedBuilding.position.x, closestDamagedBuilding.position.y, closestDamagedBuilding.id, TribesmanPathType.default, DESIRED_MELEE_ATTACK_DISTANCE_NODES);
            }

            tribesmanComponent.currentAIType = TribesmanAIType.repairing;

            return;
         }
      }
      
      // 
      // Help work on blueprints
      // 
      
      // @Cleanup: Move messy logic out of main function
      // @Speed: Loops through all visible entities
      let closestBlueprint: Entity | undefined;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of aiHelperComponent.visibleEntities) {
         if (entity.type !== IEntityType.blueprintEntity) {
            continue;
         }

         const distance = tribesman.position.calculateDistanceBetween(entity.position);
         if (distance < minDistance) {
            closestBlueprint = entity;
            minDistance = distance;
         }
      }

      if (typeof closestBlueprint !== "undefined") {
         // Rotate to face the blueprint
         const direction = tribesman.position.calculateAngleBetween(closestBlueprint.position);
         if (direction !== tribesman.rotation) {
            tribesman.rotation = direction;

            const physicsComponent = PhysicsComponentArray.getComponent(tribesman.id);
            physicsComponent.hitboxesAreDirty = true;
         }

         // @Incomplete: use pathfinding
         // @Cleanup: Copy and pasted from huntEntity. Should be combined into its own function
         const distance = calculateDistanceFromEntity(tribesman, closestBlueprint);
         if (distance > 70) {
            // Move closer
            tribesman.acceleration.x = getAcceleration(tribesman) * Math.sin(direction);
            tribesman.acceleration.y = getAcceleration(tribesman) * Math.cos(direction);
         } else if (distance > 50) {
            // Stop at mid distance
            stopEntity(tribesman);
         } else {
            // Backpedal away from the entity if too close
            const backwards = direction + Math.PI;
            tribesman.acceleration.x = getAcceleration(tribesman) * Math.sin(backwards);
            tribesman.acceleration.y = getAcceleration(tribesman) * Math.cos(backwards);
         }

         // Select the hammer item slot
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
         useInfo.selectedItemSlot = hammerItemSlot;
         useInfo.currentAction = TribeMemberAction.none;

         // Find the target
         const targets = calculateRadialAttackTargets(tribesman, ATTACK_OFFSET, ATTACK_RADIUS);
         if (targets.includes(closestBlueprint)) {
            const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
            repairBuilding(tribesman, closestBlueprint, useInfo.selectedItemSlot, "hotbar");
         }
         
         return;
      }
   }

   // Pick up dropped items
   if (visibleItemEntities.length > 0) {
      let closestDroppedItem: Entity | undefined;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const itemEntity of visibleItemEntities) {
         // If the tribesman is within the escape health threshold, make sure there wouldn't be any enemies visible while picking up the dropped item
         if (shouldEscape(healthComponent) && !positionIsSafe(tribesman, itemEntity.position.x, itemEntity.position.y)) {
            continue;
         }

         if (!entityIsAccessible(tribesman, itemEntity)) {
            continue;
         }

         const distance = tribesman.position.calculateDistanceBetween(itemEntity.position);
         const itemComponent = ItemComponentArray.getComponent(itemEntity.id);
         if (distance < minDistance && tribeMemberCanPickUpItem(tribesman, itemComponent.itemType)) {
            closestDroppedItem = itemEntity;
            minDistance = distance;
         }
      }

      if (typeof closestDroppedItem !== "undefined") {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
         
         pathfindToPosition(tribesman, closestDroppedItem.position.x, closestDroppedItem.position.y, closestDroppedItem.id, TribesmanPathType.default, Math.floor(10 / PathfindingSettingsConst.NODE_SEPARATION));
         useInfo.currentAction = TribeMemberAction.none;
         
         return;
      }
   }

   // If full inventory, haul resources back to barrel
   if (inventoryIsFull(inventoryComponent, "hotbar")) {
      const closestBarrel = findNearestBarrel(tribesman);
      if (closestBarrel !== null) {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
         const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
         
         haulToBarrel(tribesman, closestBarrel);
         tribesmanComponent.currentAIType = TribesmanAIType.haulingResources;
         useInfo.currentAction = TribeMemberAction.none;
         return;
      }
   }

   // @Speed: shouldn't have to run for tribesmen which can't research
   if (tribeComponent.tribe.currentTechRequiresResearching() && tribesman.type === IEntityType.tribeWorker) {
      // Continue researching at an occupied bench
      const occupiedBenchID = getOccupiedResearchBenchID(tribesman, tribeComponent);
      if (occupiedBenchID !== ID_SENTINEL_VALUE) {
         const bench = Board.entityRecord[occupiedBenchID];
         
         continueResearching(bench, tribesman);
         moveEntityToPosition(tribesman, bench.position.x, bench.position.y, getSlowAcceleration(tribesman));
         tribesmanComponent.targetResearchBenchID = occupiedBenchID;
         
         return;
      }
      
      const benchID = getAvailableResearchBenchID(tribesman, tribeComponent);
      if (benchID !== ID_SENTINEL_VALUE) {
         const bench = Board.entityRecord[benchID];
         
         markPreemptiveMoveToBench(bench, tribesman);
         moveEntityToPosition(tribesman, bench.position.x, bench.position.y, getAcceleration(tribesman));
         tribesmanComponent.targetResearchBenchID = benchID;

         // If close enough, switch to doing research
         const dist = calculateDistanceFromEntity(tribesman, bench);
         if (dist < 50) {
            attemptToOccupyResearchBench(bench, tribesman);
         }

         return;
      }
   }

   // Attack closest resource
   if (visibleResources.length > 0) {
      // If the inventory is full, the resource should only be attacked if killing it produces an item that can be picked up
      let minDistance = Number.MAX_SAFE_INTEGER;
      let resourceToAttack: Entity | undefined;
      if (inventoryIsFull(inventoryComponent, "hotbar")) {
         for (const resource of visibleResources) {
            // If the tribesman is within the escape health threshold, make sure there wouldn't be any enemies visible while picking up the dropped item
            if (shouldEscape(healthComponent) && !positionIsSafe(tribesman, resource.position.x, resource.position.y)) {
               continue;
            }

            // Check if the resource produces an item type that can be picked up
            let producesPickupableItemType = false;
            if (RESOURCE_PRODUCTS.hasOwnProperty(resource.type)) {
               for (const itemType of RESOURCE_PRODUCTS[resource.type]!) {
                  if (tribeMemberCanPickUpItem(tribesman, itemType)) {
                     producesPickupableItemType = true;
                     break;
                  }
               }
            }
            if (producesPickupableItemType) {
               const dist = tribesman.position.calculateDistanceBetween(resource.position);
               if (dist < minDistance) {
                  resourceToAttack = resource;
                  minDistance = dist;
               }
            }
         }
      } else {
         for (const resource of visibleResources) {
            // If the tribesman is within the escape health threshold, make sure there wouldn't be any enemies visible while picking up the dropped item
            if (shouldEscape(healthComponent) && !positionIsSafe(tribesman, resource.position.x, resource.position.y)) {
               continue;
            }

            const dist = tribesman.position.calculateDistanceBetween(resource.position);
            if (dist < minDistance) {
               resourceToAttack = resource;
               minDistance = dist;
            }
         }
      }

      if (typeof resourceToAttack !== "undefined") {
         huntEntity(tribesman, resourceToAttack);
         return;
      }
   }

   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
   const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
   useInfo.currentAction = TribeMemberAction.none;

   // Grab food from barrel
   if (!hasFood(tribesman) && hasAvailableHotbarSlot(hotbarInventory)) {
      let closestBarrelWithFood: Entity | undefined;
      let minDist = Number.MAX_SAFE_INTEGER;
      for (const entity of aiHelperComponent.visibleEntities) {
         if (entity.type === IEntityType.barrel) {
            const distance = tribesman.position.calculateDistanceBetween(entity.position);
            if (distance < minDist && barrelHasFood(entity)) {
               minDist = distance;
               closestBarrelWithFood = entity;
            }
         }
      }
      if (typeof closestBarrelWithFood !== "undefined") {
         if (tribesman.position.calculateDistanceBetween(closestBarrelWithFood.position) > BARREL_INTERACT_DISTANCE) {
            pathfindToPosition(tribesman, closestBarrelWithFood.position.x, closestBarrelWithFood.position.y, closestBarrelWithFood.id, TribesmanPathType.default, Math.floor(BARREL_INTERACT_DISTANCE / PathfindingSettingsConst.NODE_SEPARATION));
         } else {
            grabBarrelFood(tribesman, closestBarrelWithFood);
            stopEntity(tribesman);
            clearPath(tribesman);
         }
         tribesmanComponent.currentAIType = TribesmanAIType.grabbingFood;
         return;
      }
   }

   // If nothing else to do, patrol tribe area
   if (tribesmanComponent.targetPatrolPositionX === -1 && Math.random() < 0.3 / SettingsConst.TPS) {
      // Filter tiles in tribe area
      const potentialTiles = tribeComponent.tribe.getArea();

      // Randomly look for a place to patrol to
      while (potentialTiles.length > 0) {
         const idx = randInt(0, potentialTiles.length - 1);
         const tile = potentialTiles[idx];
         
         const x = (tile.x + Math.random()) * SettingsConst.TILE_SIZE;
         const y = (tile.y + Math.random()) * SettingsConst.TILE_SIZE;

         if (positionIsAccessible(x, y, tribeComponent.tribe.friendlyTribesmenIDs, getRadius(tribesman))) {
            const didPathfind = pathfindToPosition(tribesman, x, y, ID_SENTINEL_VALUE, TribesmanPathType.default, 0);
            if (didPathfind) {
               // Patrol to that position
               tribesmanComponent.targetPatrolPositionX = x;
               tribesmanComponent.targetPatrolPositionY = y;
               tribesmanComponent.currentAIType = TribesmanAIType.patrolling;
               return;
            }
         }

         potentialTiles.splice(idx, 1);
      }
      return;
   } else if (tribesmanComponent.targetPatrolPositionX !== -1) {
      const isPathfinding = continueCurrentPath(tribesman);

      // reset target patrol position when not patrolling
      
      if (!isPathfinding) {
         stopEntity(tribesman);

         tribesmanComponent.currentAIType = TribesmanAIType.idle;
         tribesmanComponent.targetPatrolPositionX = -1
         clearPath(tribesman);
         return;
      }
      
      tribesmanComponent.currentAIType = TribesmanAIType.patrolling;
      return;
   }

   // If all else fails, don't do anything
   stopEntity(tribesman);
   tribesmanComponent.currentAIType = TribesmanAIType.idle;
   clearPath(tribesman);
}

const escape = (tribesman: Entity, visibleEnemies: ReadonlyArray<Entity>, visibleHostileMobs: ReadonlyArray<Entity>): void => {
   // Calculate the escape position based on the position of all visible enemies
   let averageEnemyX = 0;
   let averageEnemyY = 0;
   for (let i = 0; i < visibleEnemies.length; i++) {
      const enemy = visibleEnemies[i];

      let distance = tribesman.position.calculateDistanceBetween(enemy.position);
      if (distance > getTribesmanVisionRange(tribesman)) {
         distance = getTribesmanVisionRange(tribesman);
      }
      const weight = Math.pow(1 - distance / getTribesmanVisionRange(tribesman) / 1.25, 0.5);

      const relativeX = (enemy.position.x - tribesman.position.x) * weight;
      const relativeY = (enemy.position.y - tribesman.position.y) * weight;

      averageEnemyX += relativeX + tribesman.position.x;
      averageEnemyY += relativeY + tribesman.position.y;
      // @Temporary: shouldn't occur, fix root cause
      if (isNaN(averageEnemyX) || isNaN(averageEnemyY)) {
         console.warn("NaN!");
         return;
      }
   }
   // @Cleanup: Copy and paste
   for (let i = 0; i < visibleHostileMobs.length; i++) {
      const enemy = visibleHostileMobs[i];

      let distance = tribesman.position.calculateDistanceBetween(enemy.position);
      if (distance > getTribesmanVisionRange(tribesman)) {
         distance = getTribesmanVisionRange(tribesman);
      }
      const weight = Math.pow(1 - distance / getTribesmanVisionRange(tribesman) / 1.25, 0.5);

      const relativeX = (enemy.position.x - tribesman.position.x) * weight;
      const relativeY = (enemy.position.y - tribesman.position.y) * weight;

      averageEnemyX += relativeX + tribesman.position.x;
      averageEnemyY += relativeY + tribesman.position.y;
      // @Temporary: shouldn't occur, fix root cause
      if (isNaN(averageEnemyX) || isNaN(averageEnemyY)) {
         console.warn("NaN!");
         return;
      }
   }
   averageEnemyX /= visibleEnemies.length + visibleHostileMobs.length;
   averageEnemyY /= visibleEnemies.length + visibleHostileMobs.length;

   // Run away from that position
   const runDirection = angle(averageEnemyX - tribesman.position.x, averageEnemyY - tribesman.position.y) + Math.PI;
   tribesman.turn(runDirection, TURN_SPEED);
   tribesman.acceleration.x = getAcceleration(tribesman) * Math.sin(runDirection);
   tribesman.acceleration.y = getAcceleration(tribesman) * Math.cos(runDirection);
}

// @Cleanup: Copy and paste

const getBestWeaponSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   let bestWeaponLevel = -1;
   let bestWeaponItemSlot = -1;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "sword" || itemCategory === "bow") {
         if ((itemInfo as ToolItemInfo).level > bestWeaponLevel) {
            bestWeaponLevel = (itemInfo as ToolItemInfo).level;
            bestWeaponItemSlot = itemSlot;
         }
      }
   }

   if (bestWeaponItemSlot !== -1) {
      return bestWeaponItemSlot;
   }
   return null;
}

const getBestPickaxeSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   let bestPickaxeLevel = -1;
   let bestPickaxeItemSlot = -1;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "pickaxe") {
         if ((itemInfo as ToolItemInfo).level > bestPickaxeLevel) {
            bestPickaxeLevel = (itemInfo as ToolItemInfo).level;
            bestPickaxeItemSlot = itemSlot;
         }
      }
   }

   if (bestPickaxeItemSlot !== -1) {
      return bestPickaxeItemSlot;
   }
   return null;
}

const getBestAxeSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   let bestAxeLevel = -1;
   let bestAxeItemSlot = -1;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "axe") {
         if ((itemInfo as ToolItemInfo).level > bestAxeLevel) {
            bestAxeLevel = (itemInfo as ToolItemInfo).level;
            bestAxeItemSlot = itemSlot;
         }
      }
   }

   if (bestAxeItemSlot !== -1) {
      return bestAxeItemSlot;
   }
   return null;
}

const calculateDistanceFromEntity = (tribesman: Entity, entity: Entity): number => {
   const tribesmanRadius = getRadius(tribesman);
   
   let minDistance = tribesman.position.calculateDistanceBetween(entity.position);
   for (const hitbox of entity.hitboxes) {
      if (hitbox.hasOwnProperty("radius")) {
         const rawDistance = distance(tribesman.position.x, tribesman.position.y, hitbox.object.position.x + hitbox.rotatedOffsetX, hitbox.object.position.y + hitbox.rotatedOffsetY);
         const hitboxDistance = rawDistance - tribesmanRadius - (hitbox as CircularHitbox).radius;
         if (hitboxDistance < minDistance) {
            minDistance = hitboxDistance;
         }
      } else {
         // @Incomplete: Rectangular hitbox dist
         let dist = distBetweenPointAndRectangle(tribesman.position.x, tribesman.position.y, hitbox.object.position.x + hitbox.rotatedOffsetX, hitbox.object.position.y + hitbox.rotatedOffsetY, (hitbox as RectangularHitbox).width, (hitbox as RectangularHitbox).height, (hitbox as RectangularHitbox).rotation);
         dist -= tribesmanRadius;
         if (dist < minDistance) {
            minDistance = dist;
         }
      }
   }
   return minDistance;
}

const engageTargetRanged = (tribesman: Entity, target: Entity): void => {
   const distance = calculateDistanceFromEntity(tribesman, target);
   tribesman.rotation = tribesman.position.calculateAngleBetween(target.position);
   if (willStopAtDesiredDistance(tribesman, DESIRED_RANGED_ATTACK_DISTANCE, distance)) {
      tribesman.acceleration.x = getSlowAcceleration(tribesman) * Math.sin(tribesman.rotation + Math.PI);
      tribesman.acceleration.y = getSlowAcceleration(tribesman) * Math.cos(tribesman.rotation + Math.PI);
   } else {
      tribesman.acceleration.x = getSlowAcceleration(tribesman) * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = getSlowAcceleration(tribesman) * Math.cos(tribesman.rotation);
   }

   // @Speed: Shouldn't do always
   const physicsComponent = PhysicsComponentArray.getComponent(tribesman.id);
   physicsComponent.hitboxesAreDirty = true;
}

const doMeleeAttack = (tribesman: Entity): void => {
   // Find the attack target
   const attackTargets = calculateRadialAttackTargets(tribesman, ATTACK_OFFSET, ATTACK_RADIUS);
   const target = calculateAttackTarget(tribesman, attackTargets, ~(EntityRelationship.friendly | EntityRelationship.friendlyBuilding));

   // Register the hit
   if (target !== null) {
      const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
      attackEntity(tribesman, target, useInfo.selectedItemSlot, "hotbar");
   }
}

const getMostDamagingItemSlot = (tribesman: Entity, huntedEntity: Entity): number => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   // @Incomplete: Account for status effects
   
   let bestItemSlot = 1;
   let mostDps = 0;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         if (mostDps < 1 / SettingsConst.DEFAULT_ATTACK_COOLDOWN) {
            mostDps = 1 / SettingsConst.DEFAULT_ATTACK_COOLDOWN;
            bestItemSlot = itemSlot;
         }
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];

      const attackCooldown = getItemAttackCooldown(item);
      const damage = calculateItemDamage(item, huntedEntity);
      const dps = damage / attackCooldown;

      if (dps > mostDps) {
         mostDps = dps;
         bestItemSlot = itemSlot;
      }
   }

   return bestItemSlot;
}

const huntEntity = (tribesman: Entity, huntedEntity: Entity): void => {
   // @Speed: So much logic! Does it need to be this complicated?
   
   // @Incomplete: Only accounts for hotbar
   
   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id);
   tribesmanComponent.currentAIType = TribesmanAIType.attacking;
   
   const mostDamagingItemSlot = getMostDamagingItemSlot(tribesman, huntedEntity);

   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman.id);
   const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
   
   // Select the item slot
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman.id);
   useInfo.selectedItemSlot = mostDamagingItemSlot;
   
   const inventory = getInventory(inventoryComponent, "hotbar");
   if (inventoryHasItemInSlot(inventory, mostDamagingItemSlot)) {
      const selectedItem = getItem(inventoryComponent, "hotbar", useInfo.selectedItemSlot)!;
      const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];

      // Throw spears if there is multiple
      if (weaponCategory === "spear" && selectedItem.count > 1) {
         // Rotate to face the target
         const direction = tribesman.position.calculateAngleBetween(huntedEntity.position);
         if (direction !== tribesman.rotation) {
            tribesman.rotation = direction;

            const physicsComponent = PhysicsComponentArray.getComponent(tribesman.id);
            physicsComponent.hitboxesAreDirty = true;
         }

         const distance = calculateDistanceFromEntity(tribesman, huntedEntity);
         if (distance > 250) {
            // Move closer
            tribesman.acceleration.x = getSlowAcceleration(tribesman) * Math.sin(direction);
            tribesman.acceleration.y = getSlowAcceleration(tribesman) * Math.cos(direction);
         } else if (distance > 150) {
            stopEntity(tribesman);
         } else {
            // Backpedal away from the entity if too close
            const backwards = direction + Math.PI;
            tribesman.acceleration.x = getSlowAcceleration(tribesman) * Math.sin(backwards);
            tribesman.acceleration.y = getSlowAcceleration(tribesman) * Math.cos(backwards);
         }
         
         const ticksSinceLastAction = Board.ticks - useInfo.lastSpearChargeTicks;
         if (ticksSinceLastAction >= 3 * SettingsConst.TPS) {
            // Throw spear
            useItem(tribesman, selectedItem, "hotbar", useInfo.selectedItemSlot);
            useInfo.currentAction = TribeMemberAction.none;
         } else {
            // Charge spear
            useInfo.currentAction = TribeMemberAction.chargeSpear;
         }
         return;
      }
      
      // Don't do a melee attack if using a bow, instead charge the bow
      if (weaponCategory === "bow") {
         // If the tribesman is only just charging the bow, reset the cooldown to prevent the bow firing immediately
         if (useInfo.currentAction !== TribeMemberAction.chargeBow) {
            const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as BowItemInfo;
            useInfo.bowCooldownTicks = itemInfo.shotCooldownTicks;
         }
         useInfo.currentAction = TribeMemberAction.chargeBow;
         
         engageTargetRanged(tribesman, huntedEntity);

         // If the bow is fully charged, fire it
         if (useInfo.bowCooldownTicks === 0) {
            useItem(tribesman, selectedItem, "hotbar", useInfo.selectedItemSlot);
         }

         return;
      }
   }

   const distance = calculateDistanceFromEntity(tribesman, huntedEntity);
   if (willStopAtDesiredDistance(tribesman, DESIRED_MELEE_ATTACK_DISTANCE, distance)) {
      // If the tribesman will stop too close to the target, move back a bit
      if (willStopAtDesiredDistance(tribesman, DESIRED_MELEE_ATTACK_DISTANCE - 20, distance)) {
         tribesman.acceleration.x = getSlowAcceleration(tribesman) * Math.sin(tribesman.rotation + Math.PI);
         tribesman.acceleration.y = getSlowAcceleration(tribesman) * Math.cos(tribesman.rotation + Math.PI);
      } else {
         stopEntity(tribesman);
      }

      const targetRotation = tribesman.position.calculateAngleBetween(huntedEntity.position);
      tribesman.turn(targetRotation, TURN_SPEED);
   
      // If in melee range, try to do a melee attack
      doMeleeAttack(tribesman);

      clearPath(tribesman);
   } else {
      pathfindToPosition(tribesman, huntedEntity.position.x, huntedEntity.position.y, huntedEntity.id, TribesmanPathType.default, 0);
   }

   useInfo.currentAction = TribeMemberAction.none;
}