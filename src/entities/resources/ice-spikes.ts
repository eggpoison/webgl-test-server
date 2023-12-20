import { IEntityType, PlayerCauseOfDeath, Point, SETTINGS, StatusEffectConst, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, damageEntity } from "../../components/HealthComponent";
import { applyStatusEffect } from "../../components/StatusEffectComponent";
import { createIceShard } from "../projectiles/ice-shards";

const ICE_SPIKE_RADIUS = 40;

export function createIceSpikes(position: Point): Entity {
   const iceSpikes = new Entity(position, IEntityType.iceSpikes);

   const hitbox = new CircularHitbox(iceSpikes, 0, 0, ICE_SPIKE_RADIUS);
   iceSpikes.addHitbox(hitbox);

   HealthComponentArray.addComponent(iceSpikes, new HealthComponent(5));

   iceSpikes.isStatic = true;

   return iceSpikes;
}

export function onIceSpikesCollision(iceSpikes: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.yeti || collidingEntity.type === IEntityType.frozenYeti || collidingEntity.type === IEntityType.iceSpikes || collidingEntity.type === IEntityType.snowball) {
      return;
   }

   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const hitDirection = iceSpikes.position.calculateAngleBetween(collidingEntity.position);
      
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      damageEntity(collidingEntity, 1, 180, hitDirection, iceSpikes, PlayerCauseOfDeath.ice_spikes, 0, "ice_spikes");
      addLocalInvulnerabilityHash(healthComponent, "ice_spikes", 0.3);

      if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
         applyStatusEffect(collidingEntity, StatusEffectConst.freezing, 5 * SETTINGS.TPS);
      }
   }
}

export function onIceSpikesDeath(iceSpikes: Entity): void {
   // 
   // Explode into a bunch of ice spikes
   // 
   
   const numProjectiles = randInt(3, 4);

   for (let i = 1; i <= numProjectiles; i++) {
      const moveDirection = 2 * Math.PI * Math.random();
      
      const position = iceSpikes.position.copy();
      position.x += 10 * Math.sin(moveDirection);
      position.y += 10 * Math.cos(moveDirection);

      const iceShard = createIceShard(position);

      iceShard.rotation = moveDirection;
      iceShard.velocity.x = 700 * Math.sin(moveDirection);
      iceShard.velocity.y = 700 * Math.cos(moveDirection);
      iceShard.terminalVelocity = 700;
   }
}