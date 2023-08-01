import { AttackPacket, canCraftRecipe, CraftingRecipe, HitData, ItemData, ItemSlotData, ItemType, PlaceablePlayerInventoryType, PlayerInventoryData, PlayerInventoryType, Point, SETTINGS, Vector } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Item from "../items/generic/Item";
import StackableItem from "../items/generic/StackableItem";
import ToolItem from "../items/generic/ToolItem";
import { createItem } from "../items/item-creation";
import DroppedItem from "../items/DroppedItem";
import Entity from "./Entity";
import Board from "../Board";

const bundleItemData = (item: Item): ItemData => {
   return {
      type: item.type,
      count: item.count,
      id: item.id
   };
}

const bundleItemSlotData = (itemSlot: Item | null): ItemSlotData => {
   if (itemSlot === null) return null;
   
   return bundleItemData(itemSlot);
}

class Player extends Entity {
   private static readonly MAX_HEALTH = 20;
   private static readonly DEFAULT_KNOCKBACK = 100;

   private static readonly THROWN_ITEM_PICKUP_COOLDOWN = 1;
   private static readonly ITEM_THROW_FORCE = 100;

   public backpackItemSlot: Item | null = null;
   public heldItem: Item | null = null;
   public craftingOutputItem: Item | null = null;

   /** Player nametag. Used when sending player data to the client */
   public readonly displayName: string;

   private hitsTaken = new Array<HitData>();

   constructor(position: Point, isNaturallySpawned: boolean, name: string) {
      const inventoryComponent = new InventoryComponent();

      super(position, {
         health: new HealthComponent(Player.MAX_HEALTH, true),
         inventory: inventoryComponent
      }, "player", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);

      inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE);
      inventoryComponent.createNewInventory("backpack", 0);

      this.displayName = name;

