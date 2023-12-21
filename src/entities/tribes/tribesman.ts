import { BowItemInfo, COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ITEM_INFO_RECORD, ITEM_TYPE_RECORD, Point, TRIBE_INFO_RECORD, ToolItemInfo, TribeMemberAction, TribeType, angle, distance } from "webgl-test-shared";
import Entity from "../../GameObject";
import Tribe from "../../Tribe";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, PlayerComponentArray, StatusEffectComponentArray, TribeComponentArray, TribeMemberComponentArray } from "../../components/ComponentArray";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, addItemToSlot, createNewInventory, getInventory, getItem, pickupItemEntity, removeItemFromInventory } from "../../components/InventoryComponent";
import { InventoryUseComponent } from "../../components/InventoryUseComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { AttackToolType, EntityRelationship, attackEntity, calculateAttackTarget, calculateRadialAttackTargets, getEntityAttackToolType, getTribeMemberRelationship, tickTribeMember, useItem } from "./tribe-member";
import { getClosestEntity, getEntitiesInVisionRange, willStopAtDesiredDistance } from "../../ai-shared";
import { TribeMemberComponent } from "../../components/TribeMemberComponent";

const RADIUS = 28;
const INVENTORY_SIZE = 3;
const VISION_RANGE = 320;

const SLOW_TERMINAL_VELOCITY = 75;
const SLOW_ACCELERATION = 150;

const TERMINAL_VELOCITY = 150;
const ACCELERATION = 300;

/** How far away from the entity the attack is done */
const ATTACK_OFFSET = 50;
/** Max distance from the attack position that the attack will be registered from */
const ATTACK_RADIUS = 50;

/** How far the tribesmen will try to stay away from the entity they're attacking */
const DESIRED_MELEE_ATTACK_DISTANCE = 60;
const DESIRED_RANGED_ATTACK_DISTANCE = 260;

