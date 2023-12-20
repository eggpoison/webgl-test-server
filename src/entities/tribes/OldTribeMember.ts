import { ArmourItemInfo, AxeItemInfo, BackpackItemInfo, BowItemInfo, FoodItemInfo, HitFlags, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, ItemType, PlaceableItemType, PlayerCauseOfDeath, Point, ProjectileType, SETTINGS, StatusEffectConst, SwordItemInfo, TRIBE_INFO_RECORD, TileTypeConst, ToolItemInfo, TribeMemberAction, TribeType, Vector, randInt } from "webgl-test-shared";
import Board from "../../Board";
// import Entity from "../Entity";
// import InventoryComponent from "../../entity-components/OldInventoryComponent";
// import HealthComponent from "../../entity-components/OldHealthComponent";
import Tribe from "../../Tribe";
// import TribeHut from "./TribeHut";
// import TribeTotem from "./TribeTotem";
// import Mob from "../mobs/Mob";
import TribeBuffer from "../../TribeBuffer";
// import Barrel from "./Barrel";
import Item, { getItemStackSize, itemIsStackable } from "../../items/Item";
import Hitbox from "../../hitboxes/Hitbox";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import CircularHitbox from "../../hitboxes/CircularHitbox";
// import Projectile from "../../Projectile";
// import Workbench from "../Workbench";
// import Campfire from "../cooking-entities/Campfire";
// import Furnace from "../cooking-entities/Furnace";
import { getEntitiesInVisionRange } from "../../ai-shared";

// const pickaxeDamageableEntities: ReadonlyArray<EntityTypeConst> = [EntityTypeConst.boulder, EntityTypeConst.tombstone, EntityTypeConst.ice_spikes, EntityTypeConst.furnace];
// const axeDamageableEntities: ReadonlyArray<EntityTypeConst> = [EntityTypeConst.tree];

// export enum AttackToolType {
//    weapon,
//    pickaxe,
//    axe
// }

// enum PlaceableItemHitboxType {
//    circular = 0,
//    rectangular = 1
// }

// interface PlaceableItemHitboxInfo {
//    readonly type: PlaceableItemHitboxType;
//    readonly placeOffset: number;
// }

// interface PlaceableItemCircularHitboxInfo extends PlaceableItemHitboxInfo {
//    readonly type: PlaceableItemHitboxType.circular;
//    readonly radius: number;
// }

// interface PlaceableItemRectangularHitboxInfo extends PlaceableItemHitboxInfo {
//    readonly type: PlaceableItemHitboxType.rectangular;
//    readonly width: number;
//    readonly height: number;
// }

// const PLACEABLE_ITEM_HITBOX_INFO: Record<PlaceableItemType, PlaceableItemCircularHitboxInfo | PlaceableItemRectangularHitboxInfo> = {
//    [ItemType.workbench]: {
//       type: PlaceableItemHitboxType.rectangular,
//       width: Workbench.SIZE,
//       height: Workbench.SIZE,
//       placeOffset: Workbench.SIZE / 2
//    },
//    [ItemType.tribe_totem]: {
//       type: PlaceableItemHitboxType.circular,
//       radius: TribeTotem.SIZE / 2,
//       placeOffset: TribeTotem.SIZE / 2
//    },
//    [ItemType.tribe_hut]: {
//       type: PlaceableItemHitboxType.rectangular,
//       width: TribeHut.SIZE,
//       height: TribeHut.SIZE,
//       placeOffset: TribeHut.SIZE / 2
//    },
//    [ItemType.barrel]: {
//       type: PlaceableItemHitboxType.circular,
//       radius: TribeHut.SIZE / 2,
//       placeOffset: TribeHut.SIZE / 2
//    },
//    [ItemType.campfire]: {
//       type: PlaceableItemHitboxType.rectangular,
//       width: Campfire.SIZE,
//       height: Campfire.SIZE,
//       placeOffset: Campfire.SIZE / 2
//    },
//    [ItemType.furnace]: {
//       type: PlaceableItemHitboxType.rectangular,
//       width: Furnace.SIZE,
//       height: Furnace.SIZE,
//       placeOffset: Furnace.SIZE / 2
//    }
// };

