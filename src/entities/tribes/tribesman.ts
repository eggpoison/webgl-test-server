import { ArmourItemInfo, BowItemInfo, COLLISION_BITS, DEFAULT_COLLISION_MASK, FoodItemInfo, IEntityType, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, ItemType, Point, SETTINGS, TRIBE_INFO_RECORD, ToolItemInfo, TribeMemberAction, TribeType, angle, distance, randItem } from "webgl-test-shared";
import Entity from "../../GameObject";
import Tribe from "../../Tribe";
import { AIHelperComponentArray, HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, PlayerComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray, TribesmanComponentArray } from "../../components/ComponentArray";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { Inventory, InventoryComponent, addItemToInventory, addItemToSlot, consumeItem, createNewInventory, getInventory, getItem, inventoryIsFull, pickupItemEntity, removeItemFromInventory } from "../../components/InventoryComponent";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { AttackToolType, EntityRelationship, attackEntity, calculateAttackTarget, calculateRadialAttackTargets, getEntityAttackToolType, getTribeMemberRelationship, tickTribeMember, tribeMemberCanPickUpItem, useItem } from "./tribe-member";
import { getClosestEntity, getEntitiesInVisionRange, getPositionRadialTiles, stopEntity, willStopAtDesiredDistance } from "../../ai-shared";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";
import { TribesmanComponent } from "../../components/TribesmanComponent";
import Board from "../../Board";
import Item from "../../items/Item";
import Tile from "../../Tile";
import { AIHelperComponent, calculateVisibleEntities, updateAIHelperComponent } from "../../components/AIHelperComponent";

const RADIUS = 28;
const INVENTORY_SIZE = 3;
const VISION_RANGE = 320;

const SLOW_ACCELERATION = 200;
const ACCELERATION = 400;

/** How far away from the entity the attack is done */
const ATTACK_OFFSET = 50;
/** Max distance from the attack position that the attack will be registered from */
const ATTACK_RADIUS = 50;

/** How far the tribesmen will try to stay away from the entity they're attacking */
const DESIRED_MELEE_ATTACK_DISTANCE = 60;
const DESIRED_RANGED_ATTACK_DISTANCE = 260;

const BARREL_INTERACT_DISTANCE = 80;

const RESOURCE_PRODUCTS: Partial<Record<IEntityType, ReadonlyArray<ItemType>>> = {
   [IEntityType.cow]: [ItemType.leather, ItemType.raw_beef],
   [IEntityType.berryBush]: [ItemType.berry],
   [IEntityType.tree]: [ItemType.wood],
   [IEntityType.iceSpikes]: [ItemType.frostcicle],
   [IEntityType.cactus]: [ItemType.cactus_spine],
   [IEntityType.boulder]: [ItemType.rock],
   [IEntityType.krumblid]: [ItemType.leather]
}

export enum TribesmanAIType {
   escaping,
   attacking,
   harvestingResources,
   pickingUpDroppedItems,
   haulingResources,
   grabbingFood,
   patrolling,
   idle
}

