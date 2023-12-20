import { IEntityType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../GameObject";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { addLocalInvulnerabilityHash, damageEntity } from "../../components/HealthComponent";
import { applyStatusEffect } from "../../components/StatusEffectComponent";

export function createIceShard(position: Point): Entity {
   const iceShard = new Entity(position, IEntityType.iceShardProjectile);

   const hitbox = new RectangularHitbox(iceShard, 0, 0, 24, 24);
   iceShard.addHitbox(hitbox);

   return iceShard;
}

// const lifetime = randFloat(0.1, 0.2);

export function tickIceShard(iceShard: Entity): void {

}

export function onIceShardCollision(iceShard: Entity, collidingEntity: Entity): void {
   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   if (collidingEntity.type === IEntityType.iceSpikes) {
      // Instantly destroy ice spikes
      damageEntity(collidingEntity, 99999, 0, 0, null, PlayerCauseOfDeath.ice_spikes, 0);
   } else {
      const hitDirection = iceShard.position.calculateAngleBetween(collidingEntity.position);

      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      damageEntity(collidingEntity, 2, 150, hitDirection, null, PlayerCauseOfDeath.ice_shards, 0, "ice_shards");
      addLocalInvulnerabilityHash(healthComponent, "ice_shards", 0.3);

      if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
         applyStatusEffect(collidingEntity, StatusEffectConst.freezing, 3 * SETTINGS.TPS);
      }
   }

   // Shatter the ice spike
   iceShard.remove();
}