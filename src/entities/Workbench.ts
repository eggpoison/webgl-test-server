import { HitboxType, Point } from "webgl-test-shared";
import Hitbox from "../hitboxes/Hitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import CraftingStation from "./CraftingStation";

class Workbench extends CraftingStation {
   public readonly type = "workbench";

   constructor(position: Point) {
      super(position, new Set<Hitbox<HitboxType>>([
         new RectangularHitbox({
            type: "rectangular",
            width: 50,
            height: 50
         })
      ]), {});
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;