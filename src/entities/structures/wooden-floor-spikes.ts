import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";

const SIZE = 48 - 0.05;

export function createWoodenFloorSpikes(position: Point, tribe: Tribe | null): Entity {
   const spikes = new Entity(position, IEntityType.woodenFloorSpikes, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   // @Hack mass
   spikes.addHitbox(new RectangularHitbox(spikes, Number.EPSILON, 0, 0, SIZE, SIZE));

   HealthComponentArray.addComponent(spikes, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(spikes, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(spikes, new TribeComponent(tribe));

   return spikes;
}

export function onWoodenSpikesCollision(spikes: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.woodenFloorSpikes || collidingEntity.type === IEntityType.woodenDoor) {
      return;
   }
   
   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   const healthComponent = HealthComponentArray.getComponent(collidingEntity.id);
   if (!canDamageEntity(healthComponent, "woodenSpikes")) {
      return;
   }
   
   const hitDirection = spikes.position.calculateAngleBetween(collidingEntity.position);
   // @Incomplete: Cause of death
   damageEntity(collidingEntity, 1, spikes, PlayerCauseOfDeath.yeti, "woodenSpikes");
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: 1,
      knockback: 0,
      angleFromAttacker: hitDirection,
      attackerID: spikes.id,
      flags: 0
   });
   // @Temporary
   addLocalInvulnerabilityHash(healthComponent, "woodenSpikes", 0.3);
}

export function onWoodenFloorSpikesRemove(spikes: Entity): void {
   HealthComponentArray.removeComponent(spikes);
   StatusEffectComponentArray.removeComponent(spikes);
   TribeComponentArray.removeComponent(spikes);
}