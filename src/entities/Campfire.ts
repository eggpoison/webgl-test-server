import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import HeatingEntity from "./CookingEntity";

class Campfire extends HeatingEntity {
   private static readonly MAX_HEALTH = 25;
   
   private static readonly RADIUS = 40;

   public mass = 2;

   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Campfire.MAX_HEALTH, false),
      }, "campfire", isNaturallySpawned);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(Campfire.RADIUS);
      this.addHitbox(hitbox);
   }
}

export default Campfire;