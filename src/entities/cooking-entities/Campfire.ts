import { Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import HeatingEntity from "./CookingEntity";

class Campfire extends HeatingEntity {
   private static readonly MAX_HEALTH = 25;
   
   public static readonly SIZE = 104;

   private static readonly LIFETIME_SECONDS = 15;

   public mass = 2;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Campfire.MAX_HEALTH, false),
      }, "campfire");

      const hitbox = new CircularHitbox();
      hitbox.radius = Campfire.SIZE / 2;
      this.addHitbox(hitbox);

      this.remainingHeatSeconds = Campfire.LIFETIME_SECONDS;
   }

   public tick(): void {
      super.tick();

      if (this.ageTicks >= Campfire.LIFETIME_SECONDS * SETTINGS.TPS) {
         this.remove();
      }
   }
}

export default Campfire;