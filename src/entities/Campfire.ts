import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import HeatingEntity from "./CookingEntity";

class Campfire extends HeatingEntity {
   private static readonly MAX_HEALTH = 25;
   
   public static readonly SIZE = 14;

   public mass = 2;

   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Campfire.MAX_HEALTH, false),
      }, "campfire", isNaturallySpawned);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(Campfire.SIZE / 2);
      this.addHitbox(hitbox);
   }
}

export default Campfire;