export function createTribesman(position: Point, tribeType: TribeType, tribe: Tribe): Entity {
   const tribesman = new Entity(position, IEntityType.tribesman, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(tribesman, 0, 0, RADIUS);
   tribesman.addHitbox(hitbox);
   
   const tribeInfo = TRIBE_INFO_RECORD[tribeType];
   HealthComponentArray.addComponent(tribesman, new HealthComponent(tribeInfo.maxHealthWorker));
   StatusEffectComponentArray.addComponent(tribesman, new StatusEffectComponent());

   TribeComponentArray.addComponent(tribesman, {
      tribeType: tribeType,
      tribe: tribe
   });
   TribeMemberComponentArray.addComponent(tribesman, new TribeMemberComponent(tribeType));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(tribesman, inventoryComponent);
   const hotbarInventory = createNewInventory(inventoryComponent, "hotbar", INVENTORY_SIZE, 1, true);
   createNewInventory(inventoryComponent, "armourSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpackSlot", 1, 1, false);
   createNewInventory(inventoryComponent, "backpack", -1, -1, false);

   InventoryUseComponentArray.addComponent(tribesman, new InventoryUseComponent(hotbarInventory));
   
   return tribesman;
}

export function tickTribesman(tribesman: Entity): void {
   tickTribeMember(tribesman);
   
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);

   const hotbarInventory = getInventory(inventoryComponent, "hotbar");
   const armourInventory = getInventory(inventoryComponent, "armourSlot");

   // Automatically equip armour from the hotbar
   if (!armourInventory.itemSlots.hasOwnProperty(1)) {
      for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
         if (hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
            const item = hotbarInventory.itemSlots[itemSlot];
            if (ITEM_TYPE_RECORD[item.type] === "armour") {
               addItemToSlot(inventoryComponent, "armourSlot", 1, item.type, 1);
               removeItemFromInventory(inventoryComponent, "hotbar", itemSlot);
               break;
            }
         }
      }
   }

   const visibleEntities = getEntitiesInVisionRange(tribesman.position.x, tribesman.position.y, VISION_RANGE);

   // @Cleanup: don't do here
   let idx = visibleEntities.indexOf(tribesman);
   while (idx !== -1) {
      visibleEntities.splice(idx, 1);
      idx = visibleEntities.indexOf(tribesman);
   }

   // @Cleanup: A nicer way to do this might be to sort the visible entities array based on the 'threat level' of each entity

   // Categorise visible entities
   const visibleEnemies = new Array<Entity>();
   const visibleEnemyBuildings = new Array<Entity>();
   const visibleHostileMobs = new Array<Entity>();
   const visibleResources = new Array<Entity>();
   for (let i = 0; i < visibleEntities.length; i++) {
      const entity = visibleEntities[i];

      switch (getTribeMemberRelationship(tribesman, entity)) {
         case EntityRelationship.enemy: {
            visibleEnemies.push(entity);
            break;
         }
         case EntityRelationship.enemyBuilding: {
            visibleEnemyBuildings.push(entity);
            break;
         }
         case EntityRelationship.hostileMob: {
            visibleHostileMobs.push(entity);
            break;
         }
         case EntityRelationship.resource: {
            visibleResources.push(entity);
            break;
         }
      }
   }

   // Escape from enemies when low on health
   const healthComponent = HealthComponentArray.getComponent(tribesman);
   if (healthComponent.health <= healthComponent.maxHealth / 2 && visibleEnemies.length > 0) {
      escape(tribesman, visibleEnemies);
      // @Incomplete
      // this.lastAIType = TribesmanAIType.escaping;
      // this.currentAction = TribeMemberAction.none;
      return;
   }

   // If the player is interacting with the tribesman, move towards the player
   for (const entity of visibleEntities) {
      if (entity.type !== IEntityType.player) {
         continue;
      }

      const playerComponent = PlayerComponentArray.getComponent(entity);
      if (playerComponent.interactingEntityID === tribesman.id) {
         tribesman.rotation = tribesman.position.calculateAngleBetween(entity.position);
         tribesman.hitboxesAreDirty = true;
         const distance = tribesman.position.calculateDistanceBetween(entity.position);
         if (willStopAtDesiredDistance(tribesman, 80, distance)) {
            tribesman.terminalVelocity = 0;
            tribesman.acceleration.x = 0;
            tribesman.acceleration.y = 0;
         } else {
            tribesman.terminalVelocity = TERMINAL_VELOCITY;
            tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
            tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);
         }

         // @Incomplete
         // this.lastAIType = TribesmanAIType.idle;
         // this.currentAction = TribeMemberAction.none;
         return;
      }
   }
      
   // Attack enemies
   if (visibleEnemies.length > 0) {
      huntEntity(tribesman, getClosestEntity(tribesman, visibleEnemies));
      // @Incomplete
      // this.lastAIType = TribesmanAIType.attacking;
      return;
   }
   
   // Attack enemy buildings
   if (visibleEnemyBuildings.length > 0) {
      huntEntity(tribesman, getClosestEntity(tribesman, visibleEnemyBuildings));
      // @Incomplete
      // this.lastAIType = TribesmanAIType.attacking;
      return;
   }
   
   // Attack hostile mobs
   if (visibleHostileMobs.length > 0) {
      huntEntity(tribesman, getClosestEntity(tribesman, visibleHostileMobs));
      // @Incomplete
      // this.lastAIType = TribesmanAIType.attacking;
      return;
   }
}

const escape = (tribesman: Entity, visibleEnemies: ReadonlyArray<Entity>): void => {
   // Calculate the escape position based on the position of all visible enemies
   let averageEnemyX = 0;
   let averageEnemyY = 0;
   for (let i = 0; i < visibleEnemies.length; i++) {
      const enemy = visibleEnemies[i];

      let distance = tribesman.position.calculateDistanceBetween(enemy.position);
      if (distance > VISION_RANGE) {
         distance = VISION_RANGE;
      }
      const weight = Math.pow(1 - distance / VISION_RANGE / 1.25, 0.5);

      const relativeX = (enemy.position.x - tribesman.position.x) * weight;
      const relativeY = (enemy.position.y - tribesman.position.y) * weight;

      averageEnemyX += relativeX + tribesman.position.x;
      averageEnemyY += relativeY + tribesman.position.y;
      if (isNaN(averageEnemyX) || isNaN(averageEnemyY)) {
         console.warn("NaN!");
         return;
      }
   }
   averageEnemyX /= visibleEnemies.length;
   averageEnemyY /= visibleEnemies.length;

   // Run away from that position
   const runDirection = angle(averageEnemyX - tribesman.position.x, averageEnemyY - tribesman.position.y) + Math.PI;
   tribesman.rotation = runDirection;
   tribesman.hitboxesAreDirty = true;
   tribesman.acceleration.x = ACCELERATION * Math.sin(runDirection);
   tribesman.acceleration.y = ACCELERATION * Math.cos(runDirection);
   tribesman.terminalVelocity = TERMINAL_VELOCITY;
}

