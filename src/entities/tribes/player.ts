import { AttackPacket, BowItemInfo, COLLISION_BITS, CRAFTING_RECIPES, DEFAULT_COLLISION_MASK, FoodItemInfo, IEntityType, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, ItemRequirements, ItemType, Point, SETTINGS, BlueprintBuildingType, TRIBE_INFO_RECORD, TechID, TechInfo, TribeMemberAction, TribeType, getItemStackSize, getTechByID, hasEnoughItems, itemIsStackable } from "webgl-test-shared";
import Entity from "../../Entity";
import { attackEntity, calculateAttackTarget, calculateBlueprintWorkTarget, calculateRadialAttackTargets, calculateRepairTarget, onTribeMemberHurt, pickupItemEntity, repairBuilding, tickTribeMember, tribeMemberCanPickUpItem, useItem } from "./tribe-member";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ItemComponentArray, PhysicsComponentArray, PlayerComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray } from "../../components/ComponentArray";
import { InventoryComponent, addItem, addItemToSlot, consumeItem, consumeItemTypeFromInventory, createNewInventory, dropInventory, getInventory, getItem } from "../../components/InventoryComponent";
import Board from "../../Board";
import { createItemEntity, itemEntityCanBePickedUp } from "../item-entity";
import { HealthComponent } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { InventoryUseComponent, getInventoryUseInfo } from "../../components/InventoryUseComponent";
import { SERVER } from "../../server";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";
import { PlayerComponent } from "../../components/PlayerComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { createItem } from "../../items";
import { toggleDoor } from "../../components/DoorComponent";
import { PhysicsComponent } from "../../components/PhysicsComponent";
import { EntityRelationship, TribeComponent } from "../../components/TribeComponent";
import { createBlueprintEntity } from "../blueprint-entity";
import { deoccupyResearchBench, attemptToOccupyResearchBench } from "../../components/ResearchBenchComponent";

/** How far away from the entity the attack is done */
const ATTACK_OFFSET = 50;
/** Max distance from the attack position that the attack will be registered from */
const ATTACK_RADIUS = 50;

const ITEM_THROW_FORCE = 100;
const ITEM_THROW_OFFSET = 32;

const VACUUM_RANGE = 85;
const VACUUM_STRENGTH = 25;

