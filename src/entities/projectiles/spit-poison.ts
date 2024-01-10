import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { addLocalInvulnerabilityHash, damageEntity } from "../../components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { applyStatusEffect } from "../../components/StatusEffectComponent";

const RADIUS = 55;

export function createSpitPoison(position: Point): Entity {
   const poison = new Entity(position, IEntityType.spitPoison, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   
   const hitbox = new CircularHitbox(poison, 0, 0, RADIUS);
   poison.addHitbox(hitbox);
   
   poison.isStatic = true;
   poison.mass = Number.EPSILON; // @Hack
   
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
   damageEntity(collidingEntity, 1, 0, null, spit, PlayerCauseOfDeath.poison, 0, "spitPoison");
   addLocalInvulnerabilityHash(healthComponent, "spitPoison", 0.25);
   if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
      applyStatusEffect(collidingEntity, StatusEffectConst.poisoned, 3 * SETTINGS.TPS);
   }
}