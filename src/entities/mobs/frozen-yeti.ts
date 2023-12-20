import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const FROZEN_YETI_SIZE = 144;
const HEAD_HITBOX_SIZE = 72;
const HEAD_DISTANCE = 60;
const PAW_SIZE = 32;
const PAW_OFFSET = 80;
const PAW_RESTING_ANGLE = Math.PI / 3.5;

export function createFrozenYeti(position: Point): Entity {
   const frozenYeti = new Entity(position, IEntityType.frozenYeti);

   const bodyHitbox = new CircularHitbox(frozenYeti, 0, 0, FROZEN_YETI_SIZE / 2);
   frozenYeti.addHitbox(bodyHitbox);

   const headHitbox = new CircularHitbox(frozenYeti, 0, HEAD_DISTANCE, HEAD_HITBOX_SIZE / 2);
   frozenYeti.addHitbox(headHitbox);

   // Paw hitboxes
   for (let i = 0; i < 2; i++) {
      const pawDirection = PAW_RESTING_ANGLE * (i === 0 ? -1 : 1);
      const hitbox = new CircularHitbox(frozenYeti, PAW_OFFSET * Math.sin(pawDirection), PAW_OFFSET * Math.cos(pawDirection), PAW_SIZE / 2);
      frozenYeti.addHitbox(hitbox);
   }

   return frozenYeti;
}