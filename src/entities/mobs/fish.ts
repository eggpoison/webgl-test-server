import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";

const MAX_HEALTH = 5;

const FISH_WIDTH = 7 * 4;
const FISH_HEIGHT = 14 * 4;

export function createFish(position: Point): Entity {
   const fish = new Entity(position, IEntityType.fish, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(fish, 0, 0, FISH_WIDTH, FISH_HEIGHT);
   fish.addHitbox(hitbox);

   HealthComponentArray.addComponent(fish, new HealthComponent(MAX_HEALTH));
   
   return fish;
}