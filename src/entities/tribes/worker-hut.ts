import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { HealthComponentArray, HutComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { HutComponent } from "../../components/HutComponent";
import { TribeComponent } from "../../components/TribeComponent";

export const WORKER_HUT_SIZE = 88;

export function createWorkerHut(position: Point, rotation: number, tribe: Tribe): Entity {
   const hut = new Entity(position, IEntityType.workerHut, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   hut.rotation = rotation;

   const hitbox = new RectangularHitbox(hut, 1.8, 0, 0, HitboxCollisionTypeConst.soft, WORKER_HUT_SIZE, WORKER_HUT_SIZE);
   hut.addHitbox(hitbox);

   HealthComponentArray.addComponent(hut, new HealthComponent(50));
   StatusEffectComponentArray.addComponent(hut, new StatusEffectComponent(StatusEffectConst.poisoned));
   HutComponentArray.addComponent(hut, new HutComponent());
   TribeComponentArray.addComponent(hut, new TribeComponent(tribe));

   return hut;
}

export function onWorkerHutJoin(hut: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(hut.id);
   tribeComponent.tribe.registerNewWorkerHut(hut);
}

export function onWorkerHutRemove(hut: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(hut.id);
   tribeComponent.tribe.removeWorkerHut(hut);
   
   HealthComponentArray.removeComponent(hut);
   StatusEffectComponentArray.removeComponent(hut);
   HutComponentArray.removeComponent(hut);
   TribeComponentArray.removeComponent(hut);
}