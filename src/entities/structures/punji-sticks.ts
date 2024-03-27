import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, PlayerCauseOfDeath, Point, SettingsConst, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray, applyStatusEffect } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import { TribeComponent } from "../../components/TribeComponent";
import Tribe from "../../Tribe";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const FLOOR_HITBOX_SIZE = 48 - 0.05;

const WALL_HITBOX_WIDTH = 56 - 0.05;
const WALL_HITBOX_HEIGHT = 32 - 0.05;

export function createFloorPunjiSticksHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   // @Hack mass
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, Number.EPSILON, 0, 0, HitboxCollisionTypeConst.soft, entity.getNextHitboxLocalID(), entity.rotation, FLOOR_HITBOX_SIZE, FLOOR_HITBOX_SIZE, 0));
   return hitboxes;
}

export function createWallPunjiSticksHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   // @Hack mass
   entity.addHitbox(new RectangularHitbox(entity.position.x, entity.position.y, Number.EPSILON, 0, 0, HitboxCollisionTypeConst.soft, entity.getNextHitboxLocalID(), entity.rotation, WALL_HITBOX_WIDTH, WALL_HITBOX_HEIGHT, 0));
   return hitboxes;
}

export function createPunjiSticks(position: Point, rotation: number, tribe: Tribe, attachedWallID: number): Entity {
   const punjiSticks = new Entity(position, IEntityType.punjiSticks, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   punjiSticks.rotation = rotation;

   const hitboxes = attachedWallID !== 0 ? createWallPunjiSticksHitboxes(punjiSticks) : createFloorPunjiSticksHitboxes(punjiSticks);
   for (let i = 0; i < hitboxes.length; i++) {
      punjiSticks.addHitbox(hitboxes[i]);
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