export function createTribesman(position: Point, tribeType: TribeType, tribe: Tribe, hutID: number): Entity {
   const tribesman = new Entity(position, IEntityType.tribesman, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(tribesman, 0, 0, RADIUS);
   tribesman.addHitbox(hitbox);
   
   const tribeInfo = TRIBE_INFO_RECORD[tribeType];
   HealthComponentArray.addComponent(tribesman, new HealthComponent(tribeInfo.maxHealthWorker));
   StatusEffectComponentArray.addComponent(tribesman, new StatusEffectComponent());

   TribeComponentArray.addComponent(tribesman, {
      tribeType: tribeType,
      tribe: tribe
   });
   TribeMemberComponentArray.addComponent(tribesman, new TribeMemberComponent(tribeType));
   TribesmanComponentArray.addComponent(tribesman, new TribesmanComponent(hutID));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(tribesman, inventoryComponent);
   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", INVENTORY_SIZE, 1, true);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);

   InventoryUseComponentArray.addComponent(tribesman, new InventoryUseComponent(hotbarInventory));
   AIHelperComponentArray.addComponent(tribesman, new AIHelperComponent());

   // If the tribesman is a frostling, spawn with a bow
   // @Temporary: Remove once tribe rework is done
   if (tribeType === TribeType.frostlings) {
      addItemToSlot(inventoryComponent, "hotbar", 1, ItemType.wooden_bow, 1);
   }
   
   return tribesman;
}

const getFoodItemSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
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
   const visibleEntitiesFromItem = getEntitiesInVisionRange(x, y, VISION_RANGE);
   for (const entity of visibleEntitiesFromItem) {
      const relationship = getTribeMemberRelationship(tribesman, entity);
      if (relationship >= EntityRelationship.hostileMob) {
         return false;
      }
   }
   return true;
}

const findNearestBarrel = (tribesman: Entity): Entity | null => {
   const tribeComponent = TribeComponentArray.getComponent(tribesman);
   if (tribeComponent.tribe === null) return null;
   
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
   const tribesmanInventoryComponent = InventoryComponentArray.getComponent(tribesman);
   const barrelInventoryComponent = InventoryComponentArray.getComponent(barrel);
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
      
      if (itemSlot === bestWeaponItemSlot || itemSlot === bestAxeItemSlot || itemSlot === bestPickaxeItemSlot || itemSlot === bestArmourItemSlot || itemSlot === firstFoodItemSlot) {
         continue;
      }
      
      // Add the item to the barrel inventory and remove from tribesman inventory
      const amountAdded = addItemToInventory(barrelInventoryComponent, "inventory", item.type, item.count);
      consumeItem(tribesmanInventoryComponent, "hotbar", itemSlot, amountAdded);
   }
}

const haulToBarrel = (tribesman: Entity, barrel: Entity): void => {
   tribesman.rotation = tribesman.position.calculateAngleBetween(barrel.position);
   tribesman.hitboxesAreDirty = true;
   tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
   tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);

   if (tribesman.position.calculateDistanceBetween(barrel.position) <= BARREL_INTERACT_DISTANCE) {
      depositResources(tribesman, barrel);
   }
}

const hasFood = (tribesman: Entity): boolean => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
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

   const barrelInventoryComponent = InventoryComponentArray.getComponent(barrel);
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

   const tribesmanInventoryComponent = InventoryComponentArray.getComponent(tribesman);
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
   const inventoryComponent = InventoryComponentArray.getComponent(barrel);
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

// @Cleanup: This function is extremely similar to the regular hasReachedPosition function
const hasReachedPatrolPosition = (tribesman: Entity, tribesmanComponent: TribesmanComponent): boolean => {
   if (tribesmanComponent.targetPatrolPositionX === -1 || (tribesman.velocity.x === 0 && tribesman.velocity.x === 0)) return false;

   // @Speed
   const relativeTargetPosition = tribesman.position.copy();
   relativeTargetPosition.subtract(new Point(tribesmanComponent.targetPatrolPositionX, tribesmanComponent.targetPatrolPositionY));

   const dotProduct = tribesman.velocity.calculateDotProduct(relativeTargetPosition);
   return dotProduct > 0;
}

