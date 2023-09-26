import { AttackPacket, BackpackItemInfo, canCraftRecipe, CRAFTING_RECIPES, CraftingRecipe, ITEM_INFO_RECORD, ItemType, Point, SETTINGS, TribeType, Vector } from "webgl-test-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { getItemStackSize, itemIsStackable } from "../../items/Item";
import DroppedItem from "../../items/DroppedItem";
import Entity from "../Entity";
import Board from "../../Board";
import TribeMember from "./TribeMember";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";

class Player extends TribeMember {
   private static readonly THROWN_ITEM_PICKUP_COOLDOWN = 1;
   private static readonly ITEM_THROW_FORCE = 100;
   private static readonly ITEM_THROW_OFFSET = 32;

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 80;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 60;

   public readonly mass = 1;

   public readonly username: string;

   constructor(position: Point, isNaturallySpawned: boolean, username: string, tribe: Tribe | null) {
      super(position, "player", 0, isNaturallySpawned, TribeType.plainspeople);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(32);
      this.addHitbox(hitbox);

      const inventoryComponent = this.getComponent("inventory")!;
      inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
      inventoryComponent.createNewInventory("backpack", -1, -1, true);
      inventoryComponent.createNewInventory("backpackItemSlot", 1, 1, false);
      inventoryComponent.createNewInventory("craftingOutputSlot", 1, 1, false);
      inventoryComponent.createNewInventory("heldItemSlot", 1, 1, false);

      this.username = username;

      this.tribe = tribe;
   }

   public getClientArgs(): [tribeID: number | null, tribeType: TribeType, armour: ItemType | null, activeItem: ItemType | null, foodEatingType: ItemType | -1, lastAttackTicks: number, lastEatTicks: number, displayName: string] {
      return [
         this.tribe !== null ? this.tribe.id : null,
         this.tribeType,
         this.getArmourItemType(),
         this.getActiveItemType(),
         this.getFoodEatingType(),
         this.lastAttackTicks,
         this.lastEatTicks,
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
      
      const inventoryComponent = this.getComponent("inventory")!;
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
      const playerInventoryComponent = this.getComponent("inventory")!;
      
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
      const playerInventoryComponent = this.getComponent("inventory")!;
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

      // If the player put a backpack into the backpack slot, update their backpack
      if (entityID === this.id && inventoryName === "backpackItemSlot") {
         const itemInfo = ITEM_INFO_RECORD[heldItem.type] as BackpackItemInfo;
         playerInventoryComponent.resizeInventory("backpack", itemInfo.inventoryWidth, itemInfo.inventoryHeight);
      }
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
      const inventoryComponent = this.getComponent("inventory")!;

      const item = inventoryComponent.getItem("hotbar", itemSlot);
      if (item !== null)  {
         this.useItem(item, itemSlot);
      }
   }

   public throwHeldItem(throwDirection: number): void {
      const inventoryComponent = this.getComponent("inventory")!;
      const heldItemInventory = inventoryComponent.getInventory("heldItemSlot");
      if (heldItemInventory.itemSlots.hasOwnProperty(1)) {
         const dropPosition = this.position.copy();
         dropPosition.add(new Vector(Player.ITEM_THROW_OFFSET, throwDirection).convertToPoint());

         // Create the dropped item
         const heldItem = heldItemInventory.itemSlots[1];
         const droppedItem = new DroppedItem(dropPosition, heldItem);

         // Add a pickup cooldown so the item isn't picked up immediately
         droppedItem.addPlayerPickupCooldown(this.id, Player.THROWN_ITEM_PICKUP_COOLDOWN);

         const throwVector = new Vector(Player.ITEM_THROW_FORCE, throwDirection);
         droppedItem.addVelocity(throwVector);
         
         inventoryComponent.removeItemFromInventory("heldItemSlot", 1);
      }
   }

   public setTribe(tribe: Tribe | null): void {
      super.setTribe(tribe);
      
      SERVER.updatePlayerTribe(this, this.tribe);
   }

   public setSelectedItemSlot(selectedItemSlot: number): void {
      this.selectedItemSlot = selectedItemSlot;
   }
}

export default Player;