export function createPlayer(position: Point, tribe: Tribe): Entity {
   const player = new Entity(position, IEntityType.player, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   // @Temporary
   const hitbox = new CircularHitbox(player, 1, 0, 0, 32, 0);
   // const hitbox = new RectangularHitbox(player, 1, 0, 0, 64, 64, 0);
   player.addHitbox(hitbox);

   const tribeInfo = TRIBE_INFO_RECORD[tribe.type];
   PhysicsComponentArray.addComponent(player, new PhysicsComponent(true));
   HealthComponentArray.addComponent(player, new HealthComponent(tribeInfo.maxHealthPlayer));
   StatusEffectComponentArray.addComponent(player, new StatusEffectComponent(0));

   TribeComponentArray.addComponent(player, new TribeComponent(tribe));
   TribeMemberComponentArray.addComponent(player, new TribeMemberComponent(tribe.type));
   PlayerComponentArray.addComponent(player, new PlayerComponent());

   const inventoryUseComponent = new InventoryUseComponent();
   InventoryUseComponentArray.addComponent(player, inventoryUseComponent);

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(player, inventoryComponent);

   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", SETTINGS.INITIAL_PLAYER_HOTBAR_SIZE, 1, true);
   inventoryUseComponent.addInventoryUseInfo(hotbarInventory);
   createNewInventory(inventoryComponent, "craftingOutputSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "heldItemSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "gloveSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);
   if (tribe.type === TribeType.barbarians) {
      const offhandInventory = createNewInventory(inventoryComponent, "offhand", 1, 1, false);
      inventoryUseComponent.addInventoryUseInfo(offhandInventory);
   }

   // @Temporary
   // addItem(inventoryComponent, createItem(ItemType.tribe_totem, 1));
   // addItem(inventoryComponent, createItem(ItemType.barrel, 2));
   // addItem(inventoryComponent, createItem(ItemType.wooden_wall, 20));
   addItem(inventoryComponent, createItem(ItemType.ballista, 1));
   // addItem(inventoryComponent, createItem(ItemType.wooden_hammer, 1));

   return player;
}

export function tickPlayer(player: Entity): void {
   tickTribeMember(player);
   
   // Vacuum nearby items to the player
   // @Incomplete: Don't vacuum items which the player doesn't have the inventory space for
   const minChunkX = Math.max(Math.floor((player.position.x - VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), 0);
   const maxChunkX = Math.min(Math.floor((player.position.x + VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
   const minChunkY = Math.max(Math.floor((player.position.y - VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), 0);
   const maxChunkY = Math.min(Math.floor((player.position.y + VACUUM_RANGE) / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1);
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const itemEntity of chunk.entities) {
            if (itemEntity.type !== IEntityType.itemEntity || !itemEntityCanBePickedUp(itemEntity, player.id)) {
               continue;
            }

            const itemComponent = ItemComponentArray.getComponent(itemEntity);
            if (!tribeMemberCanPickUpItem(player, itemComponent.itemType)) {
               continue;
            }
            
            const distance = player.position.calculateDistanceBetween(itemEntity.position);
            if (distance <= VACUUM_RANGE) {
               const vacuumDirection = itemEntity.position.calculateAngleBetween(player.position);
               itemEntity.velocity.x += VACUUM_STRENGTH * Math.sin(vacuumDirection);
               itemEntity.velocity.y += VACUUM_STRENGTH * Math.cos(vacuumDirection);
            }
         }
      }
   }
}

export function onPlayerCollision(player: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      const wasPickedUp = pickupItemEntity(player, collidingEntity);
      if (wasPickedUp) {
         SERVER.registerPlayerDroppedItemPickup(player);
      }
   }
}

export function onPlayerHurt(player: Entity, collidingEntity: Entity): void {
   onTribeMemberHurt(player, collidingEntity);
}

export function onPlayerDeath(player: Entity): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   
   dropInventory(player, inventoryComponent, "hotbar", 38);
   dropInventory(player, inventoryComponent, "armourSlot", 38);
   dropInventory(player, inventoryComponent, "backpackSlot", 38);
}

export function onPlayerRemove(player: Entity): void {
   PhysicsComponentArray.removeComponent(player);
   HealthComponentArray.removeComponent(player);
   StatusEffectComponentArray.removeComponent(player);
   TribeComponentArray.removeComponent(player);
   TribeMemberComponentArray.removeComponent(player);
   PlayerComponentArray.removeComponent(player);
   InventoryComponentArray.removeComponent(player);
}

export function processPlayerCraftingPacket(player: Entity, recipeIndex: number): void {
   if (recipeIndex < 0 || recipeIndex >= CRAFTING_RECIPES.length) {
      return;
   }
   
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const craftingRecipe = CRAFTING_RECIPES[recipeIndex];
   
   // Don't craft past items' stack size
   const craftingOutputInventory = getInventory(inventoryComponent, "craftingOutputSlot");
   if (craftingOutputInventory.itemSlots.hasOwnProperty(1)) {
      const craftingOutputItem = craftingOutputInventory.itemSlots[1];
      if ((craftingOutputItem.type !== craftingRecipe.product || !itemIsStackable(craftingOutputItem.type) || craftingOutputItem.count + craftingRecipe.yield > getItemStackSize(craftingOutputItem))) {
         return;
      }
   }
   
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   const backpackInventory = getInventory(inventoryComponent, "backpack");

   // @Speed: Garbage collection
   if (hasEnoughItems([hotbarInventory.itemSlots, backpackInventory.itemSlots], craftingRecipe.ingredients)) {
      // Consume ingredients
      for (const [ingredientType, ingredientCount] of Object.entries(craftingRecipe.ingredients).map(entry => [Number(entry[0]), entry[1]]) as ReadonlyArray<[ItemType, number]>) {
         // Prioritise consuming ingredients from the backpack inventory first
         const amountConsumedFromBackpackInventory = consumeItemTypeFromInventory(inventoryComponent, "backpack", ingredientType, ingredientCount);

         // Consume the rest from the hotbar
         const remainingAmountToConsume = ingredientCount - amountConsumedFromBackpackInventory;
         consumeItemTypeFromInventory(inventoryComponent, "hotbar", ingredientType, remainingAmountToConsume);
      }

      // Add product to held item
      addItemToSlot(inventoryComponent, "craftingOutputSlot", 1, craftingRecipe.product, craftingRecipe.yield);
   }
}

export function processItemPickupPacket(player: Entity, entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
   if (!Board.entityRecord.hasOwnProperty(entityID)) {
      return;
   }

   const inventoryComponent = InventoryComponentArray.getComponent(player);
   
   // Don't pick up the item if there is already a held item
   if (getInventory(inventoryComponent, "heldItemSlot").itemSlots.hasOwnProperty(1)) {
      return;
   }

   const targetInventoryComponent = InventoryComponentArray.getComponent(Board.entityRecord[entityID]);

   const pickedUpItem = getItem(targetInventoryComponent, inventoryName, itemSlot);
   if (pickedUpItem === null) return;

   // Hold the item
   addItemToSlot(inventoryComponent, "heldItemSlot", 1, pickedUpItem.type, amount);

   // Remove the item from its previous inventory
   consumeItem(targetInventoryComponent, inventoryName, itemSlot, amount);
}

export function processItemReleasePacket(player: Entity, entityID: number, inventoryName: string, itemSlot: number, amount: number): void {
   if (!Board.entityRecord.hasOwnProperty(entityID)) {
      return;
   }

   const inventoryComponent = InventoryComponentArray.getComponent(player);

   // Don't release an item if there is no held item
   const heldItemInventory = getInventory(inventoryComponent, "heldItemSlot");
   if (!heldItemInventory.itemSlots.hasOwnProperty(1)) return;

   const targetInventoryComponent = InventoryComponentArray.getComponent(Board.entityRecord[entityID]);

   const heldItem = heldItemInventory.itemSlots[1];
   
   // Add the item to the inventory
   const amountAdded = addItemToSlot(targetInventoryComponent, inventoryName, itemSlot, heldItem.type, amount);

   // If all of the item was added, clear the held item
   consumeItemTypeFromInventory(inventoryComponent, "heldItemSlot", heldItem.type, amountAdded);
}

export function processItemUsePacket(player: Entity, itemSlot: number): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);

   const item = getItem(inventoryComponent, "hotbar", itemSlot);
   if (item !== null)  {
      useItem(player, item, "hotbar", itemSlot);
   }
}

/** Returns whether the swing was successfully swang or not */
const attemptSwing = (player: Entity, attackTargets: ReadonlyArray<Entity>, itemSlot: number, inventoryName: string): boolean => {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const item = getItem(inventoryComponent, inventoryName, itemSlot);
   if (item !== null && ITEM_TYPE_RECORD[item.type] === "hammer") {
      // First look for friendly buildings to repair
      const repairTarget = calculateRepairTarget(player, attackTargets);
      if (repairTarget !== null) {
         return repairBuilding(player, repairTarget, itemSlot, inventoryName);
      }

      // Then look for attack targets
      const attackTarget = calculateAttackTarget(player, attackTargets, ~(EntityRelationship.friendly | EntityRelationship.friendlyBuilding));
      if (attackTarget !== null) {
         return attackEntity(player, attackTarget, itemSlot, inventoryName);
      }

      // Then look for blueprints to work on
      const workTarget = calculateBlueprintWorkTarget(player, attackTargets);
      if (workTarget !== null) {
         return repairBuilding(player, workTarget, itemSlot, inventoryName);
      }

      return false;
   }
   
   // For non-hammer items, just look for attack targets
   const attackTarget = calculateAttackTarget(player, attackTargets, ~EntityRelationship.friendly);
   if (attackTarget !== null) {
      return attackEntity(player, attackTarget, itemSlot, inventoryName);
   }

   return false;
}

export function processPlayerAttackPacket(player: Entity, attackPacket: AttackPacket): void {
   // @Cleanup: Rename function. shouldn't be 'attack'
   const targets = calculateRadialAttackTargets(player, ATTACK_OFFSET, ATTACK_RADIUS);

   const didSwingWithRightHand = attemptSwing(player, targets, attackPacket.itemSlot, "hotbar");
   if (didSwingWithRightHand) {
      return;
   }

   // If a barbarian, attack with offhand
   const tribeComponent = TribeComponentArray.getComponent(player);
   if (tribeComponent.tribe!.type === TribeType.barbarians) {
      attemptSwing(player, targets, 1, "offhand");
   }
}

export function throwItem(player: Entity, inventoryName: string, itemSlot: number, dropAmount: number, throwDirection: number): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventory = getInventory(inventoryComponent, inventoryName);
   if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
      return;
   }
   
   const itemType = inventory.itemSlots[itemSlot].type;
   const amountRemoved = consumeItem(inventoryComponent, inventoryName, itemSlot, dropAmount);

   const dropPosition = player.position.copy();
   dropPosition.x += ITEM_THROW_OFFSET * Math.sin(throwDirection);
   dropPosition.y += ITEM_THROW_OFFSET * Math.cos(throwDirection);

   // Create the item entity
   const itemEntity = createItemEntity(dropPosition, itemType, amountRemoved, player.id);

   // Throw the dropped item away from the player
   itemEntity.velocity.x += ITEM_THROW_FORCE * Math.sin(throwDirection);
   itemEntity.velocity.y += ITEM_THROW_FORCE * Math.cos(throwDirection);
}

