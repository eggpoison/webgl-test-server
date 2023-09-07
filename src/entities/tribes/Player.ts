import { AttackPacket, canCraftRecipe, CraftingRecipe, InventoryData, ItemData, ItemType, PlayerInventoryData, Point, SETTINGS, TribeType, Vector } from "webgl-test-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Item, { getItemStackSize } from "../../items/Item";
import DroppedItem from "../../items/DroppedItem";
import Entity from "../Entity";
import Board from "../../Board";
import TribeMember from "./TribeMember";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";

const bundleItemData = (item: Item): ItemData => {
   return {
      type: item.type,
      count: item.count,
      id: item.id
   };
}

class Player extends TribeMember {
   private static readonly DEFAULT_KNOCKBACK = 100;

   private static readonly THROWN_ITEM_PICKUP_COOLDOWN = 1;
   private static readonly ITEM_THROW_FORCE = 100;
   private static readonly ITEM_THROW_OFFSET = 32;

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 80;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 60;

   public readonly mass = 1;

   public readonly username: string;

   protected footstepInterval = 0.15;

   constructor(position: Point, isNaturallySpawned: boolean, username: string, tribe: Tribe | null) {
      super(position, "player", 0, isNaturallySpawned, TribeType.plainspeople);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(32);
      this.addHitbox(hitbox);

      const inventoryComponent = this.getComponent("inventory")!;
      inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
      inventoryComponent.createNewInventory("backpack", 0, 0, true);
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

   public processCraftingPacket(craftingRecipe: CraftingRecipe): void {
      const inventoryComponent = this.getComponent("inventory")!;
      
      // Don't craft past items' stack size
      const craftingOutputInventory = inventoryComponent.getInventory("craftingOutputSlot");
      const craftingOutputItem = craftingOutputInventory.itemSlots.hasOwnProperty(1) ? craftingOutputInventory.itemSlots[1] : null;
      if (craftingOutputItem !== null && (craftingOutputItem.type !== craftingRecipe.product || !craftingOutputItem.hasOwnProperty("stackSize") || craftingOutputItem.count + craftingRecipe.yield > getItemStackSize(craftingOutputItem))) {
         return;
      }
      
      const hotbarInventory = inventoryComponent.getInventory("hotbar");
      const backpackInventory = inventoryComponent.getInventory("backpack");

      if (canCraftRecipe([hotbarInventory.itemSlots, backpackInventory.itemSlots], craftingRecipe, SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE)) {
         // Consume ingredients
         for (const [ingredientType, ingredientCount] of Object.entries(craftingRecipe.ingredients) as unknown as ReadonlyArray<[ItemType, number]>) {
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

   /**
    * Bundles the player's items into a format which can be transferred between the server and client.
    */
   public bundleInventoryData(): PlayerInventoryData {
      const inventoryData: PlayerInventoryData = {
         hotbar: this.bundleInventory("hotbar"),
         backpackInventory: this.bundleInventory("backpack"),
         backpackSlot: this.bundleInventory("backpackItemSlot"),
         heldItemSlot: this.bundleInventory("heldItemSlot"),
         craftingOutputItemSlot: this.bundleInventory("craftingOutputSlot"),
         armourSlot: this.bundleInventory("armourSlot")
      };

      return inventoryData;
   }

   private bundleInventory(inventoryName: string): InventoryData {
      const inventory = this.getComponent("inventory")!.getInventory(inventoryName);

      const inventoryData: InventoryData = {
         itemSlots: {},
         width: inventory.width,
         height: inventory.height,
         inventoryName: inventoryName
      };
      for (const [itemSlot, item] of Object.entries(inventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
         inventoryData.itemSlots[itemSlot] = bundleItemData(item);
      }
      return inventoryData;
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