// function assertItemTypeIsPlaceable(itemType: ItemType): asserts itemType is PlaceableItemType {
//    if (!PLACEABLE_ITEM_HITBOX_INFO.hasOwnProperty(itemType)) {
//       throw new Error(`Entity type '${itemType}' is not placeable.`);
//    }
// }

// /** Relationships a tribe member can have, in increasing order of threat */
// export enum EntityRelationship {
//    friendly,
//    neutral,
//    resource,
//    hostileMob,
//    enemyBuilding,
//    enemy
// }

// abstract class TribeMember extends Mob {
   
//    private static readonly DEATH_ITEM_DROP_RANGE = 38;
   
//    private static readonly DEFAULT_ATTACK_KNOCKBACK = 125;

//    private static readonly DEEPFROST_ARMOUR_IMMUNITY_TIME = 20;

//    private static readonly HOSTILE_MOB_TYPES: ReadonlyArray<EntityTypeConst> = [EntityTypeConst.yeti, EntityTypeConst.frozen_yeti, EntityTypeConst.zombie, EntityTypeConst.slime];

//    private static readonly VACUUM_RANGE = 85;
//    private static readonly VACUUM_STRENGTH = 25;

//    public readonly tribeType: TribeType;
//    public tribe: Tribe | null = null;

//    protected selectedItemSlot = 1;

//    public currentAction = TribeMemberAction.none;
//    protected foodEatingTimer = 0;

//    protected lastAttackTicks = -99999;
//    protected lastEatTicks = -99999;
//    protected lastBowChargeTicks = -99999;

//    protected bowCooldownTicks = 0;

//    public immunityTimer = 0;

//    protected readonly warPaintType: number;

//    private readonly itemAttackCooldowns: Record<number, number> = {};

//    constructor(position: Point, entityType: EntityTypeConst, visionRange: number, tribeType: TribeType) {
//       const tribeInfo = TRIBE_INFO_RECORD[tribeType];

//       const inventoryComponent = new InventoryComponent();
      
//       super(position, {
//          health: new HealthComponent(entityType === EntityTypeConst.player ? tribeInfo.maxHealthPlayer : tribeInfo.maxHealthWorker, true),
//          inventory: inventoryComponent
//       }, entityType, visionRange);

//       this.tribeType = tribeType;

//       if (tribeType === TribeType.goblins) {
//          this.warPaintType = randInt(1, 5);
//       } else {
//          this.warPaintType = -1;
//       }

//       inventoryComponent.createNewInventory("armourSlot", 1, 1, false);
//       inventoryComponent.createNewInventory("backpackSlot", 1, 1, false);
//       inventoryComponent.createNewInventory("backpack", -1, -1, false);

//       // Drop inventory on death
//       this.createEvent("death", () => {
//          this.forceGetComponent("inventory").dropInventory("hotbar", TribeMember.DEATH_ITEM_DROP_RANGE);
//          this.forceGetComponent("inventory").dropInventory("armourSlot", TribeMember.DEATH_ITEM_DROP_RANGE);
//          this.forceGetComponent("inventory").dropInventory("backpackSlot", TribeMember.DEATH_ITEM_DROP_RANGE);
//       });

//       // Lose immunity to damage if the tribe member is hit
//       this.createEvent("hurt", () => {
//          this.removeImmunity();
//          this.immunityTimer = TribeMember.DEEPFROST_ARMOUR_IMMUNITY_TIME;
//       });

//       this.createEvent("hurt", (_, attackingEntity: Entity | null) => {
//          if (this.tribe !== null && attackingEntity !== null && this.forceGetComponent("health").health <= 7.5) {
//             this.tribe.requestReinforcements(attackingEntity);
//          }
//       });
//    }

//    public setTribe(tribe: Tribe | null): void {
//       if (tribe !== null) {
//          tribe.addTribeMember(this);
//       }
//       this.tribe = tribe;
//    }

//    public tick(): void {
//       const inventoryComponent = this.forceGetComponent("inventory");
//       const hotbarInventory = inventoryComponent.getInventory("hotbar");
//       const armourInventory = inventoryComponent.getInventory("armourSlot");

