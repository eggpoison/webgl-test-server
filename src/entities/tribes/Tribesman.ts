import { ArmourItemInfo, EntityType, FoodItemInfo, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, InventoryData, ItemType, Point, ToolItemInfo, TribeMemberAction, TribeType } from "webgl-test-shared";
import Tribe from "../../Tribe";
import TribeMember, { AttackToolType, getEntityAttackToolType } from "./TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import WanderAI from "../../mob-ai/WanderAI";
import Board from "../../Board";
import ChaseAI from "../../mob-ai/ChaseAI";
import Entity from "../Entity";
import ItemChaseAI from "../../mob-ai/ItemChaseAI";
import DroppedItem from "../../items/DroppedItem";
import MoveAI from "../../mob-ai/MoveAI";
import Barrel from "./Barrel";
import TribeTotem from "./TribeTotem";
import TribeHut from "./TribeHut";
import { serializeInventoryData } from "../../entity-components/InventoryComponent";
import Item, { getItemStackSize, itemIsStackable } from "../../items/Item";

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

class Tribesman extends TribeMember {
   private static readonly INVENTORY_SIZE = 3;
   
   private static readonly VISION_RANGE = 320;

   private static readonly TERMINAL_VELOCITY = 150;
   private static readonly ACCELERATION = 300;

   private static readonly ENEMY_TARGETS: ReadonlyArray<EntityType> = ["slime", "yeti", "zombie", "tombstone"];
   private static readonly RESOURCE_TARGETS: ReadonlyArray<EntityType> = ["cow", "cactus", "tree", "berry_bush", "boulder", "ice_spikes"];

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 50;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 50;

   /** How far the tribesmen will try to stay away from the entity they're attacking */
   private static readonly DESIRED_ATTACK_DISTANCE = 120;

   private static readonly BARREL_DEPOSIT_DISTANCE = 80;

   public readonly mass = 1;
   
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

      // AI for attacking enemies
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1,
         terminalVelocity: Tribesman.TERMINAL_VELOCITY,
         acceleration: Tribesman.ACCELERATION,
         desiredDistance: Tribesman.DESIRED_ATTACK_DISTANCE,
         entityIsChased: (entity: Entity): boolean => {
            if (this.tribe !== null) {
               // Attack enemy tribe buildings
               if (entity.type === "barrel" && (entity as Barrel).tribe !== this.tribe) {
                  return true;
               }
               if (entity.type === "tribe_totem" && (entity as TribeTotem).tribe !== this.tribe) {
                  return true;
               }
               if (entity.type === "tribe_hut" && (entity as TribeHut).tribe !== this.tribe) {
                  return true;
               }
            }
            
            // Chase enemy tribe members
            if (entity.type === "player" || entity.type === "tribesman") {
               if (this.tribe === null) {
                  return true;
               }
               
               return (entity as TribeMember).tribe !== this.tribe;
            }

            return Tribesman.ENEMY_TARGETS.includes(entity.type);
         },
         callback: (targetEntity: Entity | null) => {
            if (targetEntity === null) return;

            // Equip the best weapon the tribesman has
            const bestWeaponSlot = this.getBestWeaponSlot();
            if (bestWeaponSlot !== null) {
               this.selectedItemSlot = bestWeaponSlot;

               // Don't do a melee attack if using a bow, instead charge the bow
               const selectedItem = this.getComponent("inventory")!.getItem("hotbar", this.selectedItemSlot)!;
               const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];
               if (weaponCategory === "bow") {
                  this.currentAction = TribeMemberAction.charge_bow;

                  // If the bow is fully charged, fire it
                  if (!this.bowCooldowns.hasOwnProperty(this.selectedItemSlot)) {
                     this.useItem(selectedItem, this.selectedItemSlot);
                  }
                  return;
               }
            }

            this.currentAction = TribeMemberAction.none;
            
