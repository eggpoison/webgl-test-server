import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";

const HITBOX_WIDTH = 56 - 0.05;
const HITBOX_HEIGHT = 28 - 0.05;

export function createWoodenWallSpikes(position: Point, tribe: Tribe | null): Entity {
   const spikes = new Entity(position, IEntityType.woodenWallSpikes, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   // @Hack: mass
   spikes.addHitbox(new RectangularHitbox(spikes, Number.EPSILON, 0, 0, HITBOX_WIDTH, HITBOX_HEIGHT, 0));

   HealthComponentArray.addComponent(spikes, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(spikes, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(spikes, new TribeComponent(tribe));

   return spikes;
}

// See wooden-floor-spikes.ts for the collision function

export function onWoodenWallSpikesRemove(spikes: Entity): void {
   HealthComponentArray.removeComponent(spikes);
   StatusEffectComponentArray.removeComponent(spikes);
   TribeComponentArray.removeComponent(spikes);
}