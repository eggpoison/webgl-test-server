import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { HealthComponentArray, HutComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { HutComponent } from "../../components/HutComponent";
import { TribeComponent } from "../../components/TribeComponent";

export const WARRIOR_HUT_SIZE = 104 - 0.05;

export function createWarriorHut(position: Point, tribe: Tribe): Entity {
   const hut = new Entity(position, IEntityType.warriorHut, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(hut, 2, 0, 0, HitboxCollisionTypeConst.soft, WARRIOR_HUT_SIZE, WARRIOR_HUT_SIZE);
   hut.addHitbox(hitbox);

   HealthComponentArray.addComponent(hut, new HealthComponent(75));
   StatusEffectComponentArray.addComponent(hut, new StatusEffectComponent(StatusEffectConst.poisoned));
   HutComponentArray.addComponent(hut, new HutComponent());
   TribeComponentArray.addComponent(hut, new TribeComponent(tribe));

   return hut;
}

export function onWarriorHutRemove(hut: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(hut.id);
   tribeComponent.tribe.removeWarriorHut(hut);

   HealthComponentArray.removeComponent(hut);
   StatusEffectComponentArray.removeComponent(hut);
   HutComponentArray.removeComponent(hut);
   TribeComponentArray.removeComponent(hut);
}