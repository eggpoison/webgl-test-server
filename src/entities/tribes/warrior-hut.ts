import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { HealthComponentArray, HutComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { HutComponent } from "../../components/HutComponent";

export const WARRIOR_HUT_SIZE = 104;

export function createWarriorHut(position: Point, tribe: Tribe): Entity {
   const hut = new Entity(position, IEntityType.warriorHut, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(hut, 0, 0, WARRIOR_HUT_SIZE, WARRIOR_HUT_SIZE);
   hut.addHitbox(hitbox);

   HealthComponentArray.addComponent(hut, new HealthComponent(20));
   StatusEffectComponentArray.addComponent(hut, new StatusEffectComponent(StatusEffectConst.poisoned));
   HutComponentArray.addComponent(hut, new HutComponent());
   
   TribeComponentArray.addComponent(hut, {
      tribeType: tribe.tribeType,
      tribe: tribe
   });

   hut.isStatic = true;

   return hut;
}

export function onWarriorHutRemove(hut: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(hut);
   tribeComponent.tribe!.removeWarriorHut(hut);

   HealthComponentArray.removeComponent(hut);
   StatusEffectComponentArray.removeComponent(hut);
   HutComponentArray.removeComponent(hut);
   TribeComponentArray.removeComponent(hut);
}