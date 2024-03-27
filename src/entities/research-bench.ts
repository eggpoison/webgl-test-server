import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../Entity";
import { HealthComponentArray, ResearchBenchComponentArray, TribeComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../components/StatusEffectComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Tribe from "../Tribe";
import { TribeComponent } from "../components/TribeComponent";
import { ResearchBenchComponent } from "../components/ResearchBenchComponent";

export function createResearchBench(position: Point, rotation: number, tribe: Tribe): Entity {
   const bench = new Entity(position, IEntityType.researchBench, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   bench.rotation = rotation;

   const hitbox = new RectangularHitbox(bench.position.x, bench.position.y, 1.8, 0, 0, HitboxCollisionTypeConst.hard, bench.getNextHitboxLocalID(), bench.rotation, 32 * 4, 20 * 4, 0);
   bench.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(bench, new HealthComponent(40));
   StatusEffectComponentArray.addComponent(bench, new StatusEffectComponent(StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(bench, new TribeComponent(tribe));
   ResearchBenchComponentArray.addComponent(bench, new ResearchBenchComponent());

   return bench;
}

export function onResearchBenchJoin(researchBench: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(researchBench.id);
   tribeComponent.tribe.addResearchBench(researchBench);
}

export function onResearchBenchRemove(researchBench: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(researchBench.id);
   tribeComponent.tribe.removeResearchBench(researchBench);
   
   HealthComponentArray.removeComponent(researchBench);
   StatusEffectComponentArray.removeComponent(researchBench);
   TribeComponentArray.removeComponent(researchBench);
   ResearchBenchComponentArray.removeComponent(researchBench);
}