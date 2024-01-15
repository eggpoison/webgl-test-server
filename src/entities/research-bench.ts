import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../Entity";
import { HealthComponentArray, StatusEffectComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { StatusEffectComponent } from "../components/StatusEffectComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

export function createResearchBench(position: Point): Entity {
   const bench = new Entity(position, IEntityType.researchBench, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(bench, 1.8, 0, 0, 32 * 4, 20 * 4, 0);
   bench.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(bench, new HealthComponent(40));
   StatusEffectComponentArray.addComponent(bench, new StatusEffectComponent(StatusEffectConst.poisoned));

   return bench;
}

export function onResearchBenchRemove(bench: Entity): void {
   HealthComponentArray.removeComponent(bench);
   StatusEffectComponentArray.removeComponent(bench);
}