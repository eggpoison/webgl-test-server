import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { TribeComponentArray } from "../../components/ComponentArray";

export const BARREL_SIZE = 80;

export function createBarrel(position: Point): Entity {
   const barrel = new Entity(position, IEntityType.barrel);

   const hitbox = new CircularHitbox(barrel, 0, 0, BARREL_SIZE / 2);
   barrel.addHitbox(hitbox);
   
   TribeComponentArray.addComponent(barrel, {
      tribeType: 0,
      tribe: null
   });

   return barrel;
}