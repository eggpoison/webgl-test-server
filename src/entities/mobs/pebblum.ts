import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, PlayerCauseOfDeath, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, PebblumComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { PebblumComponent } from "../../components/PebblumComponent";
import { stopEntity } from "../../ai-shared";
import Board from "../../Board";
import { SERVER } from "../../server";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { PhysicsComponent, PhysicsComponentArray, applyKnockback } from "../../components/PhysicsComponent";

export function createPebblum(position: Point, targetID: number): Entity {
   const pebblum = new Entity(position, IEntityType.pebblum, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   // Body
   pebblum.addHitbox(new CircularHitbox(pebblum, 0.4, 0, -4, HitboxCollisionTypeConst.soft, 10 * 2));
   // Nose
   pebblum.addHitbox(new CircularHitbox(pebblum, 0.3, 0, 6, HitboxCollisionTypeConst.soft, 8 * 2));
   
   PhysicsComponentArray.addComponent(pebblum, new PhysicsComponent(true, false));
   HealthComponentArray.addComponent(pebblum, new HealthComponent(20));
   PebblumComponentArray.addComponent(pebblum, new PebblumComponent(targetID));
   
   return pebblum;
}

export function tickPebblum(pebblum: Entity): void {
   const pebblumComponent = PebblumComponentArray.getComponent(pebblum.id);

   if (pebblumComponent.targetEntityID === 0 || !Board.entityRecord.hasOwnProperty(pebblumComponent.targetEntityID)) {
      // @Incomplete
      stopEntity(pebblum);
      return;
   }

   const target = Board.entityRecord[pebblumComponent.targetEntityID];

   const direction = pebblum.position.calculateAngleBetween(target.position);
   if (direction !== pebblum.rotation) {
      pebblum.rotation = direction;

      const physicsComponent = PhysicsComponentArray.getComponent(pebblum.id);
      physicsComponent.hitboxesAreDirty = true;
   }
   pebblum.acceleration.x = 850 * Math.sin(pebblum.rotation);
   pebblum.acceleration.y = 850 * Math.cos(pebblum.rotation);
}

export function onPebblumCollision(pebblum: Entity, collidingEntity: Entity): void {
   const pebblumComponent = PebblumComponentArray.getComponent(pebblum.id);
   if (collidingEntity.id !== pebblumComponent.targetEntityID) {
      return;
   }
   
   const healthComponent = HealthComponentArray.getComponent(collidingEntity.id);
   if (!canDamageEntity(healthComponent, "pebblum")) {
      return;
   }
   
   const hitDirection = pebblum.position.calculateAngleBetween(collidingEntity.position);
   // @Incomplete: Cause of death
   damageEntity(collidingEntity, 1, pebblum, PlayerCauseOfDeath.yeti, "pebblum");
   applyKnockback(collidingEntity, 100, hitDirection);
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: 1,
      knockback: 100,
      angleFromAttacker: hitDirection,
      attackerID: pebblum.id,
      flags: 0
   });
   addLocalInvulnerabilityHash(healthComponent, "pebblum", 0.3);
}

export function onPebblumRemove(pebblum: Entity): void {
   PhysicsComponentArray.removeComponent(pebblum);
   HealthComponentArray.removeComponent(pebblum);
   PebblumComponentArray.removeComponent(pebblum);
}