//       this.overrideMoveSpeedMultiplier = false;
//       if (armourInventory.itemSlots.hasOwnProperty(1)) {
//          // If snow armour is equipped, move at normal speed on snow tiles
//          if ((armourInventory.itemSlots[1].type === ItemType.frost_armour || armourInventory.itemSlots[1].type === ItemType.deepfrost_armour) && this.tile.type === TileTypeConst.snow) {
//             this.overrideMoveSpeedMultiplier = true;
//          }
//          // If fishlord suit is equipped, move at normal speed on snow tiles
//          if (armourInventory.itemSlots[1].type === ItemType.fishlord_suit && this.tile.type === TileTypeConst.water) {
//             this.overrideMoveSpeedMultiplier = true;
//          }
//       }

//       super.tick();

//       // Update attack cooldowns
//       for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
//          if (this.itemAttackCooldowns.hasOwnProperty(itemSlot)) {
//             this.itemAttackCooldowns[itemSlot] -= 1 / SETTINGS.TPS;
//             if (this.itemAttackCooldowns[itemSlot] < 0) {
//                delete this.itemAttackCooldowns[itemSlot];
//             }
//          }
//       }
      
//       // Armour defence
//       if (armourInventory.itemSlots.hasOwnProperty(1)) {
//          const itemInfo = ITEM_INFO_RECORD[armourInventory.itemSlots[1].type] as ArmourItemInfo;
//          this.forceGetComponent("health").addDefence(itemInfo.defence, "armour");
//       } else {
//          this.forceGetComponent("health").removeDefence("armour");
//       }

//       this.bowCooldownTicks--;
//       if (this.bowCooldownTicks < 0) {
//          this.bowCooldownTicks = 0;
//       }

//       // Update backpack
//       if (inventoryComponent.getInventory("backpackSlot").itemSlots.hasOwnProperty(1)) {
//          const itemInfo = ITEM_INFO_RECORD[inventoryComponent.getInventory("backpackSlot").itemSlots[1].type] as BackpackItemInfo;
//          inventoryComponent.resizeInventory("backpack", itemInfo.inventoryWidth, itemInfo.inventoryHeight);
//       } else {
//          inventoryComponent.resizeInventory("backpack", -1, -1);
//       }

//       const selectedItem = inventoryComponent.getItem("hotbar", this.selectedItemSlot);

//       switch (this.currentAction) {
//          case TribeMemberAction.eat: {
//             this.foodEatingTimer -= 1 / SETTINGS.TPS;
   
//             if (this.foodEatingTimer <= 0) {
//                if (selectedItem !== null) {
//                   const itemCategory = ITEM_TYPE_RECORD[selectedItem.type];
//                   if (itemCategory === "food") {
//                      this.useItem(selectedItem, this.selectedItemSlot);
   
//                      const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as FoodItemInfo;
//                      this.foodEatingTimer = itemInfo.eatTime;
//                   }
//                }
//             }

//             break;
//          }
//       }

//       this.immunityTimer -= 1 / SETTINGS.TPS;
//       if (this.immunityTimer <= 0) {
//          this.attemptToBecomeImmune();
//          this.immunityTimer = 0;
//       }

//       // Vacuum nearby items to the tribe member
//       // @Incomplete: Don't vacuum items which the tribe member doesn't have the inventory space for
//       const minChunkX = Math.max(Math.floor((this.position.x - TribeMember.VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), 0);
//       const maxChunkX = Math.min(Math.floor((this.position.x + TribeMember.VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
//       const minChunkY = Math.max(Math.floor((this.position.y - TribeMember.VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), 0);
//       const maxChunkY = Math.min(Math.floor((this.position.y + TribeMember.VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
//       for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
//          for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
//             const chunk = Board.getChunk(chunkX, chunkY);
//             for (const droppedItem of chunk.droppedItems) {
//                if (!droppedItem.canBePickedUp(this.id) || !this.canPickUpItem(droppedItem.item.type)) {
//                   continue;
//                }
               
