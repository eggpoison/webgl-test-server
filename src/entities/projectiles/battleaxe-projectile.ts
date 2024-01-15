import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Item, PlayerCauseOfDeath, Point, SETTINGS, lerp } from "webgl-test-shared";
import Entity, { NO_COLLISION } from "../../Entity";
import { HealthComponentArray, InventoryComponentArray, InventoryUseComponentArray, PhysicsComponentArray, ThrowingProjectileComponentArray } from "../../components/ComponentArray";
import { addLocalInvulnerabilityHash, applyHitKnockback, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { ThrowingProjectileComponent } from "../../components/ThrowingProjectileComponent";
import Board from "../../Board";
import { findInventoryContainingItem } from "../../components/InventoryComponent";
import { getInventoryUseInfo } from "../../components/InventoryUseComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { SERVER } from "../../server";
import { PhysicsComponent } from "../../components/PhysicsComponent";

const RETURN_TIME_TICKS = 1 * SETTINGS.TPS;

export function createBattleaxeProjectile(position: Point, tribeMemberID: number, item: Item): Entity {
   const battleaxe = new Entity(position, IEntityType.battleaxeProjectile, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   
   const hitbox = new CircularHitbox(battleaxe, 0.6, 0, 0, 32, 0);
   battleaxe.addHitbox(hitbox);
   
   PhysicsComponentArray.addComponent(battleaxe, new PhysicsComponent(true));
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

      if (battleaxe.isColliding(owner) !== NO_COLLISION) {
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
   
   battleaxe.hitboxesAreDirty = true;
}

export function onBattleaxeProjectileCollision(battleaxe: Entity, collidingEntity: Entity): void {
   // Don't hurt the entity who threw the spear
   const spearComponent = ThrowingProjectileComponentArray.getComponent(battleaxe);
   if (collidingEntity.id === spearComponent.tribeMemberID) {
      return;
   }
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      const attackHash = "battleaxe-" + battleaxe.id;
      if (!canDamageEntity(healthComponent, attackHash)) {
         return;
      }
      
      let tribeMember: Entity | null = null;
      if (Board.entityRecord.hasOwnProperty(spearComponent.tribeMemberID)) {
         tribeMember = Board.entityRecord[spearComponent.tribeMemberID];
      }

      // Damage the entity
      const direction = battleaxe.position.calculateAngleBetween(collidingEntity.position);

      // @Incomplete cause of death
      damageEntity(collidingEntity, 4, tribeMember, PlayerCauseOfDeath.spear, attackHash);
      applyHitKnockback(collidingEntity, 150, direction);
      SERVER.registerEntityHit({
         entityPositionX: collidingEntity.position.x,
         entityPositionY: collidingEntity.position.y,
         hitEntityID: collidingEntity.id,
         damage: 4,
         knockback: 150,
         angleFromAttacker: direction,
         attackerID: tribeMember !== null ? tribeMember.id : -1,
         flags: 0
      });
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
   PhysicsComponentArray.removeComponent(battleaxe);
   ThrowingProjectileComponentArray.removeComponent(battleaxe);
}