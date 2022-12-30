import { Point } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";

class Workbench extends Entity {
   private static readonly PUSH_FORCE_MULTIPLIER = 0.4;
   
   constructor(position: Point) {
      super(position, {}, "workbench");

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: 80,
            height: 80
         })
      ]);

      this.setPushForceMultiplier(Workbench.PUSH_FORCE_MULTIPLIER);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;