//                const distance = this.position.calculateDistanceBetween(droppedItem.position);
//                if (distance <= TribeMember.VACUUM_RANGE) {
//                   const vacuumDirection = droppedItem.position.calculateAngleBetween(this.position);
//                   droppedItem.velocity.x += TribeMember.VACUUM_STRENGTH * Math.sin(vacuumDirection);
//                   droppedItem.velocity.y += TribeMember.VACUUM_STRENGTH * Math.cos(vacuumDirection);
//                }
//             }
//          }
//       }
//    }

//    private attemptToBecomeImmune(): void {
//       const armour = this.forceGetComponent("inventory").getItem("armourSlot", 1);
//       if (armour !== null && armour.type === ItemType.deepfrost_armour) {
//          this.addImmunity();
//       }
//    }

//    private addImmunity(): void {
//       this.forceGetComponent("health").addDefence(99999, "deep_frost_armour_immunity");
//    }

//    private removeImmunity(): void {
//       this.forceGetComponent("health").removeDefence("deep_frost_armour_immunity");
//    }

//    protected hasFrostShield(): boolean {
//       if (this.immunityTimer !== 0) {
//          return false;
//       }
//       const armour = this.forceGetComponent("inventory").getItem("armourSlot", 1);
//       if (armour !== null && armour.type === ItemType.deepfrost_armour) {
//          return true;
//       }
//       return false;
//    }

//    /**
//     * @param targetEntity The entity to attack
//     * @param itemSlot The item slot being used to attack the entity
//     */
//    protected attackEntity(targetEntity: Entity, itemSlot: number): void {
//       // Don't attack if on cooldown
//       if (this.itemAttackCooldowns.hasOwnProperty(itemSlot)) {
//          return;
//       }
      
//       // Find the selected item
//       const inventoryComponent = this.forceGetComponent("inventory");
//       const item = inventoryComponent.getItem("hotbar", itemSlot);

//       // Reset attack cooldown
//       if (item !== null) {
//          const itemTypeInfo = ITEM_TYPE_RECORD[item.type];
//          if (itemTypeInfo === "axe" || itemTypeInfo === "pickaxe" || itemTypeInfo === "sword") {
//             const itemInfo = ITEM_INFO_RECORD[item.type];
//             this.itemAttackCooldowns[itemSlot] = (itemInfo as ToolItemInfo).attackCooldown;
//          } else {
//             this.itemAttackCooldowns[itemSlot] = SETTINGS.DEFAULT_ATTACK_COOLDOWN;
//          }
//       } else {
//          this.itemAttackCooldowns[itemSlot] = SETTINGS.DEFAULT_ATTACK_COOLDOWN;
//       }

//       const attackDamage = this.calculateItemDamage(item, targetEntity);
//       const attackKnockback = this.calculateItemKnockback(item);

//       const hitDirection = this.position.calculateAngleBetween(targetEntity.position);

//       // Register the hit
//       const attackHash = this.id.toString();
//       const healthComponent = targetEntity.forceGetComponent("health"); // Attack targets always have a health component
//       const hitFlags = item !== null && item.type === ItemType.flesh_sword ? HitFlags.HIT_BY_FLESH_SWORD : 0
//       healthComponent.damage(attackDamage, attackKnockback, hitDirection, this, PlayerCauseOfDeath.tribe_member, hitFlags, attackHash);
//       targetEntity.forceGetComponent("health").addLocalInvulnerabilityHash(attackHash, 0.3);

//       if (item !== null && item.type === ItemType.flesh_sword) {
//          targetEntity.applyStatusEffect(StatusEffectConst.poisoned, 3 * SETTINGS.TPS);
//       }

//       this.lastAttackTicks = Board.ticks;
//    }

//    public getArmourItemType(): ItemType | null {
//       const armourInventory = this.forceGetComponent("inventory").getInventory("armourSlot");

//       if (armourInventory.itemSlots.hasOwnProperty(1)) {
//          const armourItem = armourInventory.itemSlots[1];
//          return armourItem.type;
//       }
//       return null;
//    }