export function tickTribesman(tribesman: Entity): void {
   // @Cleanup: This is an absolutely massive function
   
   tickTribeMember(tribesman);
   
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);

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

   const aiHelperComponent = AIHelperComponentArray.getComponent(tribesman);
   updateAIHelperComponent(tribesman, VISION_RANGE);
   const visibleEntities = calculateVisibleEntities(tribesman, aiHelperComponent, VISION_RANGE);

   // @Cleanup: A nicer way to do this might be to sort the visible entities array based on the 'threat level' of each entity

   // Categorise visible entities
   const visibleEnemies = new Array<Entity>();
   const visibleEnemyBuildings = new Array<Entity>();
   const visibleHostileMobs = new Array<Entity>();
   const visibleResources = new Array<Entity>();
   const visibleItemEntities = new Array<Entity>();
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];

      switch (getTribeMemberRelationship(tribesman, entity)) {
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

   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman);

   // Escape from enemies when low on health
   const healthComponent = HealthComponentArray.getComponent(tribesman);
   if (shouldEscape(healthComponent) && visibleEnemies.length > 0) {
      escape(tribesman, visibleEnemies);

      const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
      
      tribesmanComponent.lastAIType = TribesmanAIType.escaping;
      inventoryUseComponent.currentAction = TribeMemberAction.none;
      return;
   }

   // If the player is interacting with the tribesman, move towards the player
   for (const entity of visibleEntities) {
      if (entity.type !== IEntityType.player) {
         continue;
      }

      const playerComponent = PlayerComponentArray.getComponent(entity);
      if (playerComponent.interactingEntityID === tribesman.id) {
         tribesman.rotation = tribesman.position.calculateAngleBetween(entity.position);
         tribesman.hitboxesAreDirty = true;
         const distance = tribesman.position.calculateDistanceBetween(entity.position);
         if (willStopAtDesiredDistance(tribesman, 80, distance)) {
            tribesman.acceleration.x = 0;
            tribesman.acceleration.y = 0;
         } else {
            tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
            tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);
         }

         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
         
         tribesmanComponent.lastAIType = TribesmanAIType.idle;
         inventoryUseComponent.currentAction = TribeMemberAction.none;
         return;
      }
   }
      
   // Attack enemies
   if (visibleEnemies.length > 0) {
      huntEntity(tribesman, getClosestEntity(tribesman, visibleEnemies));
      tribesmanComponent.lastAIType = TribesmanAIType.attacking;
      return;
   }
   
   // Attack enemy buildings
   if (visibleEnemyBuildings.length > 0) {
      huntEntity(tribesman, getClosestEntity(tribesman, visibleEnemyBuildings));
      tribesmanComponent.lastAIType = TribesmanAIType.attacking;
      return;
   }
   
   // Attack hostile mobs
   if (visibleHostileMobs.length > 0) {
      huntEntity(tribesman, getClosestEntity(tribesman, visibleHostileMobs));
      tribesmanComponent.lastAIType = TribesmanAIType.attacking;
      return;
   }

   // Heal when missing health
   if (healthComponent.health < healthComponent.maxHealth) {
      const foodItemSlot = getFoodItemSlot(tribesman);
      if (foodItemSlot !== null) {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
         inventoryUseComponent.selectedItemSlot = foodItemSlot;

         // If the food is only just being eaten, reset the food timer so that the food isn't immediately eaten
         if (inventoryUseComponent.currentAction !== TribeMemberAction.eat) {
            const foodItem = getItem(inventoryComponent, "hotbar", foodItemSlot)!;
            const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
            inventoryUseComponent.foodEatingTimer = itemInfo.eatTime;
         }
         
         tribesman.acceleration.x = 0;
         tribesman.acceleration.y = 0;
         inventoryUseComponent.currentAction = TribeMemberAction.eat;
         return;
      }
   }

   // If any tribe members need reinforcements, attack the requested target
   const tribeComponent = TribeComponentArray.getComponent(tribesman);
   if (tribeComponent.tribe !== null && tribeComponent.tribe.reinforcementInfoArray.length > 0) {
      let closestTarget!: Entity;
      let minDist = Number.MAX_SAFE_INTEGER;
      for (const reinforcementInfo of tribeComponent.tribe.reinforcementInfoArray) {
         const distance = tribesman.position.calculateDistanceBetween(reinforcementInfo.targetEntity.position);
         if (distance < minDist) {
            closestTarget = reinforcementInfo.targetEntity;
            minDist = distance;
         }
      }

      huntEntity(tribesman, closestTarget);

      tribesmanComponent.lastAIType = TribesmanAIType.attacking;
      return;
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

         const distance = tribesman.position.calculateDistanceBetween(itemEntity.position);
         const itemComponent = ItemComponentArray.getComponent(itemEntity);
         if (distance < minDistance && tribeMemberCanPickUpItem(tribesman, itemComponent.itemType)) {
            closestDroppedItem = itemEntity;
            minDistance = distance;
         }
      }

      if (typeof closestDroppedItem !== "undefined") {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
         
         tribesman.rotation = tribesman.position.calculateAngleBetween(closestDroppedItem.position);
         tribesman.hitboxesAreDirty = true;
         tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
         tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);
         tribesmanComponent.lastAIType = TribesmanAIType.pickingUpDroppedItems;
         inventoryUseComponent.currentAction = TribeMemberAction.none;
         return;
      }
   }

   // If full inventory, haul resources back to barrel
   if (inventoryIsFull(inventoryComponent, "hotbar")) {
      const closestBarrel = findNearestBarrel(tribesman);
      if (closestBarrel !== null) {
         const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
         
         haulToBarrel(tribesman, closestBarrel);
         tribesmanComponent.lastAIType = TribesmanAIType.haulingResources;
         inventoryUseComponent.currentAction = TribeMemberAction.none;
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
      }
      return;
   }

   // Grab food from barrel
   if (!hasFood(tribesman) && hasAvailableHotbarSlot(hotbarInventory)) {
      let closestBarrelWithFood: Entity | undefined;
      let minDist = Number.MAX_SAFE_INTEGER;
      for (const entity of visibleEntities) {
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
            // Move to barrel
            const direction = tribesman.position.calculateAngleBetween(closestBarrelWithFood.position);
            tribesman.acceleration.x = ACCELERATION * Math.sin(direction);
            tribesman.acceleration.y = ACCELERATION * Math.cos(direction);
            tribesman.rotation = direction;
            tribesman.hitboxesAreDirty = true;
         } else {
            grabBarrelFood(tribesman, closestBarrelWithFood);
            tribesman.acceleration.x = 0;
            tribesman.acceleration.y = 0;
         }
         tribesmanComponent.lastAIType = TribesmanAIType.grabbingFood;
         return;
      }
   }

   if (tribeComponent.tribe === null) {
      // @Incomplete
      return;
   }

   // If nothing else to do, patrol tribe area
   if (tribesmanComponent.targetPatrolPositionX === -1 && Math.random() < 0.3 / SETTINGS.TPS) {
      const tileTargets = getPositionRadialTiles(tribesman.position, VISION_RANGE);
      if (tileTargets.length > 0) {
         // Filter tiles in tribe area
         const tilesInTribeArea = new Array<Tile>();
         for (const tile of tileTargets) {
            if (tribeComponent.tribe.tileIsInArea(tile.x, tile.y)) {
               tilesInTribeArea.push(tile);
            }
         }

         let targetTile: Tile;
         if (tilesInTribeArea.length > 0) {
            // Move to random tribe tile
            targetTile = randItem(tilesInTribeArea);
         } else {
            // Move to any random tile
            targetTile = randItem(tileTargets);
         }

         tribesmanComponent.targetPatrolPositionX = (targetTile.x + Math.random()) * SETTINGS.TILE_SIZE;
         tribesmanComponent.targetPatrolPositionY = (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE;
         // @Speed
         tribesman.rotation = tribesman.position.calculateAngleBetween(new Point(tribesmanComponent.targetPatrolPositionX, tribesmanComponent.targetPatrolPositionY));
         tribesman.hitboxesAreDirty = true;
         tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
         tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);

         tribesmanComponent.lastAIType = TribesmanAIType.patrolling;
         return;
      }
   } else if (tribesmanComponent.targetPatrolPositionX !== -1) {
      if (hasReachedPatrolPosition(tribesman, tribesmanComponent)) {
         stopEntity(tribesman);

         tribesmanComponent.lastAIType = TribesmanAIType.idle;
         tribesmanComponent.targetPatrolPositionX = -1
         return;
      }
      
      // Move to patrol position
      // @Speed
      tribesman.rotation = tribesman.position.calculateAngleBetween(new Point(tribesmanComponent.targetPatrolPositionX, tribesmanComponent.targetPatrolPositionY));
      tribesman.hitboxesAreDirty = true;
      tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);

      tribesmanComponent.lastAIType = TribesmanAIType.patrolling;
      return;
   }

   // If all else fails, don't do anything
   stopEntity(tribesman);

   tribesmanComponent.lastAIType = TribesmanAIType.idle;
}

