import { ArmourItemInfo, BowItemInfo, COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, FoodItemInfo, GameObjectDebugData, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, InventoryData, ItemType, Point, SETTINGS, ToolItemInfo, TribeMemberAction, TribeType, angle, randItem } from "webgl-test-shared";
import Tribe from "../../Tribe";
import TribeMember, { AttackToolType, EntityRelationship, getEntityAttackToolType } from "./TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import DroppedItem from "../../items/DroppedItem";
import Barrel from "./Barrel";
import { serializeInventoryData } from "../../entity-components/InventoryComponent";
import Item, { getItemStackSize, itemIsStackable } from "../../items/Item";
import { getEntitiesInVisionRange, getPositionRadialTiles } from "../../ai-shared";
import Tile from "../../Tile";
import Player from "./Player";

/*
Priorities while in a tribe:
   1. Keep the tribe totem + other buildings alive
   2. Stay alive by running away from threats when low on health
   3. Protect themselves by fighting back against attackers
   4. Help other tribe members being attacked
   5. Bring resources back to the tribe
   6. Attack mobs/enemies near the tribe area
   7. Gather nearby resources
   8. (DONE) Patrol tribe area
*/

enum TribesmanAIType {
   escaping,
   attacking,
   harvestingResources,
   pickingUpDroppedItems,
   haulingResources,
   grabbingFood,
   patrolling,
   idle
}

const RESOURCE_PRODUCTS: Partial<Record<EntityTypeConst, ReadonlyArray<ItemType>>> = {
   [EntityTypeConst.cow]: [ItemType.leather, ItemType.raw_beef],
   [EntityTypeConst.berry_bush]: [ItemType.berry],
   [EntityTypeConst.tree]: [ItemType.wood],
   [EntityTypeConst.ice_spikes]: [ItemType.frostcicle],
   [EntityTypeConst.cactus]: [ItemType.cactus_spine],
   [EntityTypeConst.boulder]: [ItemType.rock],
   [EntityTypeConst.krumblid]: [ItemType.leather]
}

