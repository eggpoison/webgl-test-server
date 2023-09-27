import { Point } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Tribe from "../../Tribe";

class TribeHut extends Entity {
   private static readonly MAX_HEALTH = 25;

   public static readonly SIZE = 88;

   public readonly tribe: Tribe;
   
   constructor(position: Point, tribe: Tribe) {
      super(position, {
         health: new HealthComponent(TribeHut.MAX_HEALTH, false)
      }, "tribe_hut");

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(TribeHut.SIZE, TribeHut.SIZE);
      this.addHitbox(hitbox);

      this.isStatic = true;

      this.tribe = tribe;
   }

   public getClientArgs(): [tribeID: number] {
      return [this.tribe.id];
   }
}

export default TribeHut;