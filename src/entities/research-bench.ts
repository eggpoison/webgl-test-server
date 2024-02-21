import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../Entity";
import { HealthComponentArray, ResearchBenchComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { StatusEffectComponent } from "../components/StatusEffectComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Tribe from "../Tribe";
import { TribeComponent } from "../components/TribeComponent";
import { ResearchBenchComponent } from "../components/ResearchBenchComponent";

export function createResearchBench(position: Point, tribe: Tribe): Entity {
   const bench = new Entity(position, IEntityType.researchBench, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(bench, 1.8, 0, 0, 32 * 4, 20 * 4, 0);
   bench.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(bench, new HealthComponent(40));
   StatusEffectComponentArray.addComponent(bench, new StatusEffectComponent(StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(bench, new TribeComponent(tribe));
   ResearchBenchComponentArray.addComponent(bench, new ResearchBenchComponent());

   return bench;
}

export function onResearchBenchRemove(bench: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(bench);
   tribeComponent.tribe!.removeResearchBench(bench);
   
   HealthComponentArray.removeComponent(bench);
   StatusEffectComponentArray.removeComponent(bench);
   TribeComponentArray.removeComponent(bench);
   ResearchBenchComponentArray.removeComponent(bench);
}