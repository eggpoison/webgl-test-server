import { ArmourItemInfo, BowItemInfo, EntityType, FoodItemInfo, GameObjectDebugData, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, InventoryData, ItemType, Point, SETTINGS, ToolItemInfo, TribeMemberAction, TribeType, Vector, angle } from "webgl-test-shared";
import Tribe from "../../Tribe";
import TribeMember, { AttackToolType, EntityRelationship, getEntityAttackToolType } from "./TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Board from "../../Board";
import Entity from "../Entity";
import DroppedItem from "../../items/DroppedItem";
import Barrel from "./Barrel";
import { serializeInventoryData } from "../../entity-components/InventoryComponent";
import { getItemStackSize, itemIsStackable } from "../../items/Item";
import { GameObject } from "../../GameObject";

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
   haulingResources,
   idle
}

class Tribesman extends TribeMember {
   private static readonly INVENTORY_SIZE = 3;
   
   private static readonly VISION_RANGE = 320;

   private static readonly SLOW_TERMINAL_VELOCITY = 75;
   private static readonly SLOW_ACCELERATION = 150;

   private static readonly TERMINAL_VELOCITY = 150;
   private static readonly ACCELERATION = 300;

   // @Cleanup: do we need these?
   private static readonly ENEMY_TARGETS: ReadonlyArray<EntityType> = ["slime", "yeti", "zombie", "tombstone"];
   private static readonly RESOURCE_TARGETS: ReadonlyArray<EntityType> = ["cow", "cactus", "tree", "berry_bush", "boulder", "ice_spikes"];

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 50;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 50;

   /** How far the tribesmen will try to stay away from the entity they're attacking */
   private static readonly DESIRED_MELEE_ATTACK_DISTANCE = 120;
   private static readonly DESIRED_RANGED_ATTACK_DISTANCE = 500;

   private static readonly BARREL_DEPOSIT_DISTANCE = 80;

   public readonly mass = 1;

   /** All game objects the tribesman can see */
   private gameObjectsInVisionRange = new Array<GameObject>();
   private enemiesInVisionRange = new Array<Entity>();
   private resourcesInVisionRange = new Array<Entity>();
   private droppedItemsInVisionRange = new Array<DroppedItem>();

   private lastAIType = TribesmanAIType.idle;

   private targetPatrolPosition: Point | null = null;
   
   constructor(position: Point, tribeType: TribeType, tribe: Tribe) {
      super(position, "tribesman", Tribesman.VISION_RANGE, tribeType);


      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(32);
      this.addHitbox(hitbox);

      const inventoryComponent = this.getComponent("inventory")!;
      inventoryComponent.createNewInventory("hotbar", Tribesman.INVENTORY_SIZE, 1, true);

      // If the tribesman is a frostling, spawn with a bow
      if (tribeType === TribeType.frostlings) {
         inventoryComponent.addItemToSlot("hotbar", 1, ItemType.wooden_bow, 1);
      }

      this.tribe = tribe;
   }

