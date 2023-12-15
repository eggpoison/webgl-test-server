import { AttackPacket, BowItemInfo, canCraftRecipe, COLLISION_BITS, CRAFTING_RECIPES, DEFAULT_COLLISION_MASK, EntityTypeConst, FoodItemInfo, InventoryData, ITEM_INFO_RECORD, ItemType, Point, SETTINGS, TribeMemberAction, TribeType, Vector } from "webgl-test-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Item, { getItemStackSize, itemIsStackable } from "../../items/Item";
import DroppedItem from "../../items/DroppedItem";
import Entity from "../Entity";
import Board from "../../Board";
import TribeMember from "./TribeMember";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";
import { serializeInventoryData } from "../../entity-components/InventoryComponent";

class Player extends TribeMember {
   private static readonly THROWN_ITEM_PICKUP_COOLDOWN = 1;
   private static readonly ITEM_THROW_FORCE = 100;
   private static readonly ITEM_THROW_OFFSET = 32;

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 50;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 50;

   public readonly mass = 1;

   public readonly username: string;

   public interactingEntityID: number | null = null;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point, username: string, tribe: Tribe | null) {
      super(position, EntityTypeConst.player, 0, TribeType.plainspeople);

      const hitbox = new CircularHitbox(this, 0, 0, 32);
      this.addHitbox(hitbox);

      const inventoryComponent = this.forceGetComponent("inventory");
      inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
      inventoryComponent.createNewInventory("craftingOutputSlot", 1, 1, false);
      inventoryComponent.createNewInventory("heldItemSlot", 1, 1, false);

      this.username = username;

      this.tribe = tribe;

      this.createEvent("during_dropped_item_collision", (droppedItem: DroppedItem): void => {
         const wasPickedUp = this.forceGetComponent("inventory").pickupDroppedItem(droppedItem);
         if (wasPickedUp) {
            SERVER.registerPlayerDroppedItemPickup(this);
         }
      });
   }

   public getClientArgs(): [tribeID: number | null, tribeType: TribeType, armourSlotInventory: InventoryData, backpackSlotInventory: InventoryData, backpackInventory: InventoryData, activeItem: ItemType | null, action: TribeMemberAction, foodEatingType: ItemType | -1, lastActionTicks: number, hasFrostShield: boolean, warPaintType: number, username: string] {
      const inventoryComponent = this.forceGetComponent("inventory");
      
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
         this.username
      ];
   }

   public calculateAttackedEntity(targetEntities: ReadonlyArray<Entity>): Entity | null {
      let closestEntity: Entity | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of targetEntities) {
         if (typeof entity === "undefined") continue;

         // Don't attack entities without health components
         if (entity.getComponent("health") === null) continue;

         // Don't attack fellow tribe members
         if (this.tribe !== null && entity instanceof TribeMember && entity.tribe !== null && entity.tribe === this.tribe) {
            continue;
         }

         const dist = this.position.calculateDistanceBetween(entity.position);
         if (dist < minDistance) {
            closestEntity = entity;
            minDistance = dist;
         }
      }

      if (closestEntity === null) return null;

      return closestEntity;
   }

   public processCraftingPacket(recipeIndex: number): void {
      if (recipeIndex < 0 || recipeIndex >= CRAFTING_RECIPES.length) {
         return;
      }
      
      const inventoryComponent = this.forceGetComponent("inventory");
      const craftingRecipe = CRAFTING_RECIPES[recipeIndex];
      
      // Don't craft past items' stack size
      const craftingOutputInventory = inventoryComponent.getInventory("craftingOutputSlot");
      if (craftingOutputInventory.itemSlots.hasOwnProperty(1)) {
         const craftingOutputItem = craftingOutputInventory.itemSlots[1];
         if ((craftingOutputItem.type !== craftingRecipe.product || !itemIsStackable(craftingOutputItem.type) || craftingOutputItem.count + craftingRecipe.yield > getItemStackSize(craftingOutputItem))) {
            return;
         }
      }
      
      const hotbarInventory = inventoryComponent.getInventory("hotbar");
      const backpackInventory = inventoryComponent.getInventory("backpack");

      // @Speed: Garbage collection
      if (canCraftRecipe([hotbarInventory.itemSlots, backpackInventory.itemSlots], craftingRecipe)) {
         // Consume ingredients
         for (const [ingredientType, ingredientCount] of Object.entries(craftingRecipe.ingredients).map(entry => [Number(entry[0]), entry[1]]) as ReadonlyArray<[ItemType, number]>) {
            // Prioritise consuming ingredients from the backpack inventory first
            const amountConsumedFromBackpackInventory = inventoryComponent.consumeItemTypeFromInventory("backpack", ingredientType, ingredientCount);

            // Consume the rest from the hotbar
            const remainingAmountToConsume = ingredientCount - amountConsumedFromBackpackInventory;
            inventoryComponent.consumeItemTypeFromInventory("hotbar", ingredientType, remainingAmountToConsume);
         }

         // Add product to held item
         inventoryComponent.addItemToSlot("craftingOutputSlot", 1, craftingRecipe.product, craftingRecipe.yield);
      }
   }

   public processItemPickupPacket(entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
      const playerInventoryComponent = this.forceGetComponent("inventory");
      
      // Don't pick up the item if there is already a held item
      if (playerInventoryComponent.getInventory("heldItemSlot").itemSlots.hasOwnProperty(1)) {
         return;
      }

      if (!Board.entities.hasOwnProperty(entityID)) {
         return;
      }

      const inventoryComponent = Board.entities[entityID].getComponent("inventory");
      if (inventoryComponent === null) {
         throw new Error(`Entity with id '${entityID}' didn't have an inventory component.`);
      }

      const pickedUpItem = inventoryComponent.getItem(inventoryName, itemSlot);
      if (pickedUpItem === null) return;

      // Hold the item
      playerInventoryComponent.addItemToSlot("heldItemSlot", 1, pickedUpItem.type, amount);

      // Remove the item from its previous inventory
      inventoryComponent.consumeItem(inventoryName, itemSlot, amount);
   }

   public processItemReleasePacket(entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
      const playerInventoryComponent = this.forceGetComponent("inventory");
      const heldItemInventory = playerInventoryComponent.getInventory("heldItemSlot");
      // Don't release an item if there is no held item
      if (!heldItemInventory.itemSlots.hasOwnProperty(1)) return;
      
      if (!Board.entities.hasOwnProperty(entityID)) {
         return;
      }

      const inventoryComponent = Board.entities[entityID].getComponent("inventory");
      if (inventoryComponent === null) {
         throw new Error(`Entity with id '${entityID}' didn't have an inventory component.`);
      }

      const heldItem = heldItemInventory.itemSlots[1];
      
      // Add the item to the inventory
      const amountAdded = inventoryComponent.addItemToSlot(inventoryName, itemSlot, heldItem.type, amount);

      // If all of the item was added, clear the held item
      playerInventoryComponent.consumeItemTypeFromInventory("heldItemSlot", heldItem.type, amountAdded);
   }

   public processAttackPacket(attackPacket: AttackPacket): void {
      // Find the attack target
      const attackTargets = this.calculateRadialAttackTargets(Player.ATTACK_OFFSET, Player.ATTACK_RADIUS);
      const target = this.calculateAttackTarget(attackTargets);

      // Register the hit
      if (target !== null) {
         this.attackEntity(target, attackPacket.itemSlot);
      }
   }

   public processItemUsePacket(itemSlot: number): void {
      const inventoryComponent = this.forceGetComponent("inventory");

      const item = inventoryComponent.getItem("hotbar", itemSlot);
      if (item !== null)  {
         this.useItem(item, itemSlot);
      }
   }

   public dropItem(inventoryName: string, itemSlot: number, dropAmount: number, throwDirection: number): void {
      const inventoryComponent = this.forceGetComponent("inventory");
      const inventory = inventoryComponent.getInventory(inventoryName);
      if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
         return;
      }
      
      const itemType = inventory.itemSlots[itemSlot].type;
      const amountRemoved = inventoryComponent.consumeItem(inventoryName, itemSlot, dropAmount);

      const dropPosition = this.position.copy();
      dropPosition.x += Player.ITEM_THROW_OFFSET * Math.sin(throwDirection);
      dropPosition.y += Player.ITEM_THROW_OFFSET * Math.cos(throwDirection);

      // Create the dropped item
      const item = new Item(itemType, amountRemoved);
      const droppedItem = new DroppedItem(dropPosition, item);

      // Add a pickup cooldown so the item isn't picked up immediately
      droppedItem.addPlayerPickupCooldown(this.id, Player.THROWN_ITEM_PICKUP_COOLDOWN);

      // Throw the dropped item away from the player
      droppedItem.velocity.x += Player.ITEM_THROW_FORCE * Math.sin(throwDirection);
      droppedItem.velocity.y += Player.ITEM_THROW_FORCE * Math.cos(throwDirection);
   }

   public setTribe(tribe: Tribe | null): void {
      super.setTribe(tribe);
      
      SERVER.updatePlayerTribe(this, this.tribe);
   }

   public setSelectedItemSlot(selectedItemSlot: number): void {
      this.selectedItemSlot = selectedItemSlot;
   }

   public startEating(): void {
      // Reset the food timer so that the food isn't immediately eaten
      const foodItem = this.forceGetComponent("inventory").getItem("hotbar", this.selectedItemSlot);
      if (foodItem !== null) {
         const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
         this.foodEatingTimer = itemInfo.eatTime;
      }
      
      this.currentAction = TribeMemberAction.eat;
   }

   public startChargingBow(): void {
      // Reset the cooldown so the bow doesn't fire immediately
      const bow = this.forceGetComponent("inventory").getItem("hotbar", this.selectedItemSlot);
      if (bow !== null) {
         const itemInfo = ITEM_INFO_RECORD[bow.type] as BowItemInfo;
         this.bowCooldownTicks = itemInfo.shotCooldownTicks;
         this.lastBowChargeTicks = Board.ticks;
      }
      
      this.currentAction = TribeMemberAction.eat;
   }
}

export default Player;