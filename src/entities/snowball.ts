import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SETTINGS, SNOWBALL_SIZES, SnowballSize, StatusEffectConst, randFloat } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import CircularHitbox from "../hitboxes/CircularHitbox";
import { HealthComponentArray, SnowballComponentArray, StatusEffectComponentArray } from "../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, applyHitKnockback, canDamageEntity, damageEntity } from "../components/HealthComponent";
import { StatusEffectComponent } from "../components/StatusEffectComponent";
import { SnowballComponent } from "../components/SnowballComponent";
import Hitbox from "../hitboxes/Hitbox";
import { SERVER } from "../server";
   
const MAX_HEALTHS: ReadonlyArray<number> = [5, 10];

const DAMAGE_VELOCITY_THRESHOLD = 100;

export function createSnowball(position: Point, size: SnowballSize = SnowballSize.small, yetiID: number = ID_SENTINEL_VALUE): Entity {
   const snowball = new Entity(position, IEntityType.snowball, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const mass = size === SnowballSize.small ? 1 : 1.5;
   const hitbox = new CircularHitbox(snowball, mass, 0, 0, SNOWBALL_SIZES[size] / 2, 0);
   snowball.addHitbox(hitbox);

   HealthComponentArray.addComponent(snowball, new HealthComponent(MAX_HEALTHS[size]));
   StatusEffectComponentArray.addComponent(snowball, new StatusEffectComponent(StatusEffectConst.poisoned));
   SnowballComponentArray.addComponent(snowball, new SnowballComponent(yetiID, size, Math.floor(randFloat(10, 15) * SETTINGS.TPS)));
   
   snowball.rotation = 2 * Math.PI * Math.random();

   return snowball;
}

export function tickSnowball(snowball: Entity): void {
   const snowballComponent = SnowballComponentArray.getComponent(snowball);
   
   // Angular velocity
   snowball.rotation += snowballComponent.angularVelocity / SETTINGS.TPS;
   if (snowballComponent.angularVelocity !== 0) {
      const beforeSign = Math.sign(snowballComponent.angularVelocity);
      snowballComponent.angularVelocity -= Math.PI / SETTINGS.TPS * beforeSign;
      if (beforeSign !== Math.sign(snowballComponent.angularVelocity)) {
         snowballComponent.angularVelocity = 0;
      }
   }

   if (snowball.ageTicks >= snowballComponent.lifetimeTicks) {
      snowball.remove();
   }
}

export function onSnowballCollision(snowball: Entity, collidingEntity: Entity): void {
   // Don't let the snowball damage other snowballs
   if (collidingEntity.type === IEntityType.snowball) {
      return;
   }
   // Don't let the snowball damage the yeti which threw it
   if (collidingEntity.type === IEntityType.yeti) {
      const snowballComponent = SnowballComponentArray.getComponent(snowball);
      if (collidingEntity.id === snowballComponent.yetiID) {
         return;
      }
   }
   
   if (snowball.velocity.length() < DAMAGE_VELOCITY_THRESHOLD || snowball.ageTicks >= 2 * SETTINGS.TPS) {
      return;
   }

   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const healthComponent = HealthComponentArray.getComponent(collidingEntity);
      if (canDamageEntity(healthComponent, "snowball")) {
         const hitDirection = snowball.position.calculateAngleBetween(collidingEntity.position);

         damageEntity(collidingEntity, 4, null, PlayerCauseOfDeath.snowball, "snowball");
         applyHitKnockback(collidingEntity, 100, hitDirection);
         SERVER.registerEntityHit({
            entityPositionX: collidingEntity.position.x,
            entityPositionY: collidingEntity.position.y,
            hitEntityID: collidingEntity.id,
            damage: 4,
            knockback: 100,
            angleFromAttacker: hitDirection,
            attackerID: snowball.id,
            flags: 0
         });
         addLocalInvulnerabilityHash(healthComponent, "snowball", 0.3);
      }
   }
}

export function onSnowballRemove(snowball: Entity): void {
   HealthComponentArray.removeComponent(snowball);
   StatusEffectComponentArray.removeComponent(snowball);
   SnowballComponentArray.removeComponent(snowball);
}