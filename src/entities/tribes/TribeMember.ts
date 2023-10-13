import { ArmourItemInfo, AxeItemInfo, BackpackItemInfo, BowItemInfo, EntityType, FoodItemInfo, HitFlags, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, ItemType, PlaceableItemInfo, PlaceableItemType, PlayerCauseOfDeath, Point, ProjectileType, RESOURCE_ENTITY_TYPES, SETTINGS, StatusEffect, SwordItemInfo, TRIBE_INFO_RECORD, TileType, ToolItemInfo, TribeMemberAction, TribeType, Vector, lerp } from "webgl-test-shared";
import Board from "../../Board";
import Entity from "../Entity";
import InventoryComponent from "../../entity-components/InventoryComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import Tribe from "../../Tribe";
import TribeHut from "./TribeHut";
import TribeTotem from "./TribeTotem";
import Mob from "../mobs/Mob";
import TribeBuffer from "../../TribeBuffer";
import Barrel from "./Barrel";
import DroppedItem from "../../items/DroppedItem";
import Item from "../../items/Item";
import Hitbox from "../../hitboxes/Hitbox";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Projectile from "../../Projectile";
import Workbench from "../Workbench";
import Campfire from "../Campfire";
import Furnace from "../Furnace";
import { getEntitiesInVisionRange } from "../../ai-shared";

const pickaxeDamageableEntities: ReadonlyArray<EntityType> = ["boulder", "tombstone", "ice_spikes"];
const axeDamageableEntities: ReadonlyArray<EntityType> = ["tree"];

export enum AttackToolType {
   weapon,
   pickaxe,
   axe
}

export function getEntityAttackToolType(entity: Entity): AttackToolType {
   if (entity instanceof Mob || entity.hasOwnProperty("tribe") || entity.type === "berry_bush" || entity.type === "cactus" || entity.type === "snowball") {
      return AttackToolType.weapon;
   }
   if (pickaxeDamageableEntities.includes(entity.type)) {
      return AttackToolType.pickaxe;
   }
   if (axeDamageableEntities.includes(entity.type)) {
      return AttackToolType.axe;
   }
   throw new Error(`Can't find action tool type for entity type '${entity.type}'.`);
}

enum PlaceableItemHitboxType {
   circular = 0,
   rectangular = 1
}

interface PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType;
   readonly placeOffset: number;
}

interface PlaceableItemCircularHitboxInfo extends PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType.circular;
   readonly radius: number;
}

interface PlaceableItemRectangularHitboxInfo extends PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType.rectangular;
   readonly width: number;
   readonly height: number;
}

const PLACEABLE_ITEM_HITBOX_INFO: Record<PlaceableItemType, PlaceableItemCircularHitboxInfo | PlaceableItemRectangularHitboxInfo> = {
   [ItemType.workbench]: {
      type: PlaceableItemHitboxType.rectangular,
      width: Workbench.SIZE,
      height: Workbench.SIZE,
      placeOffset: Workbench.SIZE / 2
   },
   [ItemType.tribe_totem]: {
      type: PlaceableItemHitboxType.circular,
      radius: TribeTotem.SIZE / 2,
      placeOffset: TribeTotem.SIZE / 2
   },
   [ItemType.tribe_hut]: {
      type: PlaceableItemHitboxType.rectangular,
      width: TribeHut.SIZE,
      height: TribeHut.SIZE,
      placeOffset: TribeHut.SIZE / 2
   },
   [ItemType.barrel]: {
      type: PlaceableItemHitboxType.circular,
      radius: TribeHut.SIZE / 2,
      placeOffset: TribeHut.SIZE / 2
   },
   [ItemType.campfire]: {
      type: PlaceableItemHitboxType.rectangular,
      width: Campfire.SIZE,
      height: Campfire.SIZE,
      placeOffset: Campfire.SIZE / 2
   },
   [ItemType.furnace]: {
      type: PlaceableItemHitboxType.rectangular,
      width: Furnace.SIZE,
      height: Furnace.SIZE,
      placeOffset: Furnace.SIZE / 2
   }
};

function assertItemTypeIsPlaceable(itemType: ItemType): asserts itemType is PlaceableItemType {
   if (!PLACEABLE_ITEM_HITBOX_INFO.hasOwnProperty(itemType)) {
      throw new Error(`Entity type '${itemType}' is not placeable.`);
   }
}