// @Cleanup: Copy and paste

const getBestWeaponSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   let bestWeaponLevel = -1;
   let bestWeaponItemSlot = -1;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "sword" || itemCategory === "bow") {
         if ((itemInfo as ToolItemInfo).level > bestWeaponLevel) {
            bestWeaponLevel = (itemInfo as ToolItemInfo).level;
            bestWeaponItemSlot = itemSlot;
         }
      }
   }

   if (bestWeaponItemSlot !== -1) {
      return bestWeaponItemSlot;
   }
   return null;
}

const getBestPickaxeSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   let bestPickaxeLevel = -1;
   let bestPickaxeItemSlot = -1;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "pickaxe") {
         if ((itemInfo as ToolItemInfo).level > bestPickaxeLevel) {
            bestPickaxeLevel = (itemInfo as ToolItemInfo).level;
            bestPickaxeItemSlot = itemSlot;
         }
      }
   }

   if (bestPickaxeItemSlot !== -1) {
      return bestPickaxeItemSlot;
   }
   return null;
}

const getBestAxeSlot = (tribesman: Entity): number | null => {
   const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
   const hotbarInventory = getInventory(inventoryComponent, "hotbar");

   let bestAxeLevel = -1;
   let bestAxeItemSlot = -1;
   for (let itemSlot = 1; itemSlot <= hotbarInventory.width * hotbarInventory.height; itemSlot++) {
      if (!hotbarInventory.itemSlots.hasOwnProperty(itemSlot)) {
         continue;
      }

      const item = hotbarInventory.itemSlots[itemSlot];
      
      const itemInfo = ITEM_INFO_RECORD[item.type];
      const itemCategory = ITEM_TYPE_RECORD[item.type];
      if (itemCategory === "axe") {
         if ((itemInfo as ToolItemInfo).level > bestAxeLevel) {
            bestAxeLevel = (itemInfo as ToolItemInfo).level;
            bestAxeItemSlot = itemSlot;
         }
      }
   }

   if (bestAxeItemSlot !== -1) {
      return bestAxeItemSlot;
   }
   return null;
}

const calculateDistanceFromEntity = (tribesman: Entity, entity: Entity): number => {
   let minDistance = tribesman.position.calculateDistanceBetween(entity.position);
   for (const hitbox of entity.hitboxes) {
      if (hitbox.hasOwnProperty("radius")) {
         const rawDistance = distance(tribesman.position.x, tribesman.position.y, hitbox.object.position.x + hitbox.offset.x, hitbox.object.position.y + hitbox.offset.y);
         const hitboxDistance = rawDistance - RADIUS - (hitbox as CircularHitbox).radius;
         if (hitboxDistance < minDistance) {
            minDistance = hitboxDistance;
         }
      } else {
         // @Incomplete: Rectangular hitbox dist
      }
   }
   return minDistance;
}

const engageTargetRanged = (tribesman: Entity, target: Entity): void => {
   const distance = calculateDistanceFromEntity(tribesman, target);
   tribesman.rotation = tribesman.position.calculateAngleBetween(target.position);
   tribesman.hitboxesAreDirty = true;
   if (willStopAtDesiredDistance(tribesman, DESIRED_RANGED_ATTACK_DISTANCE, distance)) {
      tribesman.terminalVelocity = SLOW_TERMINAL_VELOCITY;
      tribesman.acceleration.x = SLOW_ACCELERATION * Math.sin(tribesman.rotation + Math.PI);
      tribesman.acceleration.y = SLOW_ACCELERATION * Math.cos(tribesman.rotation + Math.PI);
   } else {
      tribesman.terminalVelocity = SLOW_TERMINAL_VELOCITY;
      tribesman.acceleration.x = SLOW_ACCELERATION * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = SLOW_ACCELERATION * Math.cos(tribesman.rotation);
   }
}

