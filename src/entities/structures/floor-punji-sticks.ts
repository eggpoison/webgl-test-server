import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, SettingsConst, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray, applyStatusEffect } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import { TribeComponent } from "../../components/TribeComponent";
import Tribe from "../../Tribe";

const SIZE = 48 - 0.05;

export function createFloorPunjiSticks(position: Point, tribe: Tribe | null): Entity {
   const punjiSticks = new Entity(position, IEntityType.floorPunjiSticks, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   // @Hack: mass
   punjiSticks.addHitbox(new RectangularHitbox(punjiSticks, Number.EPSILON, 0, 0, SIZE, SIZE));

   HealthComponentArray.addComponent(punjiSticks, new HealthComponent(10));
   StatusEffectComponentArray.addComponent(punjiSticks, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(punjiSticks, new TribeComponent(tribe));

   return punjiSticks;
}

export function onPunjiSticksCollision(punjiSticks: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.woodenFloorSpikes || collidingEntity.type === IEntityType.woodenDoor) {
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

export function onFloorPunjiSticksRemove(punjiSticks: Entity): void {
   HealthComponentArray.removeComponent(punjiSticks);
   StatusEffectComponentArray.removeComponent(punjiSticks);
   TribeComponentArray.removeComponent(punjiSticks);
}