const escape = (tribesman: Entity, visibleEnemies: ReadonlyArray<Entity>): void => {
   // Calculate the escape position based on the position of all visible enemies
   let averageEnemyX = 0;
   let averageEnemyY = 0;
   for (let i = 0; i < visibleEnemies.length; i++) {
      const enemy = visibleEnemies[i];

      let distance = tribesman.position.calculateDistanceBetween(enemy.position);
      if (distance > VISION_RANGE) {
         distance = VISION_RANGE;
      }
      const weight = Math.pow(1 - distance / VISION_RANGE / 1.25, 0.5);

      const relativeX = (enemy.position.x - tribesman.position.x) * weight;
      const relativeY = (enemy.position.y - tribesman.position.y) * weight;

      averageEnemyX += relativeX + tribesman.position.x;
      averageEnemyY += relativeY + tribesman.position.y;
      if (isNaN(averageEnemyX) || isNaN(averageEnemyY)) {
         console.warn("NaN!");
         return;
      }
   }
   averageEnemyX /= visibleEnemies.length;
   averageEnemyY /= visibleEnemies.length;

   // Run away from that position
   const runDirection = angle(averageEnemyX - tribesman.position.x, averageEnemyY - tribesman.position.y) + Math.PI;
   tribesman.rotation = runDirection;
   tribesman.hitboxesAreDirty = true;
   tribesman.acceleration.x = ACCELERATION * Math.sin(runDirection);
   tribesman.acceleration.y = ACCELERATION * Math.cos(runDirection);
}

