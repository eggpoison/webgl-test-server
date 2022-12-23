import { AttackPacket, canCraftRecipe, CraftingRecipe, HitboxType, HitData, ItemType, PlaceablePlayerInventoryType, PlayerInventoryType, Point, ServerItemData, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Hitbox from "../hitboxes/Hitbox";
import Item from "../items/generic/Item";
import StackableItem from "../items/generic/StackableItem";
import { createItem } from "../items/item-creation";
import { SERVER } from "../server";
import Entity from "./Entity";

type PlayerAttackInfo = {
   readonly target: Entity;
   readonly angle: number;
}

class Player extends Entity {
   private static readonly MAX_HEALTH = 20;

   public craftingOutputItem: Item | null = null;
   public heldItem: Item | null = null;

   public readonly type = "player";

   /** Player nametag. Used when sending player data to the client */
   private readonly displayName: string;

   private hitsTaken = new Array<HitData>();

   constructor(position: Point, name: string) {
      super(position, new Set<Hitbox<HitboxType>>([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]), {
         health: new HealthComponent(Player.MAX_HEALTH, true),
         inventory: new InventoryComponent(SETTINGS.PLAYER_HOTBAR_SIZE)
      });

      this.displayName = name;

      this.createEvent("hurt", (damage: number, attackingEntity: Entity | null) => {
         const hitData: HitData = {
            damage: damage,
            angleFromDamageSource: attackingEntity !== null ? this.position.calculateAngleBetween(attackingEntity.position) + Math.PI : null
         };
         this.hitsTaken.push(hitData);
      });
   }

   public getClientArgs(): [displayName: string] {
      return [this.displayName];
   }

   public calculateAttackedEntity(targetEntities: ReadonlyArray<Entity>): PlayerAttackInfo | null {
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

      return {
         target: closestEntity,
         angle: this.position.calculateDistanceBetween(closestEntity.position)
      };
   }

   public getHitsTaken(): ReadonlyArray<HitData> {
      return this.hitsTaken;
   }

   public clearHitsTaken(): void {
      this.hitsTaken = new Array<HitData>();
   }

   public processCraftingPacket(craftingRecipe: CraftingRecipe): void {
      if (this.craftingOutputItem !== null && (this.craftingOutputItem.type !== craftingRecipe.product || !this.craftingOutputItem.hasOwnProperty("stackSize") || this.craftingOutputItem.count + craftingRecipe.productCount > (this.craftingOutputItem as StackableItem).stackSize)) {
         return;
      }
      
      const inventoryComponent = this.getComponent("inventory")!;
      
      if (canCraftRecipe(inventoryComponent.getInventory(), craftingRecipe, SETTINGS.PLAYER_HOTBAR_SIZE)) {
         // Consume ingredients
         for (const [ingredientType, ingredientCount] of Object.entries(craftingRecipe.ingredients) as ReadonlyArray<[ItemType, number]>) {
            inventoryComponent.consumeItemType(ingredientType, ingredientCount);
         }

         // Add product to held item
         if (this.craftingOutputItem === null) {
            const item = createItem(craftingRecipe.product, craftingRecipe.productCount);
            this.craftingOutputItem = item;
         } else {
            this.craftingOutputItem.count += craftingRecipe.productCount;
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
            item = inventoryComponent.getItem(itemSlot);
            break;
         }
         case "craftingOutput": {
            item = this.craftingOutputItem;
            break;
         }
      }

      if (item === null) return;

      // Hold the item
      this.heldItem = item;

      // Remove the item from its previous inventory
      switch (inventoryType) {
         case "hotbar": {
            inventoryComponent.setItem(itemSlot, null);
            break;
         }
         case "craftingOutput": {
            this.craftingOutputItem = null;
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
            inventoryComponent.setItem(itemSlot, this.heldItem);
            break;
         }
      }

      // Clear the held item
      this.heldItem = null;
   }

   public processAttackPacket(attackPacket: AttackPacket): void {
      // Calculate the attack's target entity
      const targetEntities = attackPacket.targetEntities.map(id => SERVER.board.entities[id]);
      const targetInfo = this.calculateAttackedEntity(targetEntities);
      // Don't attack if the attack didn't hit anything
      if (targetInfo === null) return;

      // Find the selected item
      const selectedItem = this.getComponent("inventory")!.getItem(attackPacket.itemSlot);

      let damage: number;
      if (selectedItem !== null) {
         damage = selectedItem.getAttackDamage();
      } else {
         damage = 1;
      }

      // Register the hit
      const attackHash = this.id.toString();
      targetInfo.target.takeDamage(damage, this, attackHash);
      targetInfo.target.getComponent("health")!.addLocalInvulnerabilityHash(attackHash, 0.3);
   }

   public processItemUsePacket(itemSlot: number): void {
      const item = this.getComponent("inventory")!.getItem(itemSlot);
      if (item === null) return;

      if (typeof item.use !== "undefined") {
         item.use(this);
      }
   }
}

export default Player;