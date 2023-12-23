import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../GameObject";
import { HealthComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

export const TRIBE_HUT_SIZE = 88;

export function createTribeHut(position: Point, tribe: Tribe): Entity {
   const hut = new Entity(position, IEntityType.tribeHut, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(hut, 0, 0, TRIBE_HUT_SIZE, TRIBE_HUT_SIZE);
   hut.addHitbox(hitbox);

   HealthComponentArray.addComponent(hut, new HealthComponent(20));
   StatusEffectComponentArray.addComponent(hut, new StatusEffectComponent());
   
   TribeComponentArray.addComponent(hut, {
      tribeType: tribe.tribeType,
      tribe: tribe
   });

   hut.isStatic = true;

   return hut;
}