export function startEating(player: Entity, inventoryName: string): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);
   
   // Reset the food timer so that the food isn't immediately eaten
   const foodItem = getItem(inventoryComponent, inventoryName, useInfo.selectedItemSlot);
   if (foodItem !== null) {
      const itemInfo = ITEM_INFO_RECORD[foodItem.type] as FoodItemInfo;
      useInfo.foodEatingTimer = itemInfo.eatTime;
   }
   
   useInfo.currentAction = TribeMemberAction.eat;
}

export function startChargingBow(player: Entity, inventoryName: string): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   // Reset the cooldown so the bow doesn't fire immediately
   const bow = getItem(inventoryComponent, inventoryName, useInfo.selectedItemSlot);
   if (bow !== null) {
      const itemInfo = ITEM_INFO_RECORD[bow.type] as BowItemInfo;
      useInfo.bowCooldownTicks = itemInfo.shotCooldownTicks;
      useInfo.lastBowChargeTicks = Board.ticks;
   }
   
   useInfo.currentAction = TribeMemberAction.chargeBow;
}

export function startChargingSpear(player: Entity, inventoryName: string): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   // Reset the cooldown so the battleaxe doesn't fire immediately
   const spear = getItem(inventoryComponent, inventoryName, useInfo.selectedItemSlot);
   if (spear !== null) {
      useInfo.lastSpearChargeTicks = Board.ticks;
   }
   
   useInfo.currentAction = TribeMemberAction.chargeSpear;
}

