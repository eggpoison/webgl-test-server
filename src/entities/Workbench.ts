import { Point } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";

class Workbench extends Entity {
   public mass = 1.6;
   
   constructor(position: Point) {
      super(position, {}, "workbench", false);


      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(80, 80);
      this.addHitbox(hitbox);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;