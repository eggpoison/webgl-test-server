import { circleAndRectangleDoIntersectWithOffset, circulesDoIntersectWithOffset } from "webgl-test-shared";
import Hitbox, { HitboxObject } from "./Hitbox";
import RectangularHitbox from "./RectangularHitbox";

class CircularHitbox extends Hitbox {
   public radius: number;

   constructor(object: HitboxObject, offsetX: number, offsetY: number, radius: number) {
      super(object, offsetX, offsetY);

      this.radius = radius;
   }

   public calculateHitboxBoundsMinX(): number {
      return this.object.position.x - this.radius;
   }
   public calculateHitboxBoundsMaxX(): number {
      return this.object.position.x + this.radius;
   }
   public calculateHitboxBoundsMinY(): number {
      return this.object.position.y - this.radius;
   }
   public calculateHitboxBoundsMaxY(): number {
      return this.object.position.y + this.radius;
   }

   public isColliding(otherHitbox: Hitbox): boolean {
      // @Speed: This check is slow
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circulesDoIntersectWithOffset(this.object.position, this.offset, this.radius, otherHitbox.object.position, otherHitbox.offset, (otherHitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersectWithOffset(this.object.position, this.offset, this.radius, otherHitbox.object.position, otherHitbox.offset, (otherHitbox as RectangularHitbox).width, (otherHitbox as RectangularHitbox).height, (otherHitbox as RectangularHitbox).rotation + otherHitbox.object.rotation);
      }
   }
}

export default CircularHitbox;