import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, Point } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";

class Workbench extends Entity {
   public static readonly SIZE = 80;
   
   public mass = 1.6;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;
   
   constructor(position: Point) {
      super(position, {}, EntityTypeConst.workbench);

      const hitbox = new RectangularHitbox(Workbench.SIZE, Workbench.SIZE, 0, 0);
      this.addHitbox(hitbox);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Workbench;