const engageTargetMelee = (tribesman: Entity, target: Entity): void => {
   const distance = calculateDistanceFromEntity(tribesman, target);
   tribesman.rotation = tribesman.position.calculateAngleBetween(target.position);
   tribesman.hitboxesAreDirty = true;
   if (willStopAtDesiredDistance(tribesman, DESIRED_MELEE_ATTACK_DISTANCE, distance)) {
      tribesman.terminalVelocity = SLOW_TERMINAL_VELOCITY;
      tribesman.acceleration.x = SLOW_ACCELERATION * Math.sin(tribesman.rotation + Math.PI);
      tribesman.acceleration.y = SLOW_ACCELERATION * Math.cos(tribesman.rotation + Math.PI);
   } else {
      tribesman.terminalVelocity = TERMINAL_VELOCITY;
      tribesman.acceleration.x = ACCELERATION * Math.sin(tribesman.rotation);
      tribesman.acceleration.y = ACCELERATION * Math.cos(tribesman.rotation);
   }
}

const doMeleeAttack = (tribesman: Entity): void => {
   // Find the attack target
   const attackTargets = calculateRadialAttackTargets(tribesman, ATTACK_OFFSET, ATTACK_RADIUS);
   const target = calculateAttackTarget(tribesman, attackTargets);

   // Register the hit
   if (target !== null) {
      const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);
      attackEntity(tribesman, target, inventoryUseComponent.selectedItemSlot);
   }
}

const huntEntity = (tribesman: Entity, huntedEntity: Entity): void => {
   // Find the best tool for the job
   let bestToolSlot: number | null = null;
   const attackToolType = getEntityAttackToolType(huntedEntity);
   switch (attackToolType) {
      case AttackToolType.weapon: {
         bestToolSlot = getBestWeaponSlot(tribesman);
         if (bestToolSlot === null) {
            bestToolSlot = getBestPickaxeSlot(tribesman);
            if (bestToolSlot === null) {
               bestToolSlot = getBestAxeSlot(tribesman);
            }
         }
         break;
      }
      case AttackToolType.pickaxe: {
         bestToolSlot = getBestPickaxeSlot(tribesman);
         break;
      }
      case AttackToolType.axe: {
         bestToolSlot = getBestAxeSlot(tribesman);
         break;
      }
   }

   const inventoryUseComponent = InventoryUseComponentArray.getComponent(tribesman);

   if (bestToolSlot !== null) {
      const inventoryComponent = InventoryComponentArray.getComponent(tribesman);
      
      inventoryUseComponent.selectedItemSlot = bestToolSlot;

      // Don't do a melee attack if using a bow, instead charge the bow
      const selectedItem = getItem(inventoryComponent, "hotbar", inventoryUseComponent.selectedItemSlot)!;
      const weaponCategory = ITEM_TYPE_RECORD[selectedItem.type];
      if (weaponCategory === "bow") {
         // If the tribesman is only just charging the bow, reset the cooldown to prevent the bow firing immediately
         if (inventoryUseComponent.currentAction !== TribeMemberAction.charge_bow) {
            const itemInfo = ITEM_INFO_RECORD[selectedItem.type] as BowItemInfo;
            inventoryUseComponent.bowCooldownTicks = itemInfo.shotCooldownTicks;
         }
         inventoryUseComponent.currentAction = TribeMemberAction.charge_bow;
         
         engageTargetRanged(tribesman, huntedEntity);

         // If the bow is fully charged, fire it
         if (inventoryUseComponent.bowCooldownTicks === 0) {
            useItem(tribesman, selectedItem, inventoryUseComponent.selectedItemSlot);
         }

         return;
      }
   }

   // If a melee attack is being done, update to attack at melee distance
   engageTargetMelee(tribesman, huntedEntity);

   inventoryUseComponent.currentAction = TribeMemberAction.none;
   
   doMeleeAttack(tribesman);
}

export function onTribesmanCollision(player: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      pickupItemEntity(player, collidingEntity);
   }
}