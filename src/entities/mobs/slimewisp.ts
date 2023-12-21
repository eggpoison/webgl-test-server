import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";

const MAX_HEALTH = 3;
const RADIUS = 16;

export function createSlimewisp(position: Point): Entity {
   const slimewisp = new Entity(position, IEntityType.slimewisp, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(slimewisp, 0, 0, RADIUS);
   slimewisp.addHitbox(hitbox);

   HealthComponentArray.addComponent(slimewisp, new HealthComponent(MAX_HEALTH));

   return slimewisp;
}