import { AttackPacket, canCraftRecipe, CraftingRecipe, HitData, ItemData, ItemSlotData, ItemType, PlaceablePlayerInventoryType, PlayerInventoryData, PlayerInventoryType, Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Item from "../items/generic/Item";
import StackableItem from "../items/generic/StackableItem";
import ToolItem from "../items/generic/ToolItem";
import { createItem } from "../items/item-creation";
import ItemEntity from "../items/ItemEntity";
import { SERVER } from "../server";
import Entity from "./Entity";

const bundleItemData = (item: Item): ItemData => {
   return {
      type: item.type,
      count: item.count
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

   constructor(position: Point, name: string) {
      const inventoryComponent = new InventoryComponent();

      super(position, {
         health: new HealthComponent(Player.MAX_HEALTH, true),
         inventory: inventoryComponent
      }, "player");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);

      inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE);
      inventoryComponent.createNewInventory("backpack", 0);

      this.displayName = name;

      this.createEvent("hurt", (_damage: number, knockback: number, _attackDirection: number, attackingEntity: Entity | null) => {
         if (knockback !== 0) {
            const hitData: HitData = {
               knockback: knockback,
               angleFromDamageSource: attackingEntity !== null ? this.position.calculateAngleBetween(attackingEntity.position) + Math.PI : 0
            };
            this.hitsTaken.push(hitData);
         }
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

   public processItemHoldPacket(inventoryType: PlayerInventoryType, itemSlot: number): void {
      // Don't pick up the item if there is already a held item
      if (this.heldItem !== null) return;

      const inventoryComponent = this.getComponent("inventory")!;
      
      // Find which item is being held
      let item: Item | null;
      switch (inventoryType) {
         case "hotbar": {
            item = inventoryComponent.getItem("hotbar", itemSlot);
            break;
         }
         case "backpackInventory": {
            item = inventoryComponent.getItem("backpack", itemSlot);
            break;
         }
         case "craftingOutput": {
            item = this.craftingOutputItem;
            break;
         }
         case "backpackItemSlot": {
            item = this.backpackItemSlot;
            break;
         }
      }

      if (item === null) return;

      // Hold the item
      this.heldItem = item;

      // Remove the item from its previous inventory
      switch (inventoryType) {
         case "hotbar": {
            inventoryComponent.setItem("hotbar", itemSlot, null);
            break;
         }
         case "backpackInventory": {
            inventoryComponent.setItem("backpack", itemSlot, null);
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

   public processItemReleasePacket(inventoryType: PlaceablePlayerInventoryType, itemSlot: number): void {
      // Don't release an item if there is no held item
      if (this.heldItem === null) return;

      const inventoryComponent = this.getComponent("inventory")!;

      // Add the item to the inventory
      switch (inventoryType) {
         case "hotbar": {
            inventoryComponent.setItem("hotbar", itemSlot, this.heldItem);
            break;
         }
         case "backpackInventory": {
            inventoryComponent.setItem("backpack", itemSlot, this.heldItem);
            break;
         }
         case "backpackItemSlot": {
            this.backpackItemSlot = this.heldItem;
         }
      }

      // Clear the held item
      this.heldItem = null;
   }

   public processAttackPacket(attackPacket: AttackPacket): void {
      // Calculate the attack's target entity
      const targetEntities = attackPacket.targetEntities.map(id => SERVER.board.entities[id]);
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
      attackTarget.takeDamage(attackDamage, attackKnockback, attackPacket.attackDirection, this, attackHash);
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
         // Create the item entity
         const itemEntity = new ItemEntity(this.position.copy(), this.heldItem);

         // Add a pickup cooldown so the item isn't picked up immediately
         itemEntity.addPlayerPickupCooldown(this.displayName, Player.THROWN_ITEM_PICKUP_COOLDOWN);

         itemEntity.addVelocity(Player.ITEM_THROW_FORCE, throwDirection);
         
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
         backpackItemSlot: bundleItemSlotData(this.backpackItemSlot),
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