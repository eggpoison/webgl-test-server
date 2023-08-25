import { EntityType, ItemType, PlayerCauseOfDeath, Point, SETTINGS, TribeType, Vector } from "webgl-test-shared";
import Board from "../../Board";
import Entity from "../Entity";
import InventoryComponent from "../../entity-components/InventoryComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import TRIBE_INFO_RECORD from "webgl-test-shared/lib/tribes";
import Tribe from "../../Tribe";
import TribeHut from "./TribeHut";
import TribeTotem from "./TribeTotem";
import Mob from "../mobs/Mob";
import TribeBuffer from "../../TribeBuffer";
import Barrel from "./Barrel";
import ArmourItem from "../../items/generic/ArmourItem";
import DroppedItem from "../../items/DroppedItem";
import ToolItem from "../../items/generic/ToolItem";
import Item from "../../items/generic/Item";

abstract class TribeMember extends Mob {
   private static readonly DEATH_ITEM_DROP_RANGE = 38;
   
   public readonly tribeType: TribeType;

   public tribe: Tribe | null = null;

   private numFootstepsTaken = 0;

   protected abstract readonly footstepInterval: number;

   private static readonly DEFAULT_ATTACK_KNOCKBACK = 125;

   constructor(position: Point, entityType: EntityType, visionRange: number, isNaturallySpawned: boolean, tribeType: TribeType) {
      const tribeInfo = TRIBE_INFO_RECORD[tribeType];

      const inventoryComponent = new InventoryComponent();
      
      super(position, {
         health: new HealthComponent(tribeInfo.maxHealth, true),
         inventory: inventoryComponent
      }, entityType, visionRange, isNaturallySpawned);

      this.tribeType = tribeType;

      inventoryComponent.createNewInventory("armourSlot", 1, 1, false);

      this.createEvent("hurt", (_1, _2, _3, hitDirection: number | null): void => {
         this.createBloodPoolParticle();

         if (hitDirection !== null) {
            for (let i = 0; i < 10; i++) {
               this.createBloodParticle(hitDirection);
            }
         }
      });

      this.createEvent("on_item_place", (placedItem: Entity): void => {
         if (placedItem.type === "tribe_totem") {
            TribeBuffer.addTribe(this.tribeType, placedItem as TribeTotem, this);
         } else if (placedItem.type === "tribe_hut") {
            if (this.tribe === null) {
               throw new Error("Tribe member didn't belong to a tribe when placing a hut");
            }

            this.tribe.registerNewHut(placedItem as TribeHut);
         }
      });

      // Drop inventory on death
      this.createEvent("death", () => {
         const hotbarInventory = this.getComponent("inventory")!.getInventory("hotbar");
         for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
            if (hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
               const position = this.position.copy();
               const offset = new Vector(TribeMember.DEATH_ITEM_DROP_RANGE * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
               position.add(offset);
               
               const item = hotbarInventory.itemSlots[itemSlot];
               new DroppedItem(position, item);
            }
         }
      });
   }

   public setTribe(tribe: Tribe | null): void {
      if (tribe !== null) {
         tribe.addTribeMember(this);
      }
      this.tribe = tribe;
   }

   public tick(): void {
      super.tick();

      // Footsteps
      if (this.acceleration !== null && this.velocity !== null && Board.tickIntervalHasPassed(this.footstepInterval)) {
         this.createFootprintParticle(this.numFootstepsTaken, 20, 1, 4);

         this.numFootstepsTaken++;
      }

      const inventoryComponent = this.getComponent("inventory")!
      
      // Armour defence
      const armourInventory = inventoryComponent.getInventory("armourSlot");
      if (armourInventory.itemSlots.hasOwnProperty(1)) {
         const armourItem = armourInventory.itemSlots[1] as ArmourItem;
         this.getComponent("health")!.addDefence(armourItem.defence, "armour");
      } else {
         this.getComponent("health")!.removeDefence("armour");
      }

      // Tick items
      const hotbarInventory = inventoryComponent.getInventory("hotbar");
      for (let itemSlot = 1; itemSlot <= hotbarInventory.width; itemSlot++) {
         if (hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
            const item = hotbarInventory.itemSlots[itemSlot];
            if (typeof item.tick !== "undefined") {
               item.tick();
            }
         }
      }
   }

   protected overrideTileMoveSpeedMultiplier(): number | null {
      // If snow armour is equipped, move at normal speed on snow tiles
      const armourInventory = this.getComponent("inventory")!.getInventory("armourSlot");
      if (armourInventory.itemSlots.hasOwnProperty(1) && armourInventory.itemSlots[1].type === "frost_armour") {
         if (this.tile.type === "snow") {
            return 1;
         }
      }
      return null;
   }

