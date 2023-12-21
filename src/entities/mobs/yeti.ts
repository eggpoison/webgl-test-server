import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";

const YETI_SIZE = 128;

export function createYeti(position: Point): Entity {
   const yeti = new Entity(position, IEntityType.yeti, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(yeti, 0, 0, YETI_SIZE / 2);
   yeti.addHitbox(hitbox);

   HealthComponentArray.addComponent(yeti, new HealthComponent(100));

   return yeti;
}