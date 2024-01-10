import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Item, ItemType, PlayerCauseOfDeath, Point, SETTINGS, lerp } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, ThrowingProjectileComponentArray } from "../../components/ComponentArray";
import { addLocalInvulnerabilityHash, damageEntity } from "../../components/HealthComponent";
import { ThrowingProjectileComponent } from "../../components/ThrowingProjectileComponent";
import Board from "../../Board";
import { findInventoryContainingItem } from "../../components/InventoryComponent";
import { getInventoryUseInfo } from "../../components/InventoryUseComponent";

const SIZE = 40;
const RETURN_TIME_TICKS = 1 * SETTINGS.TPS;

export function createBattleaxeProjectile(position: Point, tribeMemberID: number, item: Item): Entity {
   const battleaxe = new Entity(position, IEntityType.battleaxeProjectile, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   
   const hitbox = new RectangularHitbox(battleaxe, 0, 0, SIZE, SIZE);
   battleaxe.addHitbox(hitbox);
   
   ThrowingProjectileComponentArray.addComponent(battleaxe, new ThrowingProjectileComponent(tribeMemberID, item));

   // @Incomplete: Make the battleaxe not be pushed by collisions 
   
   return battleaxe;
}

export function tickBattleaxeProjectile(battleaxe: Entity): void {
   if (battleaxe.ageTicks < RETURN_TIME_TICKS) {
      battleaxe.rotation -= 6 * Math.PI / SETTINGS.TPS;
   } else {
      const throwingProjectileComponent = ThrowingProjectileComponentArray.getComponent(battleaxe);
      if (!Board.entityRecord.hasOwnProperty(throwingProjectileComponent.tribeMemberID)) {
         battleaxe.remove();
         return;
      }
      
      const owner = Board.entityRecord[throwingProjectileComponent.tribeMemberID];

      if (battleaxe.isColliding(owner)) {
         battleaxe.remove();
         return;
      }

      const ticksSinceReturn = battleaxe.ageTicks - RETURN_TIME_TICKS;
      battleaxe.rotation -= lerp(6 * Math.PI / SETTINGS.TPS, 0, Math.min(ticksSinceReturn / SETTINGS.TPS * 1.25, 1));

      const returnDirection = battleaxe.position.calculateAngleBetween(owner.position);
      battleaxe.velocity.x += 50 * Math.sin(returnDirection);
      battleaxe.velocity.y += 50 * Math.cos(returnDirection);

      // Turn to face the owner
      battleaxe.turn(owner.rotation, ticksSinceReturn / SETTINGS.TPS * Math.PI);
   }
}

export function onBattleaxeProjectileCollision(battleaxe: Entity, collidingEntity: Entity): void {
   // Don't hurt the entity who threw the spear
   const spearComponent = ThrowingProjectileComponentArray.getComponent(battleaxe);
   if (collidingEntity.id === spearComponent.tribeMemberID) {
      return;
   }
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      let tribeMember: Entity | null = null;
      if (Board.entityRecord.hasOwnProperty(spearComponent.tribeMemberID)) {
         tribeMember = Board.entityRecord[spearComponent.tribeMemberID];
      }

      // Damage the entity
      const direction = battleaxe.position.calculateAngleBetween(collidingEntity.position);
      const attackHash = "battleaxe-" + battleaxe.id;
      // @Incomplete cause of death
      damageEntity(collidingEntity, 4, 150, direction, tribeMember, PlayerCauseOfDeath.spear, 0, attackHash);
      addLocalInvulnerabilityHash(HealthComponentArray.getComponent(collidingEntity), attackHash, 0.3);
   }
}

export function onBattleaxeProjectileDeath(battleaxe: Entity): void {
   const throwingProjectileComponent = ThrowingProjectileComponentArray.getComponent(battleaxe);
   if (!Board.entityRecord.hasOwnProperty(throwingProjectileComponent.tribeMemberID)) {
      return;
   }
   
   // Find the inventory the battleaxe item is in
   const owner = Board.entityRecord[throwingProjectileComponent.tribeMemberID];
   const ownerInventoryComponent = InventoryComponentArray.getComponent(owner);
   const inventory = findInventoryContainingItem(ownerInventoryComponent, throwingProjectileComponent.item);
   if (inventory === null) {
      return;
   }
   
   const ownerInventoryUseComponent = InventoryUseComponentArray.getComponent(owner);
   const useInfo = getInventoryUseInfo(ownerInventoryUseComponent, inventory.name);
   useInfo.thrownBattleaxeItemID = -1;
}

export function onBattleaxeProjectileRemove(battleaxe: Entity): void {
   ThrowingProjectileComponentArray.removeComponent(battleaxe);
}