import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { BerryBushComponentArray, HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";

const BERRY_BUSH_RADIUS = 40;

export function createBerryBush(position: Point): Entity {
   const berryBush = new Entity(position, IEntityType.berryBush);

   const hitbox = new CircularHitbox(berryBush, 0, 0, BERRY_BUSH_RADIUS);
   berryBush.addHitbox(hitbox);

   HealthComponentArray.addComponent(berryBush, new HealthComponent(10));

   BerryBushComponentArray.addComponent(berryBush, {
      numBerries: 5
   });

   berryBush.isStatic = true;

   return berryBush;
}