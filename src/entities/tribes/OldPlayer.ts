import { AttackPacket, BowItemInfo, canCraftRecipe, COLLISION_BITS, CRAFTING_RECIPES, DEFAULT_COLLISION_MASK, EntityTypeConst, FoodItemInfo, InventoryData, ITEM_INFO_RECORD, ItemType, Point, SETTINGS, TribeMemberAction, TribeType, Vector } from "webgl-test-shared";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Item, { getItemStackSize, itemIsStackable } from "../../items/Item";
// import DroppedItem from "../../items/DroppedItem";
// import Entity from "../Entity";
import Board from "../../Board";
// import TribeMember from "./TribeMember";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";
// import { serializeInventoryData } from "../../entity-components/OldInventoryComponent";

// class Player extends TribeMember {
//    /** How far away from the entity the attack is done */
//    private static readonly ATTACK_OFFSET = 50;
//    /** Max distance from the attack position that the attack will be registered from */
//    private static readonly ATTACK_RADIUS = 50;

//    public readonly mass = 1;

//    public readonly username: string;

//    public interactingEntityID: number | null = null;

//    public readonly collisionBit = COLLISION_BITS.other;
//    public readonly collisionMask = DEFAULT_COLLISION_MASK;

//    constructor(position: Point, username: string, tribe: Tribe | null) {
//       super(position, EntityTypeConst.player, 0, TribeType.plainspeople);

//       const hitbox = new CircularHitbox(this, 0, 0, 32);
//       this.addHitbox(hitbox);

//       const inventoryComponent = this.forceGetComponent("inventory");
//       inventoryComponent.createNewInventory("hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
//       inventoryComponent.createNewInventory("craftingOutputSlot", 1, 1, false);
//       inventoryComponent.createNewInventory("heldItemSlot", 1, 1, false);

//       this.username = username;

//       this.tribe = tribe;

//       this.createEvent("during_dropped_item_collision", (droppedItem: DroppedItem): void => {
//          const wasPickedUp = this.forceGetComponent("inventory").pickupDroppedItem(droppedItem);
//          if (wasPickedUp) {
//             SERVER.registerPlayerDroppedItemPickup(this);
//          }
//       });
//    }

//    public getClientArgs(): [tribeID: number | null, tribeType: TribeType, armourSlotInventory: InventoryData, backpackSlotInventory: InventoryData, backpackInventory: InventoryData, activeItem: ItemType | null, action: TribeMemberAction, foodEatingType: ItemType | -1, lastActionTicks: number, hasFrostShield: boolean, warPaintType: number, username: string] {
//       const inventoryComponent = this.forceGetComponent("inventory");
      
//       return [
//          this.tribe !== null ? this.tribe.id : null,
//          this.tribeType,
//          serializeInventoryData(inventoryComponent.getInventory("armourSlot"), "armourSlot"),
//          serializeInventoryData(inventoryComponent.getInventory("backpackSlot"), "backpackSlot"),
//          serializeInventoryData(inventoryComponent.getInventory("backpack"), "backpack"),
//          this.getActiveItemType(),
//          this.currentAction,
//          this.getFoodEatingType(),
//          this.getLastActionTicks(),
//          this.hasFrostShield(),
//          this.warPaintType,
//          this.username
//       ];
//    }

//    public calculateAttackedEntity(targetEntities: ReadonlyArray<Entity>): Entity | null {
//       let closestEntity: Entity | null = null;
//       let minDistance = Number.MAX_SAFE_INTEGER;
//       for (const entity of targetEntities) {
//          if (typeof entity === "undefined") continue;

//          // Don't attack entities without health components
//          if (entity.getComponent("health") === null) continue;

//          // Don't attack fellow tribe members
//          if (this.tribe !== null && entity instanceof TribeMember && entity.tribe !== null && entity.tribe === this.tribe) {
//             continue;
//          }

//          const dist = this.position.calculateDistanceBetween(entity.position);
//          if (dist < minDistance) {
//             closestEntity = entity;
//             minDistance = dist;
//          }
//       }

//       if (closestEntity === null) return null;

//       return closestEntity;
//    }

//    public setTribe(tribe: Tribe | null): void {
//       super.setTribe(tribe);
      
//       SERVER.updatePlayerTribe(this, this.tribe);
//    }

//    public setSelectedItemSlot(selectedItemSlot: number): void {
//       this.selectedItemSlot = selectedItemSlot;
//    }

//    public startEating(): void {
//       // Reset the food timer so that the food isn't immediately eaten
//       const foodItem = this.forceGetComponent("inventory").getItem("hotbar", this.selectedItemSlot);
//       if (foodItem !== null) {
//          const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
//          this.foodEatingTimer = itemInfo.eatTime;
//       }
      
//       this.currentAction = TribeMemberAction.eat;
//    }

//    public startChargingBow(): void {
//       // Reset the cooldown so the bow doesn't fire immediately
//       const bow = this.forceGetComponent("inventory").getItem("hotbar", this.selectedItemSlot);
//       if (bow !== null) {
//          const itemInfo = ITEM_INFO_RECORD[bow.type] as BowItemInfo;
//          this.bowCooldownTicks = itemInfo.shotCooldownTicks;
//          this.lastBowChargeTicks = Board.ticks;
//       }
      
//       this.currentAction = TribeMemberAction.eat;
//    }
// }

// export default Player;