import { IEntityType, Point } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../GameObject";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponent } from "../../components/HealthComponent";

export const TRIBE_HUT_SIZE = 88;

export function createTribeHut(position: Point, tribe: Tribe): Entity {
   const hut = new Entity(position, IEntityType.tribeHut);

   const hitbox = new RectangularHitbox(hut, 0, 0, TRIBE_HUT_SIZE, TRIBE_HUT_SIZE);
   hut.addHitbox(hitbox);

   HealthComponentArray.addComponent(hut, new HealthComponent(20));
   
   TribeComponentArray.addComponent(hut, {
      tribeType: tribe.tribeType,
      tribe: tribe
   });

   return hut;
}