// @Cleanup: Copy and paste

const getBestWeaponSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
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
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
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
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
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
   let minDistance = tribesman.position.calculateDistanceBetween(entity.position);
   for (const hitbox of entity.hitboxes) {
      if (hitbox.hasOwnProperty("radius")) {
         const rawDistance = distance(tribesman.position.x, tribesman.position.y, hitbox.object.position.x + hitbox.offset.x, hitbox.object.position.y + hitbox.offset.y);
         const hitboxDistance = rawDistance - RADIUS - (hitbox as CircularHitbox).radius;
         if (hitboxDistance < minDistance) {
            minDistance = hitboxDistance;
         }
      } else {
         // @Incomplete: Rectangular hitbox dist
      }
   }
   return minDistance;
}

const engageTargetRanged = (tribesman: Entity, target: Entity): void => {
   const distance = calculateDistanceFromEntity(tribesman, target);
   tribesman.rotation = tribesman.position.calculateAngleBetween(target.position);
   tribesman.hitboxesAreDirty = true;
   if (willStopAtDesiredDistance(tribesman, DESIRED_RANGED_ATTACK_DISTANCE, distance)) {
      tribesman.acceleration.x = SLOW_ACCELERATION * Math.sin(tribesman.rotation + Math.PI);
      tribesman.acceleration.y = SLOW_ACCELERATION * Math.cos(tribesman.rotation + Math.PI);
   } else {
      tribesman.acceleration.x = SLOW_ACCELERATION * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = SLOW_ACCELERATION * Math.cos(tribesman.rotation);
   }
}

