import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const YETI_SIZE = 128;

export function createYeti(position: Point): Entity {
   const yeti = new Entity(position, IEntityType.yeti);

   const hitbox = new CircularHitbox(yeti, 0, 0, YETI_SIZE / 2);
   yeti.addHitbox(hitbox);

   return yeti;
}