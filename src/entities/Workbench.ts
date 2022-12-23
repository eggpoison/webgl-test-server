import { HitboxType, Point } from "webgl-test-shared";
import Hitbox from "../hitboxes/Hitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import CraftingStation from "./CraftingStation";

class Workbench extends CraftingStation {
   private static readonly PUSH_FORCE_MULTIPLIER = 0.4;
   
   public readonly type = "workbench";

   constructor(position: Point) {
      super(position, new Set<Hitbox<HitboxType>>([
         new RectangularHitbox({
            type: "rectangular",
            width: 80,
            height: 80
         })
      ]), {});

      this.setPushForceMultiplier(Workbench.PUSH_FORCE_MULTIPLIER);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;