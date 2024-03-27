import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";

export function createPlanterBox(position: Point, rotation: number, tribe: Tribe): Entity {
   const planterBox = new Entity(position, IEntityType.planterBox, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   planterBox.rotation = rotation;

   planterBox.addHitbox(new RectangularHitbox(planterBox.position.x, planterBox.position.y, 1.5, 0, 0, HitboxCollisionTypeConst.hard, planterBox.getNextHitboxLocalID(), planterBox.rotation, 80, 80, 0));

   HealthComponentArray.addComponent(planterBox, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(planterBox, new StatusEffectComponent(StatusEffectConst.poisoned | StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(planterBox, new TribeComponent(tribe));
   
   return planterBox;
}

export function onPlanterBoxJoin(planterBox: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(planterBox.id);
   tribeComponent.tribe.addBuilding(planterBox);
}

export function onPlanterBoxRemove(planterBox: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(planterBox.id);
   tribeComponent.tribe.removeBuilding(planterBox);

   HealthComponentArray.removeComponent(planterBox);
   StatusEffectComponentArray.removeComponent(planterBox);
   TribeComponentArray.removeComponent(planterBox);
}