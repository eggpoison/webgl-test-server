import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Item, ItemType, PlayerCauseOfDeath, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { createItemEntity } from "../item-entity";
import { HealthComponentArray, ThrowingProjectileComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { damageEntity } from "../../components/HealthComponent";
import { ThrowingProjectileComponent } from "../../components/ThrowingProjectileComponent";
import Board from "../../Board";
import { SERVER } from "../../server";
import { PhysicsComponent, PhysicsComponentArray, applyKnockback } from "../../components/PhysicsComponent";
import { EntityRelationship, getEntityRelationship } from "../../components/TribeComponent";

const DROP_VELOCITY = 400;

export function createSpearProjectile(position: Point, tribeMemberID: number, item: Item): Entity {
   const spear = new Entity(position, IEntityType.spearProjectile, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(spear, 0.5, 0, 0, HitboxCollisionTypeConst.soft, 12, 60);
   spear.addHitbox(hitbox);

   PhysicsComponentArray.addComponent(spear, new PhysicsComponent(true, false));
   ThrowingProjectileComponentArray.addComponent(spear, new ThrowingProjectileComponent(tribeMemberID, item));

   return spear;
}

export function tickSpearProjectile(spear: Entity): void {
   if (spear.velocity.lengthSquared() <= DROP_VELOCITY * DROP_VELOCITY) {
      createItemEntity(spear.position.copy(), ItemType.spear, 1);
      spear.remove();
   }
}

export function onSpearProjectileCollision(spear: Entity, collidingEntity: Entity): void {
   // Don't hurt the entity who threw the spear
   const spearComponent = ThrowingProjectileComponentArray.getComponent(spear.id);
   if (Board.entityRecord.hasOwnProperty(spearComponent.tribeMemberID)) {
      if (getEntityRelationship(TribeComponentArray.getComponent(spearComponent.tribeMemberID), collidingEntity) === EntityRelationship.friendly) {
         return;
      }
   }
   
   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   let tribeMember: Entity | null = null;
   if (Board.entityRecord.hasOwnProperty(spearComponent.tribeMemberID)) {
      tribeMember = Board.entityRecord[spearComponent.tribeMemberID];
   }

   const damage = Math.floor(spear.velocity.length() / 140);
   
   // Damage the entity
   const hitDirection = spear.position.calculateAngleBetween(collidingEntity.position);
   damageEntity(collidingEntity, damage, tribeMember, PlayerCauseOfDeath.spear);
   applyKnockback(collidingEntity, 350, hitDirection);
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: damage,
      knockback: 350,
      angleFromAttacker: hitDirection,
      attackerID: tribeMember !== null ? tribeMember.id : -1,
      flags: 0
   });
   
   spear.remove();
}

export function onSpearProjectileRemove(spear: Entity): void {
   PhysicsComponentArray.removeComponent(spear);
   ThrowingProjectileComponentArray.removeComponent(spear);
}