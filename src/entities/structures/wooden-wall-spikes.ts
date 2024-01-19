import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

export function createWoodenWallSpikes(position: Point): Entity {
   const spikes = new Entity(position, IEntityType.woodenWallSpikes, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   spikes.addHitbox(new RectangularHitbox(spikes, 1, 0, 0, 64, 40, 0));

   HealthComponentArray.addComponent(spikes, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(spikes, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));

   return spikes;
}

export function onWoodenWallSpikesRemove(spikes: Entity): void {
   HealthComponentArray.removeComponent(spikes);
   StatusEffectComponentArray.removeComponent(spikes);
}