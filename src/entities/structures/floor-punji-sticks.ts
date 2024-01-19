import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

export function createFloorPunjiSticks(position: Point): Entity {
   const punjiSticks = new Entity(position, IEntityType.floorPunjiSticks, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   punjiSticks.addHitbox(new RectangularHitbox(punjiSticks, 1, 0, 0, 40, 40, 0));

   HealthComponentArray.addComponent(punjiSticks, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(punjiSticks, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));

   return punjiSticks;
}

export function onFloorPunjiSticksRemove(punjiSticks: Entity): void {
   HealthComponentArray.removeComponent(punjiSticks);
   StatusEffectComponentArray.removeComponent(punjiSticks);
}