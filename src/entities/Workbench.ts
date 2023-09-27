import { Point } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";

class Workbench extends Entity {
   public static readonly SIZE = 80;
   
   public mass = 1.6;
   
   constructor(position: Point) {
      super(position, {}, "workbench");

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(Workbench.SIZE, Workbench.SIZE);
      this.addHitbox(hitbox);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;