/** Relationships a tribe member can have, in increasing order of threat */
export enum EntityRelationship {
   friendly,
   neutral,
   resource,
   hostileMob,
   enemyBuilding,
   enemy
}

abstract class TribeMember extends Entity {
   private static readonly testRectangularHitbox = new RectangularHitbox();
   private static readonly testCircularHitbox = new CircularHitbox();

   private static readonly ARROW_WIDTH = 20;
   private static readonly ARROW_HEIGHT = 64;
   private static readonly ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(TribeMember.ARROW_WIDTH / 2, 2) + Math.pow(TribeMember.ARROW_HEIGHT, 2));
   
   private static readonly DEATH_ITEM_DROP_RANGE = 38;
   
   private static readonly DEFAULT_ATTACK_KNOCKBACK = 125;

   private static readonly DEEP_FROST_ARMOUR_IMMUNITY_TIME = 20;

   private static readonly HOSTILE_MOB_TYPES: ReadonlyArray<EntityType> = ["yeti", "frozen_yeti", "zombie", "slime"];

   public readonly tribeType: TribeType;
   public tribe: Tribe | null = null;

   protected selectedItemSlot = 1;

   public currentAction = TribeMemberAction.none;
   protected foodEatingTimer = 0;

   protected lastAttackTicks = -99999;
   protected lastEatTicks = -99999;
   protected lastBowChargeTicks = -99999;

   protected bowCooldowns: Record<number, number> = {};

   public immunityTimer = 0;

   constructor(position: Point, entityType: EntityType, visionRange: number, tribeType: TribeType) {
      const tribeInfo = TRIBE_INFO_RECORD[tribeType];

      const inventoryComponent = new InventoryComponent();
      
      super(position, {
         // @Temporary
         // health: new HealthComponent(entityType === "tribesman" ? 10 : tribeInfo.maxHealth, true),
         health: new HealthComponent(tribeInfo.maxHealth, true),
         inventory: inventoryComponent
      }, entityType);

      this.tribeType = tribeType;

      inventoryComponent.createNewInventory("armourSlot", 1, 1, false);
      inventoryComponent.createNewInventory("backpackSlot", 1, 1, false);
      inventoryComponent.createNewInventory("backpack", -1, -1, false);

      // Drop inventory on death
      this.createEvent("death", () => {
         const hotbarInventory = this.forceGetComponent("inventory").getInventory("hotbar");
         for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
            if (hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
               const position = this.position.copy();

               const spawnOffsetMagnitude = TribeMember.DEATH_ITEM_DROP_RANGE * Math.random();
               const spawnOffsetDirection = 2 * Math.PI * Math.random();
               position.x += spawnOffsetMagnitude * Math.sin(spawnOffsetDirection);
               position.y += spawnOffsetMagnitude * Math.cos(spawnOffsetDirection);
               
               const item = hotbarInventory.itemSlots[itemSlot];
               new DroppedItem(position, item);
            }
         }
      });

      // Lose immunity to damage if the tribe member is hit
      this.createEvent("hurt", () => {
         this.removeImmunity();
         this.immunityTimer = TribeMember.DEEP_FROST_ARMOUR_IMMUNITY_TIME;
      });
   }

   public setTribe(tribe: Tribe | null): void {
      if (tribe !== null) {
         tribe.addTribeMember(this);
      }
      this.tribe = tribe;
   }

   public tick(): void {
      const inventoryComponent = this.forceGetComponent("inventory");
      const armourInventory = inventoryComponent.getInventory("armourSlot");

      // If snow armour is equipped, move at normal speed on snow tiles
      if (armourInventory.itemSlots.hasOwnProperty(1) && armourInventory.itemSlots[1].type === ItemType.frost_armour) {
         if (this.tile.type === TileType.snow) {
            this.overrideMoveSpeedMultiplier = true;
         }
      }
      this.overrideMoveSpeedMultiplier = false;

      super.tick();
      
      // Armour defence
      if (armourInventory.itemSlots.hasOwnProperty(1)) {
         const itemInfo = ITEM_INFO_RECORD[armourInventory.itemSlots[1].type] as ArmourItemInfo;
         this.forceGetComponent("health").addDefence(itemInfo.defence, "armour");
      } else {
         this.forceGetComponent("health").removeDefence("armour");
      }

      for (const itemSlot of Object.keys(this.bowCooldowns) as unknown as ReadonlyArray<number>) {
         this.bowCooldowns[itemSlot] -= 1 / SETTINGS.TPS;
         if (this.bowCooldowns[itemSlot] < 0) {
            delete this.bowCooldowns[itemSlot];
         }
      }

      // Update backpack
      if (inventoryComponent.getInventory("backpackSlot").itemSlots.hasOwnProperty(1)) {
         const itemInfo = ITEM_INFO_RECORD[inventoryComponent.getInventory("backpackSlot").itemSlots[1].type] as BackpackItemInfo;
         inventoryComponent.resizeInventory("backpack", itemInfo.inventoryWidth, itemInfo.inventoryHeight);
      } else {
         inventoryComponent.resizeInventory("backpack", -1, -1);
      }

      const selectedItem = inventoryComponent.getItem("hotbar", this.selectedItemSlot);

      switch (this.currentAction) {
         case TribeMemberAction.eat: {
            this.foodEatingTimer -= 1 / SETTINGS.TPS;
   
            if (this.foodEatingTimer <= 0) {
               if (selectedItem !== null) {
                  const itemCategory = ITEM_TYPE_RECORD[selectedItem.type];
                  if (itemCategory === "food") {
                     this.useItem(selectedItem, this.selectedItemSlot);
   
                     const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as FoodItemInfo;
                     this.foodEatingTimer = itemInfo.eatTime;
                  }
               }
            }

            break;
         }
      }

      this.immunityTimer -= 1 / SETTINGS.TPS;
      if (this.immunityTimer <= 0) {
         this.attemptToBecomeImmune();
         this.immunityTimer = 0;
      }
   }

   private attemptToBecomeImmune(): void {
      const armour = this.forceGetComponent("inventory").getItem("armourSlot", 1);
      if (armour !== null && armour.type === ItemType.deep_frost_armour) {
         this.addImmunity();
      }
   }

   private addImmunity(): void {
      this.forceGetComponent("health").addDefence(99999, "deep_frost_armour_immunity");
   }

   private removeImmunity(): void {
      this.forceGetComponent("health").removeDefence("deep_frost_armour_immunity");
   }

   protected getEntityRelationship(entity: Entity): EntityRelationship {
      switch (entity.type) {
         case "tribe_hut": {
            if (this.tribe === null || !this.tribe.hasHut(entity as TribeHut)) {
               return EntityRelationship.enemyBuilding;
            }
            return EntityRelationship.friendly;
         }
         case "tribe_totem": {
            if (this.tribe === null || !this.tribe.hasTotem(entity as TribeTotem)) {
               return EntityRelationship.enemyBuilding;
            }
            return EntityRelationship.friendly;
         }
         case "barrel": {
            if (this.tribe === null || (entity as Barrel).tribe === null) {
               return EntityRelationship.neutral;
            }
            if ((entity as Barrel).tribe === this.tribe) {
               return EntityRelationship.friendly;
            }
            return EntityRelationship.enemyBuilding;
         }
         case "player":
         case "tribesman": {
            if (this.tribe !== null && (entity as TribeMember).tribe === this.tribe) {
               return EntityRelationship.friendly;
            }
            return EntityRelationship.enemy;
         }
      }

      if (TribeMember.HOSTILE_MOB_TYPES.includes(entity.type)) {
         return EntityRelationship.hostileMob;
      }

      if (RESOURCE_ENTITY_TYPES.includes(entity.type) || entity instanceof Mob) {
         return EntityRelationship.resource;
      }

      return EntityRelationship.neutral;
   }

   protected calculateAttackTarget(targetEntities: ReadonlyArray<Entity>): Entity | null {
      let closestEntity: Entity | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of targetEntities) {
         if (typeof entity === "undefined") continue;

         // Don't attack entities without health components
         if (entity.getComponent("health") === null) continue;

         if (this.getEntityRelationship(entity) !== EntityRelationship.friendly) {
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
      const attackPositionX = this.position.x + attackOffset * Math.sin(this.rotation);
      const attackPositionY = this.position.y + attackOffset * Math.cos(this.rotation);
      const attackedEntities = getEntitiesInVisionRange(attackPositionX, attackPositionY, attackRadius);
      
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
    * @param targetEntity The entity to attack
    * @param itemSlot The item slot being used to attack the entity
    */
   protected attackEntity(targetEntity: Entity, itemSlot: number): void {
      // Find the selected item
      const inventoryComponent = this.forceGetComponent("inventory");
      const item = inventoryComponent.getItem("hotbar", itemSlot);

      const attackDamage = this.calculateItemDamage(item, targetEntity);
      const attackKnockback = this.calculateItemKnockback(item);

      const hitDirection = this.position.calculateAngleBetween(targetEntity.position);

      // Register the hit
      const attackHash = this.id.toString();
      const healthComponent = targetEntity.forceGetComponent("health"); // Attack targets always have a health component
      const hitFlags = item !== null && item.type === ItemType.flesh_sword ? HitFlags.HIT_BY_FLESH_SWORD : 0
      healthComponent.damage(attackDamage, attackKnockback, hitDirection, this, PlayerCauseOfDeath.tribe_member, hitFlags, attackHash);
      targetEntity.forceGetComponent("health").addLocalInvulnerabilityHash(attackHash, 0.3);

      if (item !== null && item.type === ItemType.flesh_sword) {
         targetEntity.applyStatusEffect(StatusEffect.poisoned, 3);
      }

      this.lastAttackTicks = Board.ticks;
   }

   private calculateItemDamage(item: Item | null, entityToAttack: Entity): number {
      if (item === null) {
         return 1;
      }

      const attackToolType = getEntityAttackToolType(entityToAttack);
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      switch (itemCategory) {
         case "sword": {
            if (attackToolType === AttackToolType.weapon) {
               const itemInfo = ITEM_INFO_RECORD[item.type] as SwordItemInfo;
               return itemInfo.damage;
            }
            return 1;
         }
         case "axe": {
            const itemInfo = ITEM_INFO_RECORD[item.type] as AxeItemInfo;
            if (attackToolType === AttackToolType.axe) {
               return itemInfo.damage;
            }
            return Math.floor(itemInfo.damage / 2);
         }
         case "pickaxe": {
            const itemInfo = ITEM_INFO_RECORD[item.type] as AxeItemInfo;
            if (attackToolType === AttackToolType.pickaxe) {
               return itemInfo.damage;
            } else {
               return Math.floor(itemInfo.damage / 2);
            }
         }
         default: {
            return 1;
         }
      }
   }

   private calculateItemKnockback(item: Item | null): number {
      if (item === null) {
         return TribeMember.DEFAULT_ATTACK_KNOCKBACK;
      }

      const itemInfo = ITEM_INFO_RECORD[item.type];
      if (itemInfo.hasOwnProperty("toolType")) {
         return (itemInfo as ToolItemInfo).knockback;
      }

      return TribeMember.DEFAULT_ATTACK_KNOCKBACK;
   }

   public getArmourItemType(): ItemType | null {
      const armourInventory = this.forceGetComponent("inventory").getInventory("armourSlot");

      if (armourInventory.itemSlots.hasOwnProperty(1)) {
         const armourItem = armourInventory.itemSlots[1];
         return armourItem.type;
      }
      return null;
   }

   protected getActiveItemType(): ItemType | null {
      const hotbarInventory = this.forceGetComponent("inventory").getInventory("hotbar");

      if (hotbarInventory.itemSlots.hasOwnProperty(this.selectedItemSlot)) {
         const item = hotbarInventory.itemSlots[this.selectedItemSlot];
         return item.type;
      }
      return null;
   }

   protected getFoodEatingType(): ItemType | -1 {
      if (this.currentAction === TribeMemberAction.eat) {
         const activeItemType = this.getActiveItemType();
         if (activeItemType !== null) {
            return activeItemType;
         }
      }
      return -1;
   }

   protected useItem(item: Item, itemSlot: number): void {
      const itemCategory = ITEM_TYPE_RECORD[item.type];

      const inventoryComponent = this.forceGetComponent("inventory");

      switch (itemCategory) {
         case "armour": {
            // 
            // Equip the armour
            // 
            
            const targetItem = inventoryComponent.getItem("armourSlot", 1);
            // If the target item slot has a different item type, don't attempt to transfer
            if (targetItem !== null && targetItem.type !== item.type) {
               return;
            }
   
            // Move from hotbar to armour slot
            inventoryComponent.removeItemFromInventory("hotbar", itemSlot);
            inventoryComponent.addItemToSlot("armourSlot", 1, item.type, 1);
            break;
         }
         case "food": {
            const healthComponent = this.forceGetComponent("health");

            // Don't use food if already at maximum health
            if (healthComponent.getHealth() >= healthComponent.maxHealth) return;

            const itemInfo = ITEM_INFO_RECORD[item.type] as FoodItemInfo;

            // Heal entity
            healthComponent.heal(itemInfo.healAmount);

            inventoryComponent.consumeItem("hotbar", itemSlot, 1);

            this.lastEatTicks = Board.ticks;
            break;
         }
         case "placeable": {
            assertItemTypeIsPlaceable(item.type);

            const placeInfo = PLACEABLE_ITEM_HITBOX_INFO[item.type];

            const spawnPositionX = this.position.x + (SETTINGS.ITEM_PLACE_DISTANCE + placeInfo.placeOffset) * Math.sin(this.rotation);
            const spawnPositionY = this.position.y + (SETTINGS.ITEM_PLACE_DISTANCE + placeInfo.placeOffset) * Math.cos(this.rotation);

            // Make sure the placeable item can be placed
            if (!this.canBePlaced(spawnPositionX, spawnPositionY, this.rotation, item.type)) return;
            
            const spawnPosition = new Point(spawnPositionX, spawnPositionY);
            
            // Spawn the placeable entity
            let placedEntity: Entity;
            switch (item.type) {
               case ItemType.workbench: {
                  placedEntity = new Workbench(spawnPosition);
                  break;
               }
               case ItemType.tribe_totem: {
                  placedEntity = new TribeTotem(spawnPosition);
                  TribeBuffer.addTribe(this.tribeType, placedEntity as TribeTotem, this);
                  break;
               }
               case ItemType.tribe_hut: {
                  if (this.tribe === null) {
                     throw new Error("Tribe member didn't belong to a tribe when placing a hut");
                  }
                  
                  placedEntity = new TribeHut(spawnPosition, this.tribe);
                  placedEntity.rotation = this.rotation; // This has to be done before the hut is registered in its tribe
                  this.tribe.registerNewHut(placedEntity as TribeHut);
                  break;
               }
               case ItemType.barrel: {
                  placedEntity = new Barrel(spawnPosition);
                  break;
               }
               case ItemType.campfire: {
                  placedEntity = new Campfire(spawnPosition);
                  break;
               }
               case ItemType.furnace: {
                  placedEntity = new Furnace(spawnPosition);
                  break;
               }
            }

            // Rotate it to match the entity's rotation
            placedEntity.rotation = this.rotation;

            inventoryComponent.consumeItem("hotbar", itemSlot, 1);

            break;
         }
         case "bow": {
            if (!this.canFire(itemSlot)) {
               return;
            }

            this.lastBowChargeTicks = Board.ticks;

            const itemInfo = ITEM_INFO_RECORD[item.type] as BowItemInfo;
            this.bowCooldowns[itemSlot] = itemInfo.shotCooldown;

            // Offset the arrow's spawn to be just outside of the tribe member's hitbox
            const spawnPosition = this.position.copy();
            const offset = new Vector(35, this.rotation).convertToPoint();
            spawnPosition.add(offset);
            
            const arrowProjectile = new Projectile(spawnPosition, ProjectileType.woodenArrow, 1.5, 0);
            arrowProjectile.velocity.x = itemInfo.projectileSpeed * Math.sin(this.rotation);
            arrowProjectile.velocity.y = itemInfo.projectileSpeed * Math.cos(this.rotation);
            arrowProjectile.rotation = this.rotation;

            const hitbox = new RectangularHitbox();
            hitbox.setHitboxInfo(TribeMember.ARROW_WIDTH, TribeMember.ARROW_HEIGHT);
            arrowProjectile.addHitbox(hitbox);

            arrowProjectile.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
               if (arrowProjectile.isRemoved) {
                  return;
               }
               
               // Don't damage any friendly entities
               if (this.getEntityRelationship(collidingEntity) === EntityRelationship.friendly) {
                  return;
               }
               
               const healthComponent = collidingEntity.getComponent("health");
               if (healthComponent !== null) {
                  const attackHash = item.id.toString();

                  if (!healthComponent.isInvulnerable(attackHash)) {
                     arrowProjectile.remove();
                  }
                  
                  const hitDirection = arrowProjectile.position.calculateAngleBetween(collidingEntity.position);
                  healthComponent.damage(itemInfo.projectileDamage, itemInfo.projectileKnockback, hitDirection, this, PlayerCauseOfDeath.arrow, 0, attackHash);
                  healthComponent.addLocalInvulnerabilityHash(attackHash, 0.3);
               }
            });

            // @Cleanup This is a shitty way of doing this (ideally shouldn't attach a listener), and can destroy the arrow too early
            // Also doesn't account for wall tiles
            arrowProjectile.tickCallback = (): void => {
               // 
               // Air resistance
               // 

               const xSignBefore = Math.sign(arrowProjectile.velocity.x);
               
               const velocityLength = arrowProjectile.velocity.length();
               arrowProjectile.velocity.x = (velocityLength - 3) * arrowProjectile.velocity.x / velocityLength;
               arrowProjectile.velocity.y = (velocityLength - 3) * arrowProjectile.velocity.y / velocityLength;
               if (Math.sign(arrowProjectile.velocity.x) !== xSignBefore) {
                  arrowProjectile.velocity.x = 0;
                  arrowProjectile.velocity.y = 0;
               }
               
               // Destroy the arrow if it reaches the border
               if (arrowProjectile.position.x <= TribeMember.ARROW_DESTROY_DISTANCE || arrowProjectile.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - TribeMember.ARROW_DESTROY_DISTANCE || arrowProjectile.position.y <= TribeMember.ARROW_DESTROY_DISTANCE || arrowProjectile.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - TribeMember.ARROW_DESTROY_DISTANCE) {
                  arrowProjectile.remove();
                  return;
               }
            }
            
            break;
         }
      }
   }

   private canFire(itemSlot: number): boolean {
      return !this.bowCooldowns.hasOwnProperty(itemSlot);
   }

   private canBePlaced(spawnPositionX: number, spawnPositionY: number, placeRotation: number, itemType: PlaceableItemType): boolean {
      // Update the place test hitbox to match the placeable item's info
      const testHitboxInfo = PLACEABLE_ITEM_HITBOX_INFO[itemType]!

      let placeTestHitbox: Hitbox;
      if (testHitboxInfo.type === PlaceableItemHitboxType.circular) {
         // Circular
         TribeMember.testCircularHitbox.radius = testHitboxInfo.radius;
         placeTestHitbox = TribeMember.testCircularHitbox;
      } else {
         // Rectangular
         TribeMember.testRectangularHitbox.setHitboxInfo(testHitboxInfo.width, testHitboxInfo.height);
         placeTestHitbox = TribeMember.testRectangularHitbox;
      }

      placeTestHitbox.position.x = spawnPositionX;
      placeTestHitbox.position.y = spawnPositionY;
      placeTestHitbox.updateHitboxBounds(placeRotation);

      const minChunkX = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[0] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[1] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[2] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[3] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      
      const previouslyCheckedEntityIDs = new Set<number>();

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.entities) {
               if (!previouslyCheckedEntityIDs.has(entity.id)) {
                  for (const hitbox of entity.hitboxes) {   
                     if (placeTestHitbox.isColliding(hitbox)) {
                        return false;
                     }
                  }
                  
                  previouslyCheckedEntityIDs.add(entity.id);
               }
            }
         }
      }

      return true;
   }

   protected getLastActionTicks(): number {
      switch (this.currentAction) {
         case TribeMemberAction.charge_bow: {
            return this.lastBowChargeTicks;
         }
         case TribeMemberAction.eat: {
            return this.lastEatTicks;
         }
         case TribeMemberAction.none: {
            return this.lastAttackTicks;
         }
      }
   }
}

export default TribeMember;