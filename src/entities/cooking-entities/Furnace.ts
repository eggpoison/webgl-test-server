import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, Point } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import HeatingEntity from "./CookingEntity";

class Furnace extends HeatingEntity {
   private static readonly MAX_HEALTH = 25;
   
   public static readonly SIZE = 80;

   public mass = 2.5;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;
   
   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Furnace.MAX_HEALTH, false)
      }, EntityTypeConst.furnace);

      const hitbox = new RectangularHitbox(this, 0, 0, Furnace.SIZE, Furnace.SIZE);
      this.addHitbox(hitbox);
   }
}

export default Furnace;