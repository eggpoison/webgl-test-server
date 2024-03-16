import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point, StatusEffectConst } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, SpikesComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";
import { SpikesComponent } from "../../components/SpikesComponent";

const FLOOR_HITBOX_SIZE = 48 - 0.05;

const WALL_HITBOX_WIDTH = 56 - 0.05;
const WALL_HITBOX_HEIGHT = 28 - 0.05;

export function createWoodenSpikes(position: Point, tribe: Tribe, attachedWallID: number): Entity {
   const spikes = new Entity(position, IEntityType.woodenSpikes, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   if (attachedWallID === ID_SENTINEL_VALUE) {
      // Floor hitbox
      // @Hack mass
      spikes.addHitbox(new RectangularHitbox(spikes, Number.EPSILON, 0, 0, FLOOR_HITBOX_SIZE, FLOOR_HITBOX_SIZE));
   } else {
      // Wall hitbox
      // @Hack mass
      spikes.addHitbox(new RectangularHitbox(spikes, Number.EPSILON, 0, 0, WALL_HITBOX_WIDTH, WALL_HITBOX_HEIGHT));
   }

   HealthComponentArray.addComponent(spikes, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(spikes, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(spikes, new TribeComponent(tribe));
   SpikesComponentArray.addComponent(spikes, new SpikesComponent(attachedWallID));

   return spikes;
}

export function onWoodenSpikesCollision(spikes: Entity, collidingEntity: Entity): void {
   // @Incomplete: Why is this condition neeeded? Shouldn't be able to be placed colliding with other structures anyway.
   if (collidingEntity.type === IEntityType.woodenSpikes || collidingEntity.type === IEntityType.woodenDoor || collidingEntity.type === IEntityType.wall) {
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

   addLocalInvulnerabilityHash(healthComponent, "woodenSpikes", 0.3);
}

export function onWoodenSpikesRemove(spikes: Entity): void {
   HealthComponentArray.removeComponent(spikes);
   StatusEffectComponentArray.removeComponent(spikes);
   TribeComponentArray.removeComponent(spikes);
}

export function spikesAreAttachedToWall(entity: Entity): boolean {
   const hitbox = entity.hitboxes[0] as RectangularHitbox;
   return Math.abs(hitbox.height - (28 - 0.05)) < 0.01;
}