export function startChargingBattleaxe(player: Entity, inventoryName: string): void {
   const inventoryComponent = InventoryComponentArray.getComponent(player);
   const inventoryUseComponent = InventoryUseComponentArray.getComponent(player);

   const useInfo = getInventoryUseInfo(inventoryUseComponent, inventoryName);

   // Reset the cooldown so the battleaxe doesn't fire immediately
   const battleaxe = getItem(inventoryComponent, inventoryName, useInfo.selectedItemSlot);
   if (battleaxe !== null) {
      useInfo.lastBattleaxeChargeTicks = Board.ticks;
   }
   
   useInfo.currentAction = TribeMemberAction.chargeBattleaxe;
}

const itemIsNeededInTech = (tech: TechInfo, itemProgress: ItemRequirements, itemType: ItemType): boolean => {
   // If the item isn't present in the item requirements then it isn't needed
   if (!tech.researchItemRequirements.hasOwnProperty(itemType)) {
      return false;
   }
   
   const amountNeeded = tech.researchItemRequirements[itemType]!;
   const amountCommitted = itemProgress.hasOwnProperty(itemType) ? itemProgress[itemType]! : 0;

   return amountCommitted < amountNeeded;
}

const hasMetTechItemRequirements = (tech: TechInfo, itemProgress: ItemRequirements): boolean => {
   for (const [itemType, itemAmount] of Object.entries(tech.researchItemRequirements)) {
      if (!itemProgress.hasOwnProperty(itemType)) {
         return false;
      }

      if (itemAmount !== itemProgress[itemType as unknown as ItemType]) {
         return false;
      }
   }

   return true;
}

