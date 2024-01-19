import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";

export function createPlanterBox(position: Point): Entity {
   const planterBox = new Entity(position, IEntityType.planterBox, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   planterBox.addHitbox(new RectangularHitbox(planterBox, 1.5, 0, 0, 80, 80, 0));

   HealthComponentArray.addComponent(planterBox, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(planterBox, new StatusEffectComponent(StatusEffectConst.poisoned));
   
   return planterBox;
}

export function onPlanterBoxRemove(planterBox: Entity): void {
   HealthComponentArray.removeComponent(planterBox);
   StatusEffectComponentArray.removeComponent(planterBox);
}