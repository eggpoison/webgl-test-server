import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, Point } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Tribe from "../../Tribe";

class TribeHut extends Entity {
   private static readonly MAX_HEALTH = 25;

   public static readonly SIZE = 88;

   public readonly tribe: Tribe;

   public mass = 1.5;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;
   
   constructor(position: Point, tribe: Tribe) {
      super(position, {
         health: new HealthComponent(TribeHut.MAX_HEALTH, false)
      }, EntityTypeConst.tribe_hut);

      const hitbox = new RectangularHitbox(TribeHut.SIZE, TribeHut.SIZE, 0, 0);
      this.addHitbox(hitbox);

      this.isStatic = true;

      this.tribe = tribe;
   }

   public getClientArgs(): [tribeID: number] {
      return [this.tribe.id];
   }
}

export default TribeHut;