//    protected getActiveItemType(): ItemType | null {
//       const hotbarInventory = this.forceGetComponent("inventory").getInventory("hotbar");

//       if (hotbarInventory.itemSlots.hasOwnProperty(this.selectedItemSlot)) {
//          const item = hotbarInventory.itemSlots[this.selectedItemSlot];
//          return item.type;
//       }
//       return null;
//    }

//    protected getFoodEatingType(): ItemType | -1 {
//       if (this.currentAction === TribeMemberAction.eat) {
//          const activeItemType = this.getActiveItemType();
//          if (activeItemType !== null) {
//             return activeItemType;
//          }
//       }
//       return -1;
//    }

//    private canFire(itemSlot: number): boolean {
//       return this.bowCooldownTicks === 0;
//    }

//    private canBePlaced(spawnPositionX: number, spawnPositionY: number, placeRotation: number, itemType: PlaceableItemType): boolean {
//       // Update the place test hitbox to match the placeable item's info
//       const testHitboxInfo = PLACEABLE_ITEM_HITBOX_INFO[itemType]!

//       let placeTestHitbox: Hitbox;
//       if (testHitboxInfo.type === PlaceableItemHitboxType.circular) {
//          // Circular
//          TribeMember.testCircularHitbox.radius = testHitboxInfo.radius;
//          placeTestHitbox = TribeMember.testCircularHitbox;
//       } else {
//          // Rectangular
//          TribeMember.testRectangularHitbox.width = testHitboxInfo.width;
//          TribeMember.testRectangularHitbox.height = testHitboxInfo.height;
//          placeTestHitbox = TribeMember.testRectangularHitbox;
//       }

//       placeTestHitbox.object.position.x = spawnPositionX;
//       placeTestHitbox.object.position.y = spawnPositionY;
//       placeTestHitbox.object.rotation = placeRotation;

//       const hitboxBoundsMinX = placeTestHitbox.calculateHitboxBoundsMinX();
//       const hitboxBoundsMaxX = placeTestHitbox.calculateHitboxBoundsMaxX();
//       const hitboxBoundsMinY = placeTestHitbox.calculateHitboxBoundsMinY();
//       const hitboxBoundsMaxY = placeTestHitbox.calculateHitboxBoundsMaxY();

//       const minChunkX = Math.max(Math.min(Math.floor(hitboxBoundsMinX / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
//       const maxChunkX = Math.max(Math.min(Math.floor(hitboxBoundsMaxX / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
//       const minChunkY = Math.max(Math.min(Math.floor(hitboxBoundsMinY / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
//       const maxChunkY = Math.max(Math.min(Math.floor(hitboxBoundsMaxY / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      
//       const previouslyCheckedEntityIDs = new Set<number>();

//       for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
//          for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
//             const chunk = Board.getChunk(chunkX, chunkY);
//             for (const entity of chunk.entities) {
//                if (!previouslyCheckedEntityIDs.has(entity.id)) {
//                   for (const hitbox of entity.hitboxes) {   
//                      if (placeTestHitbox.isColliding(hitbox)) {
//                         return false;
//                      }
//                   }
                  
//                   previouslyCheckedEntityIDs.add(entity.id);
//                }
//             }
//          }
//       }

//       return true;
//    }

//    protected getLastActionTicks(): number {
//       switch (this.currentAction) {
//          case TribeMemberAction.charge_bow: {
//             return this.lastBowChargeTicks;
//          }
//          case TribeMemberAction.eat: {
//             return this.lastEatTicks;
//          }
//          case TribeMemberAction.none: {
//             return this.lastAttackTicks;
//          }
//       }
//    }

//    protected canPickUpItem(itemType: ItemType): boolean {
//       const inventoryComponent = this.forceGetComponent("inventory");
//       const inventory = inventoryComponent.getInventory("hotbar");
      
//       for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
//          if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
//             return true;
//          }

//          const item = inventory.itemSlots[itemSlot];
//          if (item.type === itemType && itemIsStackable(item.type) && getItemStackSize(item) - item.count > 0) {
//             return true;
//          }
//       }

//       return false;
//    }
// }

// export default TribeMember;