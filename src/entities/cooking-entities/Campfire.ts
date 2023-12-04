import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import HeatingEntity from "./CookingEntity";

class Campfire extends HeatingEntity {
   private static readonly MAX_HEALTH = 25;
   
   public static readonly SIZE = 104;

   private static readonly LIFETIME_SECONDS = 30;

   public mass = 2;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Campfire.MAX_HEALTH, false),
      }, EntityTypeConst.campfire);

      const hitbox = new CircularHitbox(this, 0, 0, Campfire.SIZE / 2);
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