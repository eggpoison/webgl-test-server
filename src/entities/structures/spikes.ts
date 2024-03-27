import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, PlayerCauseOfDeath, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { BuildingMaterialComponentArray, HealthComponentArray, SpikesComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";
import { SpikesComponent } from "../../components/SpikesComponent";
import { BuildingMaterialComponent } from "../../components/BuildingMaterialComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const FLOOR_HITBOX_SIZE = 48 - 0.05;

const WALL_HITBOX_WIDTH = 56 - 0.05;
const WALL_HITBOX_HEIGHT = 28 - 0.05;

export const SPIKE_HEALTHS = [15, 45];

export function createFloorSpikesHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   // @Hack mass
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, Number.EPSILON, 0, 0, HitboxCollisionTypeConst.soft, entity.getNextHitboxLocalID(), entity.rotation, FLOOR_HITBOX_SIZE, FLOOR_HITBOX_SIZE, 0));
   return hitboxes;
}

export function createWallSpikesHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   // @Hack mass
   entity.addHitbox(new RectangularHitbox(entity.position.x, entity.position.y, Number.EPSILON, 0, 0, HitboxCollisionTypeConst.soft, entity.getNextHitboxLocalID(), entity.rotation, WALL_HITBOX_WIDTH, WALL_HITBOX_HEIGHT, 0));
   return hitboxes;
}

export function createSpikes(position: Point, rotation: number, tribe: Tribe, attachedWallID: number): Entity {
   const spikes = new Entity(position, IEntityType.spikes, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   spikes.rotation = rotation;

   const hitboxes = attachedWallID !== 0 ? createWallSpikesHitboxes(spikes) : createFloorSpikesHitboxes(spikes);
   for (let i = 0; i < hitboxes.length; i++) {
      spikes.addHitbox(hitboxes[i]);
   }

   const material = BuildingMaterial.wood;
   
   HealthComponentArray.addComponent(spikes, new HealthComponent(SPIKE_HEALTHS[material]));
   StatusEffectComponentArray.addComponent(spikes, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(spikes, new TribeComponent(tribe));
   SpikesComponentArray.addComponent(spikes, new SpikesComponent(attachedWallID));
   BuildingMaterialComponentArray.addComponent(spikes, new BuildingMaterialComponent(material));

   return spikes;
}

export function onSpikesCollision(spikes: Entity, collidingEntity: Entity): void {
   // @Incomplete: Why is this condition neeeded? Shouldn't be able to be placed colliding with other structures anyway.
   if (collidingEntity.type === IEntityType.spikes || collidingEntity.type === IEntityType.door || collidingEntity.type === IEntityType.wall) {
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

export function onSpikesRemove(spikes: Entity): void {
   HealthComponentArray.removeComponent(spikes);
   StatusEffectComponentArray.removeComponent(spikes);
   TribeComponentArray.removeComponent(spikes);
   SpikesComponentArray.removeComponent(spikes);
   BuildingMaterialComponentArray.removeComponent(spikes);
}

export function spikesAreAttachedToWall(entity: Entity): boolean {
   const hitbox = entity.hitboxes[0] as RectangularHitbox;
   return Math.abs(hitbox.height - (28 - 0.05)) < 0.01;
}