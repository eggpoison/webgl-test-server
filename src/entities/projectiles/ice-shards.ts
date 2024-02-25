import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SettingsConst, StatusEffectConst, randFloat } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, IceShardComponentArray } from "../../components/ComponentArray";
import { addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponentArray, applyStatusEffect } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import { PhysicsComponent, PhysicsComponentArray, applyKnockback } from "../../components/PhysicsComponent";

export function createIceShard(position: Point, moveDirection: number): Entity {
   const iceShard = new Entity(position, IEntityType.iceShardProjectile, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   iceShard.rotation = moveDirection;

   const hitbox = new RectangularHitbox(iceShard, 0.4, 0, 0, 24, 24);
   iceShard.addHitbox(hitbox);
   
   PhysicsComponentArray.addComponent(iceShard, new PhysicsComponent(true, false));
   IceShardComponentArray.addComponent(iceShard, {
      lifetime: randFloat(0.1, 0.2)
   });

   return iceShard;
}

export function tickIceShard(iceShard: Entity): void {
   const iceShardComponent = IceShardComponentArray.getComponent(iceShard.id);
   if (iceShard.ageTicks / SettingsConst.TPS >= iceShardComponent.lifetime) {
      iceShard.remove();
   }
}

export function onIceShardCollision(iceShard: Entity, collidingEntity: Entity): void {
   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   // Shatter the ice spike
   iceShard.remove();

   if (collidingEntity.type === IEntityType.iceSpikes) {
      // Instantly destroy ice spikes
      damageEntity(collidingEntity, 99999, null, PlayerCauseOfDeath.ice_spikes);
   } else {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity.id);
      if (!canDamageEntity(healthComponent, "ice_shards")) {
         return;
      }
      
      const hitDirection = iceShard.position.calculateAngleBetween(collidingEntity.position);

      damageEntity(collidingEntity, 2, null, PlayerCauseOfDeath.ice_shards, "ice_shards");
      applyKnockback(collidingEntity, 150, hitDirection);
      SERVER.registerEntityHit({
         entityPositionX: collidingEntity.position.x,
         entityPositionY: collidingEntity.position.y,
         hitEntityID: collidingEntity.id,
         damage: 2,
         knockback: 150,
         angleFromAttacker: hitDirection,
         attackerID: iceShard.id,
         flags: 0
      });
      addLocalInvulnerabilityHash(healthComponent, "ice_shards", 0.3);

      if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
         applyStatusEffect(collidingEntity, StatusEffectConst.freezing, 3 * SettingsConst.TPS);
      }
   }
}

export function onIceShardRemove(iceShard: Entity): void {
   PhysicsComponentArray.removeComponent(iceShard);
   IceShardComponentArray.removeComponent(iceShard);
}