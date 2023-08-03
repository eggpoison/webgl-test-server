import { Point } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";

class Workbench extends Entity {
   constructor(position: Point) {
      super(position, {}, "workbench", false);

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: 80,
            height: 80
         })
      ]);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;