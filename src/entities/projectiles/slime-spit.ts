import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, SlimeSpitComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { SlimeSpitComponent } from "../../components/SlimeSpitComponent";
import { createSpitPoison } from "./spit-poison";
import { applyHitKnockback, damageEntity } from "../../components/HealthComponent";
import { applyStatusEffect } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import Hitbox from "../../hitboxes/Hitbox";

const BREAK_VELOCITY = 100;

const SIZES = [20, 30];

export function createSlimeSpit(position: Point, size: number): Entity {
   const spit = new Entity(position, IEntityType.slimeSpit, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitboxSize = SIZES[size];
   const hitbox = new RectangularHitbox(spit, 0.2, 0, 0, hitboxSize, hitboxSize, 0);
   spit.addHitbox(hitbox);

   SlimeSpitComponentArray.addComponent(spit, new SlimeSpitComponent(size));

   return spit;
}

export function tickSlimeSpit(spit: Entity): void {
   if (spit.velocity.lengthSquared() <= BREAK_VELOCITY * BREAK_VELOCITY) {
      spit.remove();
   }
}

export function onSlimeSpitCollision(spit: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.slime || collidingEntity.type === IEntityType.slimewisp || !HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   const spitComponent = SlimeSpitComponentArray.getComponent(spit);
   const damage = spitComponent.size === 0 ? 2 : 3;
   const hitDirection = spit.position.calculateAngleBetween(collidingEntity.position);

   damageEntity(collidingEntity, damage, spit, PlayerCauseOfDeath.poison);
   applyHitKnockback(collidingEntity, 150, hitDirection);
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: damage,
      knockback: 150,
      angleFromAttacker: hitDirection,
      attackerID: spit.id,
      flags: 0
   });
   
   if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
      applyStatusEffect(collidingEntity, StatusEffectConst.poisoned, 2 * SETTINGS.TPS);
   }

   spit.remove();
}

export function onSlimeSpitDeath(spit: Entity): void {
   const spitComponent = SlimeSpitComponentArray.getComponent(spit);
   if (spitComponent.size === 1) {
      createSpitPoison(spit.position.copy());
   }
}