   public tick(): void {
      super.tick();

      // 
      // Recalculate game objects the tribesman can see
      // 

      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - Tribesman.VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + Tribesman.VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - Tribesman.VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + Tribesman.VISION_RANGE) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      this.gameObjectsInVisionRange = new Array<GameObject>();
      this.enemiesInVisionRange = new Array<Entity>();
      this.resourcesInVisionRange = new Array<Entity>();
      this.droppedItemsInVisionRange = new Array<DroppedItem>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const gameObject of chunk.getGameObjects()) {
               if (this.gameObjectsInVisionRange.includes(gameObject)) continue;

               if (Math.pow(this.position.x - gameObject.position.x, 2) + Math.pow(this.position.y - gameObject.position.y, 2) <= Math.pow(Tribesman.VISION_RANGE, 2)) {
                  this.gameObjectsInVisionRange.push(gameObject);

                  // If an enemy, add to enemies
                  if (gameObject.i === "entity") {
                     const relationship = this.getEntityRelationship(gameObject);
                     if (relationship >= EntityRelationship.hostileMob) {
                        this.enemiesInVisionRange.push(gameObject);
                     } else if (relationship === EntityRelationship.resource) {
                        this.resourcesInVisionRange.push(gameObject);
                     }
                  } else if (gameObject.i === "droppedItem") {
                     this.droppedItemsInVisionRange.push(gameObject);
                  }
               }
            }
         }  
      }

      this.gameObjectsInVisionRange.splice(this.gameObjectsInVisionRange.indexOf(this, 1));

      // Escape from enemies when low on health
      if (this.getComponent("health")!.getHealth() <= 10 && this.enemiesInVisionRange.length > 0) {
         this.escape();
         this.lastAIType = TribesmanAIType.escaping;
         this.currentAction = TribeMemberAction.none;
         return;
      }

      // Attack closest entity
      if (this.enemiesInVisionRange.length > 0) {
         this.attackEnemy();
         this.lastAIType = TribesmanAIType.attacking;
         return;
      }

      // Heal when missing health
      if (this.getComponent("health")!.getHealth() < this.getComponent("health")!.maxHealth) {
         const foodItemSlot = this.getFoodItemSlot();
         if (foodItemSlot !== null) {
            this.selectedItemSlot = foodItemSlot;

            // If the food is only just being eaten, reset the food timer so that the food isn't immediately eaten
            if (this.currentAction !== TribeMemberAction.eat) {
               const foodItem = this.getComponent("inventory")!.getItem("hotbar", foodItemSlot)!;
               const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
               this.foodEatingTimer = itemInfo.eatTime;
            }
            
            this.terminalVelocity = 0;
            this.acceleration = null;
            this.currentAction = TribeMemberAction.eat;
            return;
         }
      }

      // Pick up dropped items
      if (this.droppedItemsInVisionRange.length > 0) {
         let closestDroppedItem: DroppedItem | undefined;
         let minDistance = Number.MAX_SAFE_INTEGER;
         for (const droppedItem of this.droppedItemsInVisionRange) {
            const distance = this.position.calculateDistanceBetween(droppedItem.position);
            if (distance < minDistance && this.canPickUpItem(droppedItem)) {
               closestDroppedItem = droppedItem;
               minDistance = distance;
            }
         }

         if (typeof closestDroppedItem !== "undefined") {
            this.rotation = this.position.calculateAngleBetween(closestDroppedItem.position);
            this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
            this.acceleration = new Vector(Tribesman.ACCELERATION, this.rotation);
            this.lastAIType = TribesmanAIType.idle;
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
      if (this.resourcesInVisionRange.length > 0 && !this.inventoryIsFull()) {
         this.attackResource();
         return;
      }

      // If not in tribe area, move to tribe totem
      if (this.tribe !== null && !this.tribe.tileIsInArea(this.tile.x, this.tile.y)) {
         this.rotation = this.position.calculateAngleBetween(this.tribe.totem.position);
         this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
         this.acceleration = new Vector(Tribesman.ACCELERATION, this.rotation);
         
         this.currentAction = TribeMemberAction.none;
         this.lastAIType = TribesmanAIType.idle;
         return;
      }

      if (this.tribe === null) {
         // @Incomplete
         return;
      }

      // 
      // If nothing else to do, patrol tribe area
      // 

      if (this.targetPatrolPosition === null && Math.random() < 0.3 / SETTINGS.TPS) {
         // Find a random position to patrol to
         do {
            // @Speed: Garbage collection
            this.targetPatrolPosition = this.position.copy();
            this.targetPatrolPosition.add(Point.fromVectorForm(Tribesman.VISION_RANGE * Math.random(), 2 * Math.PI * Math.random()));
         } while (!this.tribe.tileIsInArea(Math.floor(this.targetPatrolPosition.x / SETTINGS.TILE_SIZE), Math.floor(this.targetPatrolPosition.y / SETTINGS.TILE_SIZE)));
      } else if (this.targetPatrolPosition !== null) {
         if (this.hasReachedTargetPosition()) {
            this.terminalVelocity = 0;
            this.acceleration = null;
            this.lastAIType = TribesmanAIType.idle;
            return;
         }
         
         // Move to patrol position
         this.rotation = this.position.calculateAngleBetween(this.targetPatrolPosition);
         this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
         this.acceleration = new Vector(Tribesman.ACCELERATION, this.rotation);
         this.lastAIType = TribesmanAIType.idle;
      }
   }

   private hasReachedTargetPosition(): boolean {
      if (this.targetPatrolPosition === null || this.velocity === null) return false;

      const relativeTargetPosition = this.position.copy();
      relativeTargetPosition.subtract(this.targetPatrolPosition);

      const dotProduct = this.velocity.convertToPoint().calculateDotProduct(relativeTargetPosition);
      return dotProduct > 0;
   }

   private escape(): void {
      // Find the average position of all visible enemies
      let averageEnemyX = 0;
      let averageEnemyY = 0;
      for (const enemy of this.enemiesInVisionRange) {
         averageEnemyX += enemy.position.x;
         averageEnemyY += enemy.position.y;
      }
      averageEnemyX /= this.enemiesInVisionRange.length;
      averageEnemyY /= this.enemiesInVisionRange.length;

      // Run away from that position
      const runDirection = angle(averageEnemyX - this.position.x, averageEnemyY - this.position.y) + Math.PI;
      this.rotation = runDirection;
      this.acceleration = new Vector(Tribesman.ACCELERATION, runDirection);
      this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
   }

   private attackEnemy(): void {
      // Find the closest enemy
      let closestEnemy!: Entity;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const enemy of this.enemiesInVisionRange) {
         const dist = this.position.calculateDistanceBetween(enemy.position);
         if (dist < minDistance) {
            closestEnemy = enemy;
            minDistance = dist;
         }
      }

      // Equip the best weapon the tribesman has
      const bestWeaponSlot = this.getBestWeaponSlot();
      if (bestWeaponSlot !== null) {
         this.selectedItemSlot = bestWeaponSlot;

         // Don't do a melee attack if using a bow, instead charge the bow
         const selectedItem = this.getComponent("inventory")!.getItem("hotbar", this.selectedItemSlot)!;
         const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];
         if (weaponCategory === "bow") {
            // If the tribesman is only just charging the bow, reset the cooldown to prevent the bow firing immediately
            if (this.currentAction !== TribeMemberAction.charge_bow) {
               const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as BowItemInfo;
               this.bowCooldowns[this.selectedItemSlot] = itemInfo.shotCooldown;
            }
            this.currentAction = TribeMemberAction.charge_bow;
            
            if (this.willStopAtDesiredDistance(Tribesman.DESIRED_RANGED_ATTACK_DISTANCE, closestEnemy.position)) {
               this.terminalVelocity = 0;
               this.acceleration = null;
            } else {
               this.terminalVelocity = Tribesman.SLOW_TERMINAL_VELOCITY;
               this.acceleration = new Vector(Tribesman.SLOW_ACCELERATION, this.position.calculateAngleBetween(closestEnemy.position));
            }
            this.rotation = this.position.calculateAngleBetween(closestEnemy.position);

            // If the bow is fully charged, fire it
            if (!this.bowCooldowns.hasOwnProperty(this.selectedItemSlot)) {
               this.useItem(selectedItem, this.selectedItemSlot);
            }

            return;
         }
      }

      // If a melee attack is being done, update to attack at melee distance
      if (this.willStopAtDesiredDistance(Tribesman.DESIRED_MELEE_ATTACK_DISTANCE, closestEnemy.position)) {
         this.terminalVelocity = 0;
         this.acceleration = null;
      } else {
         this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
         this.acceleration = new Vector(Tribesman.ACCELERATION, this.position.calculateAngleBetween(closestEnemy.position));
      }
      this.rotation = this.position.calculateAngleBetween(closestEnemy.position);

      this.currentAction = TribeMemberAction.none;
      
      this.doMeleeAttack();
   }

   private attackResource(): void {
      // Find the closest resource
      let closestResource!: Entity;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const resource of this.resourcesInVisionRange) {
         const dist = this.position.calculateDistanceBetween(resource.position);
         if (dist < minDistance) {
            closestResource = resource;
            minDistance = dist;
         }
      }
      
      // Equip the tool for the job
      let bestToolSlot: number | null;
      const attackToolType = getEntityAttackToolType(closestResource);
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
         const selectedItem = this.getComponent("inventory")!.getItem("hotbar", this.selectedItemSlot)!;
         const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];
         if (weaponCategory === "bow") {
            // If the tribesman is only just charging the bow, reset the cooldown to prevent the bow firing immediately
            if (this.currentAction !== TribeMemberAction.charge_bow) {
               const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as BowItemInfo;
               this.bowCooldowns[this.selectedItemSlot] = itemInfo.shotCooldown;
            }
            this.currentAction = TribeMemberAction.charge_bow;
            
            this.rotation = this.position.calculateAngleBetween(closestResource.position);
            if (this.willStopAtDesiredDistance(Tribesman.DESIRED_RANGED_ATTACK_DISTANCE, closestResource.position)) {
               this.terminalVelocity = 0;
               this.acceleration = null;
            } else {
               this.terminalVelocity = Tribesman.SLOW_TERMINAL_VELOCITY;
               this.acceleration = new Vector(Tribesman.SLOW_ACCELERATION, this.rotation);
            }

            // If the bow is fully charged, fire it
            if (!this.bowCooldowns.hasOwnProperty(this.selectedItemSlot)) {
               this.useItem(selectedItem, this.selectedItemSlot);
            }

            return;
         }
      }

      // If a melee attack is being done, update to attack at melee distance
      this.rotation = this.position.calculateAngleBetween(closestResource.position);
      if (this.willStopAtDesiredDistance(Tribesman.DESIRED_MELEE_ATTACK_DISTANCE, closestResource.position)) {
         this.terminalVelocity = 0;
         this.acceleration = null;
      } else {
         this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
         this.acceleration = new Vector(Tribesman.ACCELERATION, this.rotation);
      }

      this.currentAction = TribeMemberAction.none;
      
      this.doMeleeAttack();
   }

   private willStopAtDesiredDistance(desiredDistance: number, targetPosition: Point): boolean {
      // If the entity has a desired distance from its target, try to stop at that desired distance
      const stopDistance = this.estimateStopDistance();
      const distance = this.position.calculateDistanceBetween(targetPosition);
      return distance - stopDistance <= desiredDistance;
   }

   /** Estimates the distance it will take for the entity to stop */
   private estimateStopDistance(): number {
      if (this.velocity === null) {
         return 0;
      }

      // Estimate time it will take for the entity to stop
      const stopTime = Math.pow(this.velocity.magnitude, 0.8) / (3 * SETTINGS.FRICTION_CONSTANT);
      const stopDistance = (Math.pow(stopTime, 2) + stopTime) * this.velocity.magnitude;
      return stopDistance;
   }

   private inventoryIsFull(): boolean {
      return this.getComponent("inventory")!.inventoryIsFull("hotbar");
   }

   private haulToBarrel(barrel: Barrel): void {
      this.rotation = this.position.calculateAngleBetween(barrel.position);
      this.terminalVelocity = Tribesman.TERMINAL_VELOCITY;
      this.acceleration = new Vector(Tribesman.ACCELERATION, this.rotation);

      if (this.position.calculateDistanceBetween(barrel.position) <= Tribesman.BARREL_DEPOSIT_DISTANCE) {
         this.depositResources(barrel);
      }
   }

   private canPickUpItem(droppedItem: DroppedItem): boolean {
      const inventoryComponent = this.getComponent("inventory")!;
      const inventory = inventoryComponent.getInventory("hotbar");
      
      for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
         if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
            return true;
         }

         const item = inventory.itemSlots[itemSlot];
         if (item.type === droppedItem.item.type && itemIsStackable(item.type) && getItemStackSize(item) - item.count > 0) {
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
      const tribesmanInventoryComponent = this.getComponent("inventory")!;
      const barrelInventoryComponent = barrel.getComponent("inventory")!;
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
      const tribesmanInventory = this.getComponent("inventory")!.getInventory("hotbar");

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
      const tribesmanInventory = this.getComponent("inventory")!.getInventory("hotbar");

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
      const tribesmanInventory = this.getComponent("inventory")!.getInventory("hotbar");

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
      const hotbar = this.getComponent("inventory")!.getInventory("hotbar");
      for (const [_itemSlot, item] of Object.entries(hotbar.itemSlots)) {
         const itemCategory = ITEM_TYPE_RECORD[item.type];
         if (itemCategory === "food") {
            return Number(_itemSlot);
         }
      }
      return null;
   }

   public getClientArgs(): [tribeID: number | null, tribeType: TribeType, armourSlotInventory: InventoryData, backpackSlotInventory: InventoryData, backpackInventory: InventoryData, activeItem: ItemType | null, action: TribeMemberAction, foodEatingType: ItemType | -1, lastActionTicks: number, inventory: InventoryData, activeItemSlot: number] {
      const inventoryComponent = this.getComponent("inventory")!;
      const hotbarInventory = this.getComponent("inventory")!.getInventory("hotbar");

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
         serializeInventoryData(hotbarInventory, "hotbar"),
         this.selectedItemSlot
      ];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

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
      }

      return debugData;
   }
}

export default Tribesman;