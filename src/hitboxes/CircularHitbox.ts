import { HitboxCollisionTypeConst, circleAndRectangleDoIntersect, circlesDoIntersect } from "webgl-test-shared";
import Hitbox from "./Hitbox";
import RectangularHitbox from "./RectangularHitbox";

class CircularHitbox extends Hitbox {
   public radius: number;

   constructor(parentX: number, parentY: number, mass: number, offsetX: number, offsetY: number, collisionType: HitboxCollisionTypeConst, radius: number, localID: number, initialParentRotation: number) {
      super(parentX, parentY, mass, offsetX, offsetY, collisionType, localID, initialParentRotation);

      this.radius = radius;
   }

   public calculateHitboxBoundsMinX(): number {
      return this.x - this.radius;
   }
   public calculateHitboxBoundsMaxX(): number {
      return this.x + this.radius;
   }
   public calculateHitboxBoundsMinY(): number {
      return this.y - this.radius;
   }
   public calculateHitboxBoundsMaxY(): number {
      return this.y + this.radius;
   }

   public isColliding(otherHitbox: Hitbox): boolean {
      // @Speed: This check is slow
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circlesDoIntersect(this.x, this.y, this.radius, otherHitbox.x, otherHitbox.y, (otherHitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersect(this.x, this.y, this.radius, otherHitbox.x, otherHitbox.y, (otherHitbox as RectangularHitbox).width, (otherHitbox as RectangularHitbox).height, (otherHitbox as RectangularHitbox).rotation);
      }
   }
}

export default CircularHitbox;