   public entityIsFriendly(entity: Entity): boolean {
      if (entity === this) {
         return true;
      }
      
      if (this.tribe === null) {
         return false;
      }
      
      // Buildings of the same tribe are friendly
      if (entity instanceof TribeHut && this.tribe.hasHut(entity)) {
         return true;
      }
      if (entity instanceof TribeTotem && this.tribe.hasTotem(entity)) {
         return true;
      }
      if (entity instanceof Barrel && entity.tribe === this.tribe) {
         return true;
      }

      // Don't attack fellow tribe members
      if (entity instanceof TribeMember && entity.tribe !== null && entity.tribe === this.tribe) {
         return true;
      }

      // Don't attack tribe buildings
      // if (entity.type === "barrel" && (entity as Barrel).tribe === this.tribe) {
      //    return true;
      // }
      // if (entity.type === "tribe_totem" && (entity as TribeTotem).tribe === this.tribe) {
      //    return true;
      // }

      return false;
   }

   protected calculateAttackTarget(targetEntities: ReadonlyArray<Entity>): Entity | null {
      let closestEntity: Entity | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of targetEntities) {
         if (typeof entity === "undefined") continue;

         // Don't attack entities without health components
         if (entity.getComponent("health") === null) continue;

         if (!this.entityIsFriendly(entity)) {
            const dist = this.position.calculateDistanceBetween(entity.position);
            if (dist < minDistance) {
               closestEntity = entity;
               minDistance = dist;
            }
         }
      }

      if (closestEntity === null) return null;

      return closestEntity;
   }

   protected calculateRadialAttackTargets(attackOffset: number, attackRadius: number): ReadonlyArray<Entity> {
      const offset = new Vector(attackOffset, this.rotation);
      const attackPosition = this.position.copy();
      attackPosition.add(offset.convertToPoint());

      const minChunkX = Math.max(Math.min(Math.floor((attackPosition.x - attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((attackPosition.x + attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((attackPosition.y - attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((attackPosition.y + attackRadius) / SETTINGS.CHUNK_SIZE / SETTINGS.TILE_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      // Find all attacked entities
      const attackedEntities = new Array<Entity>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);

            for (const entity of chunk.getEntities()) {
               // Skip entities that are already in the array
               if (attackedEntities.includes(entity)) continue;

               const dist = attackPosition.calculateDistanceBetween(entity.position);
               if (dist <= attackRadius) attackedEntities.push(entity);
            }
         }
      }
      
      // Don't attack yourself
      while (true) {
         const idx = attackedEntities.indexOf(this);
         if (idx !== -1) {
            attackedEntities.splice(idx, 1);
         } else {
            break;
         }
      }

      return attackedEntities;
   }

   /**
    * @param target The entity to attack
    * @param itemSlot The item slot being used to attack the entity
    */
   protected attackEntity(target: Entity, itemSlot: number): void {
      // Find the selected item
      const inventoryComponent = this.getComponent("inventory")!;
      const item = inventoryComponent.getItem("hotbar", itemSlot);

      const attackDamage = this.calculateItemDamage(target, item);
      const attackKnockback = this.calculateItemKnockback(item);

      const hitDirection = this.position.calculateAngleBetween(target.position);

      // Register the hit
      const attackHash = this.id.toString();
      const healthComponent = target.getComponent("health")!; // Attack targets always have a health component
      healthComponent.damage(attackDamage, attackKnockback, hitDirection, this, PlayerCauseOfDeath.tribe_member, attackHash);
      target.getComponent("health")!.addLocalInvulnerabilityHash(attackHash, 0.3);

      if (item !== null && typeof item.damageEntity !== "undefined") {
         item.damageEntity(target);
      }
   }

   private calculateItemDamage(entity: Entity, item: Item | null): number {
      if (item === null) {
         return 1;
      }

      if (item.hasOwnProperty("toolType")) {
         return (item as ToolItem).getAttackDamage(entity);
      }

      return 1;
   }

   private calculateItemKnockback(item: Item | null): number {
      if (item === null) {
         return TribeMember.DEFAULT_ATTACK_KNOCKBACK;
      }

      if (item.hasOwnProperty("toolType")) {
         return (item as ToolItem).knockback;
      }

      return TribeMember.DEFAULT_ATTACK_KNOCKBACK;
   }

   public getArmourItemType(): ItemType | null {
      const armourInventory = this.getComponent("inventory")!.getInventory("armourSlot");

      if (armourInventory.itemSlots.hasOwnProperty(1)) {
         const armourItem = armourInventory.itemSlots[1];
         return armourItem.type;
      } else {
         return null;
      }
   }
}

export default TribeMember;