import { AttackPacket, canCraftRecipe, CraftingRecipe, HitData, InventoryData, ItemData, ItemSlotsData, ItemType, PlayerInventoryData, Point, randFloat, randItem, SETTINGS, TribeType, Vector } from "webgl-test-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Item from "../../items/generic/Item";
import StackableItem from "../../items/generic/StackableItem";
import ToolItem from "../../items/generic/ToolItem";
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

   public readonly username: string;

   private hitsTaken = new Array<HitData>();

   protected footstepInterval = 0.15;

   constructor(position: Point, isNaturallySpawned: boolean, username: string) {
      super(position, "player", 0, isNaturallySpawned, TribeType.plainspeople);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);

      const inventoryComponent = this.getComponent("inventory")!;
      inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
      inventoryComponent.createNewInventory("backpack", 0, 0, true);
      inventoryComponent.createNewInventory("backpackItemSlot", 1, 1, false);
      inventoryComponent.createNewInventory("craftingOutputSlot", 1, 1, false);
      inventoryComponent.createNewInventory("heldItemSlot", 1, 1, false);

      this.username = username;

      this.createEvent("hurt", (_1, _2, knockback: number, hitDirection: number | null): void => {
         this.hitsTaken.push({
            knockback: knockback,
            hitDirection: hitDirection
         });
      });
   }

   public getClientArgs(): [tribeID: number | null, tribeType: TribeType, armour: ItemType | null, displayName: string] {
      return [this.tribe !== null ? this.tribe.id : null, this.tribeType, this.getArmourItemType(), this.username];
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

   public getHitsTaken(): ReadonlyArray<HitData> {
      return this.hitsTaken;
   }

   public clearHitsTaken(): void {
      this.hitsTaken = new Array<HitData>();
   }

   public processCraftingPacket(craftingRecipe: CraftingRecipe): void {
      const inventoryComponent = this.getComponent("inventory")!;
      
      // Don't craft past items' stack size
      const craftingOutputInventory = inventoryComponent.getInventory("craftingOutputSlot");
      const craftingOutputItem = craftingOutputInventory.itemSlots.hasOwnProperty(1) ? craftingOutputInventory.itemSlots[1] : null;
      if (craftingOutputItem !== null && (craftingOutputItem.type !== craftingRecipe.product || !craftingOutputItem.hasOwnProperty("stackSize") || craftingOutputItem.count + craftingRecipe.yield > (craftingOutputItem as StackableItem).stackSize)) {
         return;
      }
      
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

      if (selectedItem !== null && typeof selectedItem.damageEntity !== "undefined") {
         selectedItem.damageEntity(attackTarget);
      }
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
         entityID: this.id,
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
}

export default Player;