      this.createEvent("hurt", (_1, _2, knockback: number, hitDirection: number | null): void => {
         this.hitsTaken.push({
            knockback: knockback,
            hitDirection: hitDirection
         });
      });
   }

   public getClientArgs(): [displayName: string] {
      return [this.displayName];
   }

   public calculateAttackedEntity(targetEntities: ReadonlyArray<Entity>): Entity | null {
      let closestEntity: Entity | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of targetEntities) {
         if (typeof entity === "undefined") continue;

         // Don't attack entities without health components
         if (entity.getComponent("health") === null) continue;

         const dist = this.position.calculateDistanceBetween(entity.position);
         if (dist < minDistance) {
            closestEntity = entity;
            minDistance = dist;
         }
      }

      if (closestEntity === null) return null;

      return closestEntity;
   }

   public getHitsTaken(): ReadonlyArray<HitData> {
      return this.hitsTaken;
   }

   public clearHitsTaken(): void {
      this.hitsTaken = new Array<HitData>();
   }

   public processCraftingPacket(craftingRecipe: CraftingRecipe): void {
      if (this.craftingOutputItem !== null && (this.craftingOutputItem.type !== craftingRecipe.product || !this.craftingOutputItem.hasOwnProperty("stackSize") || this.craftingOutputItem.count + craftingRecipe.yield > (this.craftingOutputItem as StackableItem).stackSize)) {
         return;
      }
      
      const inventoryComponent = this.getComponent("inventory")!;
      
      const hotbarInventory = inventoryComponent.getInventory("hotbar");
      const backpackInventory = inventoryComponent.getInventory("backpack");

      if (canCraftRecipe([hotbarInventory.itemSlots, backpackInventory.itemSlots], craftingRecipe, SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE)) {
         // Consume ingredients
         for (const [ingredientType, ingredientCount] of Object.entries(craftingRecipe.ingredients) as ReadonlyArray<[ItemType, number]>) {
            // Prioritise consuming ingredients from the backpack inventory first
            const amountConsumedFromBackpackInventory = inventoryComponent.consumeItemTypeFromInventory("backpack", ingredientType, ingredientCount);

            // Consume the rest from the hotbar
            const remainingAmountToConsume = ingredientCount - amountConsumedFromBackpackInventory;
            inventoryComponent.consumeItemTypeFromInventory("hotbar", ingredientType, remainingAmountToConsume);
         }

         // Add product to held item
         if (this.craftingOutputItem === null) {
            const item = createItem(craftingRecipe.product, craftingRecipe.yield);
            this.craftingOutputItem = item;
         } else {
            this.craftingOutputItem.count += craftingRecipe.yield;
         }
      }
   }

   public processItemPickupPacket(inventoryType: PlayerInventoryType, itemSlot: number, amount: number): void {
      // Don't pick up the item if there is already a held item
      if (this.heldItem !== null) return;

      const inventoryComponent = this.getComponent("inventory")!;
      
      // Find which item is being picked up
      let pickedUpItem: Item | null;
      switch (inventoryType) {
         case "hotbar": {
            pickedUpItem = inventoryComponent.getItem("hotbar", itemSlot);
            break;
         }
         case "backpackInventory": {
            pickedUpItem = inventoryComponent.getItem("backpack", itemSlot);
            break;
         }
         case "craftingOutput": {
            pickedUpItem = this.craftingOutputItem;
            break;
         }
         case "backpackItemSlot": {
            pickedUpItem = this.backpackItemSlot;
            break;
         }
      }

      if (pickedUpItem === null) return;

      // Hold the item
      this.heldItem = createItem(pickedUpItem.type, amount);

      // Remove the item from its previous inventory
      switch (inventoryType) {
         case "hotbar": {
            inventoryComponent.consumeItem("hotbar", itemSlot, amount);
            break;
         }
         case "backpackInventory": {
            inventoryComponent.consumeItem("backpack", itemSlot, amount);
            break;
         }
         case "craftingOutput": {
            this.craftingOutputItem = null;
            break;
         }
         case "backpackItemSlot": {
            this.backpackItemSlot = null;
            break;
         }
      }
   }

   public processItemReleasePacket(inventoryType: PlaceablePlayerInventoryType, itemSlot: number, amount: number): void {
      // Don't release an item if there is no held item
      if (this.heldItem === null) return;

      const inventoryComponent = this.getComponent("inventory")!;

      // Add the item to the inventory
      let amountAdded: number;
      switch (inventoryType) {
         case "hotbar": {
            amountAdded = inventoryComponent.addItemToSlot("hotbar", itemSlot, this.heldItem.type, amount)
            break;
         }
         case "backpackInventory": {
            amountAdded = inventoryComponent.addItemToSlot("backpack", itemSlot, this.heldItem.type, amount)
            break;
         }
         case "backpackItemSlot": {
            if (this.backpackItemSlot === null) {
               this.backpackItemSlot = this.heldItem;
               amountAdded = 1;
            } else {
               amountAdded = 0;
            }
         }
      }

      // If all of the item was added, clear the held item
      if (amountAdded === this.heldItem.count) {
         this.heldItem = null;
      } else {
         // Otherwise remove the amount from the held item
         this.heldItem.count -= amountAdded;
      }
   }

   public processAttackPacket(attackPacket: AttackPacket): void {
      // Calculate the attack's target entity
      const targetEntities = attackPacket.targetEntities.map(id => Board.entities[id]);
      const attackTarget = this.calculateAttackedEntity(targetEntities);
      // Don't attack if the attack didn't hit anything
      if (attackTarget === null) return;

      const inventoryComponent = this.getComponent("inventory")!;

      // Find the selected item
      const selectedItem = inventoryComponent.getItem("hotbar", attackPacket.itemSlot);
      const selectedItemIsTool = selectedItem !== null && selectedItem.hasOwnProperty("toolType");

      let attackDamage: number;
      let attackKnockback: number;
      if (selectedItemIsTool) {
         attackDamage = (selectedItem as ToolItem).getAttackDamage(attackTarget);
         attackKnockback = (selectedItem as ToolItem).knockback;
      } else {
         attackDamage = 1;
         attackKnockback = Player.DEFAULT_KNOCKBACK;
      }

      // Register the hit
      const attackHash = this.id.toString();
      const healthComponent = attackTarget.getComponent("health")!; // Attack targets always have a health component
      healthComponent.damage(attackDamage, attackKnockback, attackPacket.attackDirection, this, attackHash);
      attackTarget.getComponent("health")!.addLocalInvulnerabilityHash(attackHash, 0.3);
   }

   public processItemUsePacket(itemSlot: number): void {
      const inventoryComponent = this.getComponent("inventory")!;

      const item = inventoryComponent.getItem("hotbar", itemSlot);
      if (item === null) return;

      if (typeof item.use !== "undefined") {
         item.use(this, "hotbar");
      }
   }

   public throwHeldItem(throwDirection: number): void {
      if (this.heldItem !== null) {
         // Create the dropped item
         const droppedItem = new DroppedItem(this.position.copy(), this.heldItem);

         // Add a pickup cooldown so the item isn't picked up immediately
         droppedItem.addPlayerPickupCooldown(this.displayName, Player.THROWN_ITEM_PICKUP_COOLDOWN);

         const throwVector = new Vector(Player.ITEM_THROW_FORCE, throwDirection);
         droppedItem.addVelocity(throwVector);
         
         this.heldItem = null;
      }
   }

   /**
    * Bundles the player's items into a format which can be transferred between the server and client.
    */
   public bundleInventoryData(): PlayerInventoryData {
      const inventoryData: PlayerInventoryData = {
         hotbar: {},
         backpackInventory: {},
         backpackSlot: bundleItemSlotData(this.backpackItemSlot),
         heldItemSlot: bundleItemSlotData(this.heldItem),
         craftingOutputItemSlot: bundleItemSlotData(this.craftingOutputItem)
      };

      const inventoryComponent = this.getComponent("inventory")!;

      const hotbarInventory = inventoryComponent.getInventory("hotbar");
      for (const [itemSlot, item] of Object.entries(hotbarInventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
         inventoryData.hotbar[itemSlot] = bundleItemData(item);
      }

      const backpackInventory = inventoryComponent.getInventory("backpack");
      for (const [itemSlot, item] of Object.entries(backpackInventory.itemSlots) as unknown as ReadonlyArray<[number, Item]>) {
         inventoryData.backpackInventory[itemSlot] = bundleItemData(item);
      }

      return inventoryData;
   }
}

export default Player;