            this.doMeleeAttack();
         }
      }));

      // AI for healing when missing health
      this.addAI(new MoveAI(this, {
         aiWeightMultiplier: 0.95,
         terminalVelocity: 0,
         acceleration: 0,
         getMoveTargetPosition: () => {
            const healthComponent = this.getComponent("health")!;
            if (healthComponent.getHealth() >= healthComponent.maxHealth) {
               return null;
            }
               
            const foodItemSlot = this.getFoodItemSlot();
            if (foodItemSlot !== null) {
               // @Incomplete: Make a new StopAI so that the tribesman doesn't change rotation when eating
               return new Point(0, 0);
            }
            return null;
         },
         callback: () => {
            const foodItemSlot = this.getFoodItemSlot();
            if (foodItemSlot !== null) {
               this.selectedItemSlot = foodItemSlot;

               // If the food is only just being eaten, reset the food timer so that the food isn't immediately eaten
               if (this.currentAction !== TribeMemberAction.eat) {
                  const foodItem = this.getComponent("inventory")!.getItem("hotbar", foodItemSlot)!;
                  const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
                  this.foodEatingTimer = itemInfo.eatTime;
               }
               
               this.currentAction = TribeMemberAction.eat;
            }
            
            return null;
         }
      }));

      // AI for returning resources to tribe
      this.addAI(new MoveAI(this, {
         aiWeightMultiplier: 0.9,
         terminalVelocity: Tribesman.TERMINAL_VELOCITY,
         acceleration: Tribesman.ACCELERATION,
         getMoveTargetPosition: (): Point | null => {
            if (!this.inventoryIsFull()) return null;

            // Attempt to move to a barrel
            const nearestBarrel = this.findNearestBarrel();
            if (nearestBarrel !== null) {
               return nearestBarrel.position.copy();
            }
            return null;
         },
         callback: () => {
            this.currentAction = TribeMemberAction.none;

            const nearestBarrel = this.findNearestBarrel();
            if (nearestBarrel !== null) {
               const distance = this.position.calculateDistanceBetween(nearestBarrel.position);
               if (distance <= Tribesman.BARREL_DEPOSIT_DISTANCE) {
                  this.depositResources(nearestBarrel);
               }
            }
         }
      }));

      // AI for picking up items
      this.addAI(new ItemChaseAI(this, {
         aiWeightMultiplier: 0.8,
         acceleration: Tribesman.ACCELERATION,
         terminalVelocity: Tribesman.TERMINAL_VELOCITY,
         itemIsChased: (item: DroppedItem): boolean => {
            return this.canPickupItem(item);
         },
         callback: () => {
            this.currentAction = TribeMemberAction.none;
         }
      }));

      // AI for gathering resources
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 0.6,
         terminalVelocity: Tribesman.TERMINAL_VELOCITY,
         acceleration: Tribesman.ACCELERATION,
         desiredDistance: Tribesman.DESIRED_ATTACK_DISTANCE,
         entityIsChased: (entity: Entity): boolean => {
            if (this.inventoryIsFull()) return false;
            
            return Tribesman.RESOURCE_TARGETS.includes(entity.type);
         },
         callback: (targetEntity: Entity | null) => {
            if (targetEntity === null) return;

            this.currentAction = TribeMemberAction.none;

            // Equip the tool for the job
            let bestToolSlot: number | null;
            const attackToolType = getEntityAttackToolType(targetEntity);
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
            }
            
            this.doMeleeAttack();
         }
      }));

      // AI for patrolling tribe area
      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         acceleration: Tribesman.ACCELERATION,
         terminalVelocity: Tribesman.TERMINAL_VELOCITY,
         wanderRate: 0.3,
         shouldWander: (position: Point): boolean => {
            if (this.tribe === null) return true;
            
            const tile = Board.getTileAtPosition(position);
            return this.tribe.tileIsInArea(tile.x, tile.y);
         },
         callback: () => {
            this.currentAction = TribeMemberAction.none;
         }
      }));
   }

   private inventoryIsFull(): boolean {
      return this.getComponent("inventory")!.inventoryIsFull("hotbar");
   }

   private canPickupItem(droppedItem: DroppedItem): boolean {
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
         if (itemCategory === "pickaxe") {
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
}

export default Tribesman;