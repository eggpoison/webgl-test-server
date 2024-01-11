import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { applyStatusEffect } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";

const RADIUS = 55;

export function createSpitPoison(position: Point): Entity {
   const poison = new Entity(position, IEntityType.spitPoison, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   
   // @Hack mass
   const hitbox = new CircularHitbox(poison, Number.EPSILON, 0, 0, RADIUS, 0);
   poison.addHitbox(hitbox);
   
   poison.isStatic = true;
   
   return poison;
}

export function tickSpitPoison(spit: Entity): void {
   const hitbox = spit.hitboxes[0] as CircularHitbox;
   hitbox.radius -= 5 / SETTINGS.TPS;
   spit.hitboxesAreDirty = true;
   if (hitbox.radius <= 0) {
      spit.remove();
   }
}

export function onSpitPoisonCollision(spit: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.slime || collidingEntity.type === IEntityType.slimewisp || !HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   const healthComponent = HealthComponentArray.getComponent(collidingEntity);
   if (!canDamageEntity(healthComponent, "spitPoison")) {
      return;
   }

   damageEntity(collidingEntity, 1, spit, PlayerCauseOfDeath.poison, "spitPoison");
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: 1,
      knockback: 0,
      angleFromAttacker: null,
      attackerID: spit.id,
      flags: 0
   });
   addLocalInvulnerabilityHash(healthComponent, "spitPoison", 0.35);

   if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
      applyStatusEffect(collidingEntity, StatusEffectConst.poisoned, 3 * SETTINGS.TPS);
   }
}