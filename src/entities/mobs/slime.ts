import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, SlimeSize } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const RADII: ReadonlyArray<number> = [32, 44, 60];

export function createSlime(position: Point, size: SlimeSize = SlimeSize.small): Entity {
   const slime = new Entity(position, IEntityType.slime, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(slime, 0, 0, RADII[size]);
   slime.addHitbox(hitbox);

   return slime;
}