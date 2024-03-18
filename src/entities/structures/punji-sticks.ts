import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, PlayerCauseOfDeath, Point, SettingsConst, StatusEffectConst } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray, applyStatusEffect } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import { TribeComponent } from "../../components/TribeComponent";
import Tribe from "../../Tribe";

const FLOOR_HITBOX_SIZE = 48 - 0.05;

const WALL_HITBOX_WIDTH = 56 - 0.05;
const WALL_HITBOX_HEIGHT = 32 - 0.05;

export function createPunjiSticks(position: Point, tribe: Tribe, attachedWallID: number): Entity {
   const punjiSticks = new Entity(position, IEntityType.punjiSticks, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   if (attachedWallID === ID_SENTINEL_VALUE) {
      // Floor hitbox
      // @Hack mass
      punjiSticks.addHitbox(new RectangularHitbox(punjiSticks, Number.EPSILON, 0, 0, HitboxCollisionTypeConst.soft, FLOOR_HITBOX_SIZE, FLOOR_HITBOX_SIZE));
   } else {
      // Wall hitbox
      // @Hack mass
      punjiSticks.addHitbox(new RectangularHitbox(punjiSticks, Number.EPSILON, 0, 0, HitboxCollisionTypeConst.soft, WALL_HITBOX_WIDTH, WALL_HITBOX_HEIGHT));
   }

   HealthComponentArray.addComponent(punjiSticks, new HealthComponent(10));
   StatusEffectComponentArray.addComponent(punjiSticks, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(punjiSticks, new TribeComponent(tribe));

   return punjiSticks;
}

export function onPunjiSticksCollision(punjiSticks: Entity, collidingEntity: Entity): void {
   // @Incomplete: Why is this condition neeeded? Shouldn't be able to be placed colliding with other structures anyway.
   if (collidingEntity.type === IEntityType.spikes || collidingEntity.type === IEntityType.door || collidingEntity.type === IEntityType.wall) {
      return;
   }
   
   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   const healthComponent = HealthComponentArray.getComponent(collidingEntity.id);
   if (!canDamageEntity(healthComponent, "punjiSticks")) {
      return;
   }
   
   const hitDirection = punjiSticks.position.calculateAngleBetween(collidingEntity.position);
   // @Incomplete: Cause of death
   damageEntity(collidingEntity, 1, punjiSticks, PlayerCauseOfDeath.yeti, "punjiSticks");
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: 1,
      knockback: 0,
      angleFromAttacker: hitDirection,
      attackerID: punjiSticks.id,
      flags: 0
   });
   addLocalInvulnerabilityHash(healthComponent, "punjiSticks", 0.3);

   if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
      applyStatusEffect(collidingEntity, StatusEffectConst.poisoned, 2 * SettingsConst.TPS);
   }
}

export function onPunjiSticksRemove(punjiSticks: Entity): void {
   HealthComponentArray.removeComponent(punjiSticks);
   StatusEffectComponentArray.removeComponent(punjiSticks);
   TribeComponentArray.removeComponent(punjiSticks);
}

export function punjiSticksAreAttachedToWall(entity: Entity): boolean {
   const hitbox = entity.hitboxes[0] as RectangularHitbox;
   return Math.abs(hitbox.height - (32 - 0.05)) < 0.01;
}