import { Point } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Tribe from "../../Tribe";

class TribeHut extends Entity {
   private static readonly MAX_HEALTH = 25;

   private static readonly SIZE = 88;

   public readonly tribe: Tribe;
   
   constructor(position: Point, isNaturallySpawned: boolean, tribe: Tribe) {
      super(position, {
         health: new HealthComponent(TribeHut.MAX_HEALTH, false)
      }, "tribe_hut", isNaturallySpawned);

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: TribeHut.SIZE,
            height: TribeHut.SIZE
         })
      ]);

      this.isStatic = true;

      this.tribe = tribe;
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default TribeHut;