const engageTargetMelee = (tribesman: Entity, target: Entity): void => {
   const distance = calculateDistanceFromEntity(tribesman, target);
   tribesman.rotation = tribesman.position.calculateAngleBetween(target.position);
   tribesman.hitboxesAreDirty = true;
   if (willStopAtDesiredDistance(tribesman, DESIRED_MELEE_ATTACK_DISTANCE, distance)) {
      tribesman.acceleration.x = SLOW_ACCELERATION * Math.sin(tribesman.rotation + Math.PI);
      tribesman.acceleration.y = SLOW_ACCELERATION * Math.cos(tribesman.rotation + Math.PI);
   } else {
      tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);
   }
}

const doMeleeAttack = (tribesman: Entity): void => {
   // Find the attack target
   const attackTargets = calculateRadialAttackTargets(tribesman, ATTACK_OFFSET, ATTACK_RADIUS);
   const target = calculateAttackTarget(tribesman, attackTargets);

   // Register the hit
   if (target !== null) {
      const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
      attackEntity(tribesman, target, inventoryUseComponent.selectedItemSlot);
   }
}

const huntEntity = (tribesman: Entity, huntedEntity: Entity): void => {
   // Find the best tool for the job
   let bestToolSlot: number | null = null;
   const attackToolType = getEntityAttackToolType(huntedEntity);
   switch (attackToolType) {
      case AttackToolType.weapon: {
         bestToolSlot = getBestWeaponSlot(tribesman);
         if (bestToolSlot === null) {
            bestToolSlot = getBestPickaxeSlot(tribesman);
            if (bestToolSlot === null) {
               bestToolSlot = getBestAxeSlot(tribesman);
            }
         }
         break;
      }
      case AttackToolType.pickaxe: {
         bestToolSlot = getBestPickaxeSlot(tribesman);
         break;
      }
      case AttackToolType.axe: {
         bestToolSlot = getBestAxeSlot(tribesman);
         break;
      }
   }

   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);

   if (bestToolSlot !== null) {
      const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
      
      inventoryUseComponent.selectedItemSlot = bestToolSlot;

      // Don't do a melee attack if using a bow, instead charge the bow
      const selectedItem = getItem(inventoryComponent, "hotbar", inventoryUseComponent.selectedItemSlot)!;
      const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];
      if (weaponCategory === "bow") {
         // If the tribesman is only just charging the bow, reset the cooldown to prevent the bow firing immediately
         if (inventoryUseComponent.currentAction !== TribeMemberAction.charge_bow) {
            const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as BowItemInfo;
            inventoryUseComponent.bowCooldownTicks = itemInfo.shotCooldownTicks;
         }
         inventoryUseComponent.currentAction = TribeMemberAction.charge_bow;
         
         engageTargetRanged(tribesman, huntedEntity);

         // If the bow is fully charged, fire it
         if (inventoryUseComponent.bowCooldownTicks === 0) {
            useItem(tribesman, selectedItem, inventoryUseComponent.selectedItemSlot);
         }

         return;
      }
   }

   // If a melee attack is being done, update to attack at melee distance
   engageTargetMelee(tribesman, huntedEntity);

   inventoryUseComponent.currentAction = TribeMemberAction.none;
   
   doMeleeAttack(tribesman);
}

export function onTribesmanCollision(player: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      pickupItemEntity(player, collidingEntity);
   }
}

export function onTribesmanDeath(tribesman: Entity): void {
   // Attempt to respawn the tribesman when it is killed
   // Only respawn the tribesman if their hut is alive
   const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman);
   if (!Board.entityRecord.hasOwnProperty(tribesmanComponent.hutID)) {
      return;
   }
   
   const hut = Board.entityRecord[tribesmanComponent.hutID];
   if (!hut.isRemoved) {
      const tribeComponent = TribeComponentArray.getComponent(tribesman);
      tribeComponent.tribe!.createNewTribesman(hut);
   }
}

// @Incomplete: onTribesmanRemove