const hasMetTechStudyRequirements = (tech: TechInfo, tribe: Tribe): boolean => {
   if (!tribe.techTreeUnlockProgress.hasOwnProperty(tech.id)) {
      return false;
   }

   if (tech.researchStudyRequirements === 0) {
      return true;
   }

   return tribe.techTreeUnlockProgress[tech.id]!.studyProgress >= tech.researchStudyRequirements;
}

export function processTechUnlock(player: Entity, techID: TechID): void {
   const tech = getTechByID(techID);
   
   const tribeComponent = TribeComponentArray.getComponent(player);
   if (tribeComponent.tribe === null) {
      console.warn("Cannot research a tech without a tribe.");
      return;
   }
   const inventoryComponent = InventoryComponentArray.getComponent(player);

   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   
   // Consume any available items
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      const itemProgress = tribeComponent.tribe.techTreeUnlockProgress[techID]?.itemProgress || {};
      if (itemIsNeededInTech(tech, itemProgress, item.type)) {
         const amountNeeded = tech.researchItemRequirements[item.type]!;
         const amountCommitted = itemProgress.hasOwnProperty(item.type) ? itemProgress[item.type]! : 0;

         const amountToAdd = Math.min(item.count, amountNeeded - amountCommitted);

         item.count -= amountToAdd;
         if (item.count === 0) {
            delete hotbarInventory.itemSlots[itemSlot];
         }

         if (tribeComponent.tribe.techTreeUnlockProgress.hasOwnProperty(techID)) {
            tribeComponent.tribe.techTreeUnlockProgress[techID]!.itemProgress[item.type] = amountCommitted + amountToAdd;
         } else {
            tribeComponent.tribe.techTreeUnlockProgress[techID] = {
               itemProgress: {
                  [item.type]: amountCommitted + amountToAdd
               },
               studyProgress: 0
            };
         }
      }
   }

   if (hasMetTechItemRequirements(tech, tribeComponent.tribe.techTreeUnlockProgress[techID]?.itemProgress || {}) && hasMetTechStudyRequirements(tech, tribeComponent.tribe)) {
      tribeComponent.tribe.unlockTech(techID);
   }
}

const snapRotationToPlayer = (player: Entity, placePosition: Point, rotation: number): number => {
   const playerDirection = player.position.calculateAngleBetween(placePosition);
   let snapRotation = playerDirection - rotation;

   // Snap to nearest PI/2 interval
   snapRotation = Math.round(snapRotation / Math.PI*2) * Math.PI/2;

   snapRotation += rotation;
   return snapRotation;
}

export function shapeStructure(player: Entity, structureID: number, buildingType: BlueprintBuildingType): void {
   if (!Board.entityRecord.hasOwnProperty(structureID)) {
      return;
   }

   const previousStructure = Board.entityRecord[structureID];

   const rotation = snapRotationToPlayer(player, previousStructure.position, previousStructure.rotation);

   let position: Point;
   switch (buildingType) {
      case BlueprintBuildingType.door: {
         position = previousStructure.position.copy();
         break;
      }
      case BlueprintBuildingType.embrasure: {
         position = previousStructure.position.copy();
         position.x += 22 * Math.sin(rotation);
         position.y += 22 * Math.cos(rotation);
         break;
      }
      default: {
         console.warn("Can't shape structure into building type " + BlueprintBuildingType[buildingType]);
         return;
      }
   }

   previousStructure.remove();

   const tribeComponent = TribeComponentArray.getComponent(player);
   createBlueprintEntity(position, buildingType, tribeComponent.tribe, rotation);
}

export function interactWithStructure(player: Entity, structureID: number): void {
   if (!Board.entityRecord.hasOwnProperty(structureID)) {
      return;
   }

   const structure = Board.entityRecord[structureID];
   switch (structure.type) {
      case IEntityType.woodenDoor: {
         toggleDoor(structure);
         break;
      }
      case IEntityType.researchBench: {
         attemptToOccupyResearchBench(structure, player);
         break;
      }
   }
}

export function uninteractWithStructure(player: Entity, structureID: number): void {
   if (!Board.entityRecord.hasOwnProperty(structureID)) {
      return;
   }

   const structure = Board.entityRecord[structureID];
   switch (structure.type) {
      case IEntityType.researchBench: {
         deoccupyResearchBench(structure, player);
         break;
      }
   }
}