const barrelHasFood = (barrel: Barrel): boolean => {
   const inventory = barrel.forceGetComponent("inventory").getInventory("inventory");

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

class Tribesman extends TribeMember {
   private static readonly RADIUS = 32;
   
   private static readonly INVENTORY_SIZE = 3;
   
   private static readonly VISION_RANGE = 320;

   private static readonly SLOW_TERMINAL_VELOCITY = 75;
   private static readonly SLOW_ACCELERATION = 150;

   private static readonly TERMINAL_VELOCITY = 150;
   private static readonly ACCELERATION = 300;
   
   private static readonly ESCAPE_HEALTH_THRESHOLD = 7.5;

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 50;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 50;

   /** How far the tribesmen will try to stay away from the entity they're attacking */
   private static readonly DESIRED_MELEE_ATTACK_DISTANCE = 60;
   private static readonly DESIRED_RANGED_ATTACK_DISTANCE = 260;

   private static readonly BARREL_INTERACT_DISTANCE = 80;

   public readonly mass = 1;

   private enemiesInVisionRange = new Array<Entity>();
   private enemyBuildingsInVisionRange = new Array<Entity>();
   private hostileMobsInVisionRange = new Array<Entity>();
   private resourcesInVisionRange = new Array<Entity>();

   private lastAIType = TribesmanAIType.idle;

   private targetPatrolPosition: Point | null = null;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;
   
   constructor(position: Point, tribeType: TribeType, tribe: Tribe) {
      super(position, EntityTypeConst.tribesman, Tribesman.VISION_RANGE, tribeType);

      const hitbox = new CircularHitbox(Tribesman.RADIUS, 0, 0);
      this.addHitbox(hitbox);

      const inventoryComponent = this.forceGetComponent("inventory");
      inventoryComponent.createNewInventory("hotbar", Tribesman.INVENTORY_SIZE, 1, true);

      // If the tribesman is a frostling, spawn with a bow
      if (tribeType === TribeType.frostlings) {
         inventoryComponent.addItemToSlot("hotbar", 1, ItemType.wooden_bow, 1);
      }

      this.tribe = tribe;
   }

   public tick(): void {
      super.tick();

      const inventoryComponent = this.forceGetComponent("inventory");
      const hotbarInventory = inventoryComponent.getInventory("hotbar");
      const armourInventory = inventoryComponent.getInventory("armourSlot");

      // Automatically pick up armour
      if (!armourInventory.itemSlots.hasOwnProperty(1)) {
         for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
            if (hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
               const item = hotbarInventory.itemSlots[itemSlot];
               if (ITEM_TYPE_RECORD[item.type] === "armour") {
                  inventoryComponent.addItemToSlot("armourSlot", 1, item.type, 1);
                  inventoryComponent.removeItemFromInventory("hotbar", itemSlot);
                  break;
               }
            }
         }
      }

      // Categorise visible entities
      this.enemiesInVisionRange = new Array<Entity>();
      this.enemyBuildingsInVisionRange = new Array<Entity>();
      this.hostileMobsInVisionRange = new Array<Entity>();
      this.enemiesInVisionRange = new Array<Entity>();
      this.resourcesInVisionRange = new Array<Entity>();
      const numVisibleEntities = this.visibleEntities.length;
      for (let i = 0; i < numVisibleEntities; i++) {
         const entity = this.visibleEntities[i];

         switch (this.getEntityRelationship(entity)) {
            case EntityRelationship.enemy: {
               this.enemiesInVisionRange.push(entity);
               break;
            }
            case EntityRelationship.enemyBuilding: {
               this.enemyBuildingsInVisionRange.push(entity);
               break;
            }
            case EntityRelationship.hostileMob: {
               this.hostileMobsInVisionRange.push(entity);
               break;
            }
            case EntityRelationship.resource: {
               this.resourcesInVisionRange.push(entity);
               break;
            }
         }
      }

      // Escape from enemies when low on health
      if (this.forceGetComponent("health").health <= Tribesman.ESCAPE_HEALTH_THRESHOLD && this.enemiesInVisionRange.length > 0) {
         this.escape();
         this.lastAIType = TribesmanAIType.escaping;
         this.currentAction = TribeMemberAction.none;
         return;
      }

      // If the player is interacting with the tribesman, move towards the player
      for (const entity of this.visibleEntities) {
         if (entity.type === EntityTypeConst.player && (entity as Player).interactingEntityID === this.id) {
            this.rotation = this.position.calculateAngleBetween(entity.position);
            const distance = this.position.calculateDistanceBetween(entity.position);
            if (this.willStopAtDesiredDistance(80, distance)) {
               this.terminalVelocity = 0;
               this.acceleration.x = 0;
               this.acceleration.y = 0;
            } else {
               this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
               this.acceleration.x = Tribesman.ACCELERATION * Math.sin(this.rotation);
               this.acceleration.y = Tribesman.ACCELERATION * Math.cos(this.rotation);
            }

            this.lastAIType = TribesmanAIType.idle;
            this.currentAction = TribeMemberAction.none;
            return;
         }
      }
      
      // Attack enemies
      if (this.enemiesInVisionRange.length > 0) {
         this.huntEntity(this.getClosestEntity(this.enemiesInVisionRange));
         this.lastAIType = TribesmanAIType.attacking;
         return;
      }
      
      // Attack enemy buildings
      if (this.enemyBuildingsInVisionRange.length > 0) {
         this.huntEntity(this.getClosestEntity(this.enemyBuildingsInVisionRange));
         this.lastAIType = TribesmanAIType.attacking;
         return;
      }
      
      // Attack hostile mobs
      if (this.hostileMobsInVisionRange.length > 0) {
         this.huntEntity(this.getClosestEntity(this.hostileMobsInVisionRange));
         this.lastAIType = TribesmanAIType.attacking;
         return;
      }

      // Heal when missing health
      if (this.forceGetComponent("health").health < this.forceGetComponent("health").maxHealth) {
         const foodItemSlot = this.getFoodItemSlot();
         if (foodItemSlot !== null) {
            this.selectedItemSlot = foodItemSlot;

            // If the food is only just being eaten, reset the food timer so that the food isn't immediately eaten
            if (this.currentAction !== TribeMemberAction.eat) {
               const foodItem = this.forceGetComponent("inventory").getItem("hotbar", foodItemSlot)!;
               const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
               this.foodEatingTimer = itemInfo.eatTime;
            }
            
            this.terminalVelocity = 0;
            this.acceleration.x = 0;
            this.acceleration.y = 0;
            this.currentAction = TribeMemberAction.eat;
            return;
         }
      }

      // If any tribe members need reinforcements, attack the requested target
      if (this.tribe !== null && this.tribe.reinforcementInfoArray.length > 0) {
         let closestTarget!: Entity;
         let minDist = Number.MAX_SAFE_INTEGER;
         for (const reinforcementInfo of this.tribe.reinforcementInfoArray) {
            const distance = this.position.calculateDistanceBetween(reinforcementInfo.targetEntity.position);
            if (distance < minDist) {
               closestTarget = reinforcementInfo.targetEntity;
               minDist = distance;
            }
         }

         this.huntEntity(closestTarget);
         this.lastAIType = TribesmanAIType.attacking;
         return;
      }

      // Pick up dropped items
      if (this.visibleDroppedItems.length > 0) {
         const health = this.forceGetComponent("health").health;
         
         let closestDroppedItem: DroppedItem | undefined;
         let minDistance = Number.MAX_SAFE_INTEGER;
         for (const droppedItem of this.visibleDroppedItems) {
            // If the tribesman is within the escape health threshold, make sure there wouldn't be any enemies visible while picking up the dropped item
            if (health <= Tribesman.ESCAPE_HEALTH_THRESHOLD && !this.positionIsSafe(droppedItem.position.x, droppedItem.position.y)) {
               continue;
            }

            const distance = this.position.calculateDistanceBetween(droppedItem.position);
            if (distance < minDistance && this.canPickUpItem(droppedItem.item.type)) {
               closestDroppedItem = droppedItem;
               minDistance = distance;
            }
         }

         if (typeof closestDroppedItem !== "undefined") {
            this.rotation = this.position.calculateAngleBetween(closestDroppedItem.position);
            this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
            this.acceleration.x = Tribesman.ACCELERATION * Math.sin(this.rotation);
            this.acceleration.y = Tribesman.ACCELERATION * Math.cos(this.rotation);
            this.lastAIType = TribesmanAIType.pickingUpDroppedItems;
            this.currentAction = TribeMemberAction.none;
            return;
         }
      }

      // If full inventory, haul resources back to barrel
      if (this.inventoryIsFull()) {
         const closestBarrel = this.findNearestBarrel();
         if (closestBarrel !== null) {
            this.haulToBarrel(closestBarrel);
            this.lastAIType = TribesmanAIType.haulingResources;
            this.currentAction = TribeMemberAction.none;
            return;
         }
      }

      // Attack closest resource
      if (this.resourcesInVisionRange.length > 0) {
         const health = this.forceGetComponent("health").health;

         // If the inventory is full, the resource should only be attacked if killing it produces an item that can be picked up
         let minDistance = Number.MAX_SAFE_INTEGER;
         let resourceToAttack: Entity | undefined;
         if (this.inventoryIsFull()) {
            for (const resource of this.resourcesInVisionRange) {
               // If the tribesman is within the escape health threshold, make sure there wouldn't be any enemies visible while picking up the dropped item
               if (health <= Tribesman.ESCAPE_HEALTH_THRESHOLD && !this.positionIsSafe(resource.position.x, resource.position.y)) {
                  continue;
               }

               // Check if the resource produces an item type that can be picked up
               let producesPickupableItemType = false;
               if (RESOURCE_PRODUCTS.hasOwnProperty(resource.type)) {
                  for (const itemType of RESOURCE_PRODUCTS[resource.type]!) {
                     if (this.canPickUpItem(itemType)) {
                        producesPickupableItemType = true;
                        break;
                     }
                  }
               }
               if (producesPickupableItemType) {
                  const dist = this.position.calculateDistanceBetween(resource.position);
                  if (dist < minDistance) {
                     resourceToAttack = resource;
                     minDistance = dist;
                  }
               }
            }
         } else {
            for (const resource of this.resourcesInVisionRange) {
               // If the tribesman is within the escape health threshold, make sure there wouldn't be any enemies visible while picking up the dropped item
               if (health <= Tribesman.ESCAPE_HEALTH_THRESHOLD && !this.positionIsSafe(resource.position.x, resource.position.y)) {
                  continue;
               }

               const dist = this.position.calculateDistanceBetween(resource.position);
               if (dist < minDistance) {
                  resourceToAttack = resource;
                  minDistance = dist;
               }
            }
         }

         if (typeof resourceToAttack !== "undefined") {
            this.huntEntity(resourceToAttack);
         }
         return;
      }

      // Grab food from barrel
      if (!this.hasFood() && this.hasAvailableHotbarSlot()) {
         let closestBarrelWithFood: Barrel | undefined;
         let minDist = Number.MAX_SAFE_INTEGER;
         for (const entity of this.visibleEntities) {
            if (entity.type === EntityTypeConst.barrel) {
               const distance = this.position.calculateDistanceBetween(entity.position);
               if (distance < minDist && barrelHasFood(entity as Barrel)) {
                  minDist = distance;
                  closestBarrelWithFood = entity as Barrel;
               }
            }
         }
         if (typeof closestBarrelWithFood !== "undefined") {
            if (this.position.calculateDistanceBetween(closestBarrelWithFood.position) > Tribesman.BARREL_INTERACT_DISTANCE) {
               // Move to barrel
               const direction = this.position.calculateAngleBetween(closestBarrelWithFood.position);
               this.acceleration.x = Tribesman.ACCELERATION * Math.sin(direction);
               this.acceleration.y = Tribesman.ACCELERATION * Math.cos(direction);
               this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
               this.rotation = direction;
            } else {
               this.grabBarrelFood(closestBarrelWithFood);
               this.acceleration.x = 0;
               this.acceleration.y = 0;
               this.terminalVelocity = 0;
            }
            this.lastAIType = TribesmanAIType.grabbingFood;
            return;
         }
      }

      if (this.tribe === null) {
         // @Incomplete
         return;
      }

      // 
      // If nothing else to do, patrol tribe area
      // 

      if (this.targetPatrolPosition === null && Math.random() < 0.3 / SETTINGS.TPS) {
         const tileTargets = getPositionRadialTiles(this.position, Tribesman.VISION_RANGE);
         if (tileTargets.length > 0) {
            // Filter tiles in tribe area
            const tilesInTribeArea = new Array<Tile>();
            for (const tile of tileTargets) {
               if (this.tribe.tileIsInArea(tile.x, tile.y)) {
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
   
            this.targetPatrolPosition = new Point((targetTile.x + Math.random()) * SETTINGS.TILE_SIZE, (targetTile.y + Math.random()) * SETTINGS.TILE_SIZE);
            this.rotation = this.position.calculateAngleBetween(this.targetPatrolPosition);
            this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
            this.acceleration.x = Tribesman.ACCELERATION * Math.sin(this.rotation);
            this.acceleration.y = Tribesman.ACCELERATION * Math.cos(this.rotation);
            this.lastAIType = TribesmanAIType.patrolling;
            return;
         }
      } else if (this.targetPatrolPosition !== null) {
         if (this.hasReachedPatrolPosition()) {
            this.terminalVelocity = 0;
            this.acceleration.x = 0;
            this.acceleration.y = 0;
            this.lastAIType = TribesmanAIType.idle;
            this.targetPatrolPosition = null;
            return;
         }
         
         // Move to patrol position
         this.rotation = this.position.calculateAngleBetween(this.targetPatrolPosition);
         this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
         this.acceleration.x = Tribesman.ACCELERATION * Math.sin(this.rotation);
         this.acceleration.y = Tribesman.ACCELERATION * Math.cos(this.rotation);
         this.lastAIType = TribesmanAIType.patrolling;
         return;
      }

      // If all else fails, just stop movin'
      this.terminalVelocity = 0;
      this.acceleration.x = 0;
      this.acceleration.y = 0;
      this.lastAIType = TribesmanAIType.idle;
   }

   private hasReachedPatrolPosition(): boolean {
      if (this.targetPatrolPosition === null || this.velocity === null) return false;

      const relativeTargetPosition = this.position.copy();
      relativeTargetPosition.subtract(this.targetPatrolPosition);

      const dotProduct = this.velocity.calculateDotProduct(relativeTargetPosition);
      return dotProduct > 0;
   }

   private escape(): void {
      // Calculate the escape position based on the position of all visible enemies
      let averageEnemyX = 0;
      let averageEnemyY = 0;
      for (const enemy of this.enemiesInVisionRange) {
         let distance = this.position.calculateDistanceBetween(enemy.position);
         if (distance > Tribesman.VISION_RANGE) {
            distance = Tribesman.VISION_RANGE;
         }
         const weight = Math.pow(1 - distance / Tribesman.VISION_RANGE / 1.25, 0.5);

         const relativeX = (enemy.position.x - this.position.x) * weight;
         const relativeY = (enemy.position.y - this.position.y) * weight;

         averageEnemyX += relativeX + this.position.x;
         averageEnemyY += relativeY + this.position.y;
         if (isNaN(averageEnemyX) || isNaN(averageEnemyY)) {
            console.warn("NaN!");
            return;
         }
      }
      averageEnemyX /= this.enemiesInVisionRange.length;
      averageEnemyY /= this.enemiesInVisionRange.length;

      // Run away from that position
      const runDirection = angle(averageEnemyX - this.position.x, averageEnemyY - this.position.y) + Math.PI;
      this.rotation = runDirection;
      this.acceleration.x = Tribesman.ACCELERATION * Math.sin(runDirection);
      this.acceleration.y = Tribesman.ACCELERATION * Math.cos(runDirection);
      this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
   }

   private huntEntity(entity: Entity): void {
      // Find the best tool for the job
      let bestToolSlot: number | null;
      const attackToolType = getEntityAttackToolType(entity);
      switch (attackToolType) {
         case AttackToolType.weapon: {
            bestToolSlot = this.getBestWeaponSlot();
            if (bestToolSlot === null) {
               bestToolSlot = this.getBestPickaxeSlot();
            }
            if (bestToolSlot === null) {
               bestToolSlot = this.getBestAxeSlot();
            }
            break;
         }
         case AttackToolType.pickaxe: {
            bestToolSlot = this.getBestPickaxeSlot();
            break;
         }
         case AttackToolType.axe: {
            bestToolSlot = this.getBestAxeSlot();
            break;
         }
      }

      if (bestToolSlot !== null) {
         this.selectedItemSlot = bestToolSlot;

         // Don't do a melee attack if using a bow, instead charge the bow
         const selectedItem = this.forceGetComponent("inventory").getItem("hotbar", this.selectedItemSlot)!;
         const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];
         if (weaponCategory === "bow") {
            // If the tribesman is only just charging the bow, reset the cooldown to prevent the bow firing immediately
            if (this.currentAction !== TribeMemberAction.charge_bow) {
               const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as BowItemInfo;
               this.bowCooldownTicks = itemInfo.shotCooldownTicks;
            }
            this.currentAction = TribeMemberAction.charge_bow;
            
            this.engageTargetRanged(entity);

            // If the bow is fully charged, fire it
            if (this.bowCooldownTicks === 0) {
               this.useItem(selectedItem, this.selectedItemSlot);
            }

            return;
         }
      }

      // If a melee attack is being done, update to attack at melee distance
      this.engageTargetMelee(entity);

      this.currentAction = TribeMemberAction.none;
      
      this.doMeleeAttack();
   }

   private engageTargetRanged(target: Entity): void {
      const distance = this.calculateDistanceFromEntity(target);
      this.rotation = this.position.calculateAngleBetween(target.position);
      if (this.willStopAtDesiredDistance(Tribesman.DESIRED_RANGED_ATTACK_DISTANCE, distance)) {
         this.terminalVelocity = Tribesman.SLOW_TERMINAL_VELOCITY;
         this.acceleration.x = Tribesman.SLOW_ACCELERATION * Math.sin(this.rotation + Math.PI);
         this.acceleration.y = Tribesman.SLOW_ACCELERATION * Math.cos(this.rotation + Math.PI);
      } else {
         this.terminalVelocity = Tribesman.SLOW_TERMINAL_VELOCITY;
         this.acceleration.x = Tribesman.SLOW_ACCELERATION * Math.sin(this.rotation);
         this.acceleration.y = Tribesman.SLOW_ACCELERATION * Math.cos(this.rotation);
      }
   }

   private engageTargetMelee(target: Entity): void {
      const distance = this.calculateDistanceFromEntity(target);
      this.rotation = this.position.calculateAngleBetween(target.position);
      if (this.willStopAtDesiredDistance(Tribesman.DESIRED_MELEE_ATTACK_DISTANCE, distance)) {
         this.terminalVelocity = Tribesman.SLOW_TERMINAL_VELOCITY;
         this.acceleration.x = Tribesman.SLOW_ACCELERATION * Math.sin(this.rotation + Math.PI);
         this.acceleration.y = Tribesman.SLOW_ACCELERATION * Math.cos(this.rotation + Math.PI);
      } else {
         this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
         this.acceleration.x = Tribesman.ACCELERATION * Math.sin(this.rotation);
         this.acceleration.y = Tribesman.ACCELERATION * Math.cos(this.rotation);
      }
   }

   private calculateDistanceFromEntity(entity: Entity): number {
      let distance = this.position.calculateDistanceBetween(entity.position);
      for (const hitbox of entity.hitboxes) {
         if (hitbox.hasOwnProperty("radius")) {
            const hitboxDistance = this.position.calculateDistanceBetween(hitbox.position) - Tribesman.RADIUS - (hitbox as CircularHitbox).radius;
            if (hitboxDistance < distance) {
               distance = hitboxDistance;
            }
         } else {
            // @Incomplete: Rectangular hitbox dist
         }
      }
      return distance;
   }

   // @Cleanup: Move the following 2 functions to ai-shared

   private willStopAtDesiredDistance(desiredDistance: number, distance: number): boolean {
      // If the entity has a desired distance from its target, try to stop at that desired distance
      const stopDistance = this.estimateStopDistance();
      return distance - stopDistance <= desiredDistance;
   }

   /** Estimates the distance it will take for the entity to stop */
   private estimateStopDistance(): number {
      if (this.velocity === null) {
         return 0;
      }

      // Estimate time it will take for the entity to stop
      const stopTime = Math.pow(this.velocity.length(), 0.8) / (3 * SETTINGS.FRICTION_CONSTANT);
      const stopDistance = (Math.pow(stopTime, 2) + stopTime) * this.velocity.length();
      return stopDistance;
   }

   private inventoryIsFull(): boolean {
      return this.forceGetComponent("inventory").inventoryIsFull("hotbar");
   }

   private haulToBarrel(barrel: Barrel): void {
      this.rotation = this.position.calculateAngleBetween(barrel.position);
      this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
      this.acceleration.x = Tribesman.ACCELERATION * Math.sin(this.rotation);
      this.acceleration.y = Tribesman.ACCELERATION * Math.cos(this.rotation);

      if (this.position.calculateDistanceBetween(barrel.position) <= Tribesman.BARREL_INTERACT_DISTANCE) {
         this.depositResources(barrel);
      }
   }

   private canPickUpItem(itemType: ItemType): boolean {
      const inventoryComponent = this.forceGetComponent("inventory");
      const inventory = inventoryComponent.getInventory("hotbar");
      
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

   private findNearestBarrel(): Barrel | null {
      if (this.tribe === null) return null;
      
      let minDistance = Number.MAX_SAFE_INTEGER;
      let closestBarrel: Barrel | null = null;
      for (const barrel of this.tribe.getBarrels()) {
         const distance = this.position.calculateDistanceBetween(barrel.position);
         if (distance < minDistance) {
            minDistance = distance;
            closestBarrel = barrel;
         }
      }
      
      return closestBarrel;
   }

   /** Deposit all resources from the tribesman's inventory into a barrel */
   private depositResources(barrel: Barrel): void {
      const tribesmanInventoryComponent = this.forceGetComponent("inventory");
      const barrelInventoryComponent = barrel.forceGetComponent("inventory");
      const tribesmanInventory = tribesmanInventoryComponent.getInventory("hotbar");

      // 
      // Isolate the items the tribesman will want to keep
      // 
      const bestWeaponItemSlot = this.getBestWeaponSlot();
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
      
      for (const [_itemSlot, item] of Object.entries(tribesmanInventory.itemSlots)) {
         const itemSlot = Number(_itemSlot);
         
         if (itemSlot === bestWeaponItemSlot || itemSlot === bestAxeItemSlot || itemSlot === bestPickaxeItemSlot || itemSlot === bestArmourItemSlot || itemSlot === firstFoodItemSlot) {
            continue;
         }
         
         // Add the item to the barrel inventory and remove from tribesman inventory
         const amountAdded = barrelInventoryComponent.addItemToInventory("inventory", item);
         tribesmanInventoryComponent.consumeItem("hotbar", itemSlot, amountAdded);
      }
   }

   // @Cleanup: Copy and paste

   private getBestWeaponSlot(): number | null {
      const tribesmanInventory = this.forceGetComponent("inventory").getInventory("hotbar");

      let bestWeaponLevel = -1;
      let bestWeaponItemSlot = -1;
      for (let itemSlot = 1; itemSlot <= tribesmanInventory.width * tribesmanInventory.height; itemSlot++) {
         if (!tribesmanInventory.itemSlots.hasOwnProperty(itemSlot)) {
            continue;
         }

         const item = tribesmanInventory.itemSlots[itemSlot];
         
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

   private getBestPickaxeSlot(): number | null {
      const tribesmanInventory = this.forceGetComponent("inventory").getInventory("hotbar");

      let bestPickaxeLevel = -1;
      let bestPickaxeItemSlot = -1;
      for (let itemSlot = 1; itemSlot <= tribesmanInventory.width * tribesmanInventory.height; itemSlot++) {
         if (!tribesmanInventory.itemSlots.hasOwnProperty(itemSlot)) {
            continue;
         }

         const item = tribesmanInventory.itemSlots[itemSlot];
         
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

   private getBestAxeSlot(): number | null {
      const tribesmanInventory = this.forceGetComponent("inventory").getInventory("hotbar");

      let bestAxeLevel = -1;
      let bestAxeItemSlot = -1;
      for (let itemSlot = 1; itemSlot <= tribesmanInventory.width * tribesmanInventory.height; itemSlot++) {
         if (!tribesmanInventory.itemSlots.hasOwnProperty(itemSlot)) {
            continue;
         }

         const item = tribesmanInventory.itemSlots[itemSlot];
         
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

   private doMeleeAttack(): void {
      // Find the attack target
      const attackTargets = this.calculateRadialAttackTargets(Tribesman.ATTACK_OFFSET, Tribesman.ATTACK_RADIUS);
      const target = this.calculateAttackTarget(attackTargets);

      // Register the hit
      if (target !== null) {
         this.attackEntity(target, this.selectedItemSlot);
      }
   }

   private getFoodItemSlot(): number | null {
      const hotbar = this.forceGetComponent("inventory").getInventory("hotbar");
      for (const [_itemSlot, item] of Object.entries(hotbar.itemSlots)) {
         const itemCategory = ITEM_TYPE_RECORD[item.type];
         if (itemCategory === "food") {
            return Number(_itemSlot);
         }
      }
      return null;
   }

   private positionIsSafe(x: number, y: number): boolean {
      const visibleEntitiesFromItem = getEntitiesInVisionRange(x, y, Tribesman.VISION_RANGE);
      for (const entity of visibleEntitiesFromItem) {
         const relationship = this.getEntityRelationship(entity);
         if (relationship >= EntityRelationship.hostileMob) {
            return false;
         }
      }
      return true;
   }

   private hasAvailableHotbarSlot(): boolean {
      const inventory = this.forceGetComponent("inventory").getInventory("hotbar");

      for (let slotNum = 1; slotNum <= inventory.width * inventory.height; slotNum++) {
         if (!inventory.itemSlots.hasOwnProperty(slotNum)) {
            return true;
         }
      }

      return false;
   }

   private hasFood(): boolean {
      const inventory = this.forceGetComponent("inventory").getInventory("hotbar");

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

   private grabBarrelFood(barrel: Barrel): void {
      // 
      // Grab the food stack with the highest total heal amount
      // 

      const barrelInventoryComponent = barrel.forceGetComponent("inventory");
      const barrelInventory = barrelInventoryComponent.getInventory("inventory");

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

      this.forceGetComponent("inventory").addItemToInventory("hotbar", food);
      barrelInventoryComponent.consumeItem("inventory", foodItemSlot, 999);
   }

   public getClientArgs(): [tribeID: number | null, tribeType: TribeType, armourSlotInventory: InventoryData, backpackSlotInventory: InventoryData, backpackInventory: InventoryData, activeItem: ItemType | null, action: TribeMemberAction, foodEatingType: ItemType | -1, lastActionTicks: number, hasFrostShield: boolean, warPaintType: number, inventory: InventoryData, activeItemSlot: number] {
      const inventoryComponent = this.forceGetComponent("inventory");
      const hotbarInventory = this.forceGetComponent("inventory").getInventory("hotbar");

      return [
         this.tribe !== null ? this.tribe.id : null,
         this.tribeType,
         serializeInventoryData(inventoryComponent.getInventory("armourSlot"), "armourSlot"),
         serializeInventoryData(inventoryComponent.getInventory("backpackSlot"), "backpackSlot"),
         serializeInventoryData(inventoryComponent.getInventory("backpack"), "backpack"),
         this.getActiveItemType(),
         this.currentAction,
         this.getFoodEatingType(),
         this.getLastActionTicks(),
         this.hasFrostShield(),
         this.warPaintType,
         serializeInventoryData(hotbarInventory, "hotbar"),
         this.selectedItemSlot
      ];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      debugData.debugEntries.push("Tribe ID: " + (this.tribe !== null ? this.tribe.id : "N/A"));
      debugData.debugEntries.push("AI: " + TribesmanAIType[this.lastAIType]);

      // Circle for vision range
      debugData.circles.push({
         radius: Tribesman.VISION_RANGE,
         colour: [1, 0, 1],
         thickness: 2
      });

      switch (this.lastAIType) {
         case TribesmanAIType.escaping: {
            // Find the average position of all visible enemies
            let averageEnemyX = 0;
            let averageEnemyY = 0;
            for (const enemy of this.enemiesInVisionRange) {
               averageEnemyX += enemy.position.x;
               averageEnemyY += enemy.position.y;
            }
            averageEnemyX /= this.enemiesInVisionRange.length;
            averageEnemyY /= this.enemiesInVisionRange.length;

            debugData.lines.push({
               targetPosition: [averageEnemyX, averageEnemyY],
               thickness: 2,
               colour: [1, 0, 0]
            });
         }
         case TribesmanAIType.patrolling: {
            if (this.targetPatrolPosition !== null) {
               debugData.lines.push({
                  targetPosition: this.targetPatrolPosition.package(),
                  thickness: 2,
                  colour: [0, 0, 1]
               });
            }
         }
      }

      return debugData;
   }
}

export default Tribesman;