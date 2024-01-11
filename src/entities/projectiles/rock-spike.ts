import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SETTINGS, randFloat } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, RockSpikeProjectileComponentArray } from "../../components/ComponentArray";
import { RockSpikeProjectileComponent } from "../../components/RockSpikeProjectileComponent";
import { addLocalInvulnerabilityHash, applyHitKnockback, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { SERVER } from "../../server";
import Hitbox from "../../hitboxes/Hitbox";

export const ROCK_SPIKE_HITBOX_SIZES = [12 * 2, 16 * 2, 20 * 2];
export const ROCK_SPIKE_MASSES = [1, 1.75, 2.5];

export function createRockSpikeProjectile(spawnPosition: Point, size: number, frozenYetiID: number): Entity {
   const rockSpikeProjectile = new Entity(spawnPosition, IEntityType.rockSpikeProjectile, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(rockSpikeProjectile, ROCK_SPIKE_MASSES[size], 0, 0, ROCK_SPIKE_HITBOX_SIZES[size], 0);
   rockSpikeProjectile.addHitbox(hitbox);

   const lifetimeTicks = Math.floor(randFloat(3.5, 4.5) * SETTINGS.TPS);
   RockSpikeProjectileComponentArray.addComponent(rockSpikeProjectile, new RockSpikeProjectileComponent(size, lifetimeTicks, frozenYetiID));

   rockSpikeProjectile.isStatic = true;
   rockSpikeProjectile.rotation = 2 * Math.PI * Math.random();

   return rockSpikeProjectile;
}

export function tickRockSpikeProjectile(rockSpikeProjectile: Entity): void {
   // Remove if past lifetime
   const rockSpikeProjectileComponent = RockSpikeProjectileComponentArray.getComponent(rockSpikeProjectile);
   if (rockSpikeProjectile.ageTicks >= rockSpikeProjectileComponent.lifetimeTicks) {
      rockSpikeProjectile.remove();
   }
}

export function onRockSpikeProjectileCollision(rockSpikeProjectile: Entity, collidingEntity: Entity): void {
   const rockSpikeProjectileComponent = RockSpikeProjectileComponentArray.getComponent(rockSpikeProjectile);

   // Don't hurt the yeti which created the spike
   if (collidingEntity.id === rockSpikeProjectileComponent.frozenYetiID) {
      return;
   }
   
   // Damage the entity
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      if (!canDamageEntity(healthComponent, "rock_spike")) {
         return;
      }
      
      const hitDirection = rockSpikeProjectile.position.calculateAngleBetween(collidingEntity.position);
      
      damageEntity(collidingEntity, 5, null, PlayerCauseOfDeath.rock_spike, "rock_spike");
      applyHitKnockback(collidingEntity, 200, hitDirection);
      SERVER.registerEntityHit({
         entityPositionX: collidingEntity.position.x,
         entityPositionY: collidingEntity.position.y,
         hitEntityID: collidingEntity.id,
         damage: 5,
         knockback: 200,
         angleFromAttacker: hitDirection,
         attackerID: rockSpikeProjectile.id,
         flags: 0
      });
      addLocalInvulnerabilityHash(healthComponent, "rock_spike", 0.3);
   }
}