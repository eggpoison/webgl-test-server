import { HitboxCollisionTypeConst, circleAndRectangleDoIntersect, circlesDoIntersect } from "webgl-test-shared";
import Hitbox, { HitboxObject } from "./Hitbox";
import RectangularHitbox from "./RectangularHitbox";

class CircularHitbox extends Hitbox {
   public radius: number;

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, collisionType: HitboxCollisionTypeConst, radius: number) {
      super(object, mass, offsetX, offsetY, collisionType);

      this.radius = radius;
   }

   public calculateHitboxBoundsMinX(): number {
      return this.object.position.x + this.rotatedOffsetX - this.radius;
   }
   public calculateHitboxBoundsMaxX(): number {
      return this.object.position.x + this.rotatedOffsetX + this.radius;
   }
   public calculateHitboxBoundsMinY(): number {
      return this.object.position.y + this.rotatedOffsetY - this.radius;
   }
   public calculateHitboxBoundsMaxY(): number {
      return this.object.position.y + this.rotatedOffsetY + this.radius;
   }

   public isColliding(otherHitbox: Hitbox): boolean {
      // @Speed: This check is slow
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circlesDoIntersect(this.object.position.x + this.rotatedOffsetX, this.object.position.y + this.rotatedOffsetY, this.radius, otherHitbox.object.position.x + otherHitbox.rotatedOffsetX, otherHitbox.object.position.y + otherHitbox.rotatedOffsetY, (otherHitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersect(this.object.position.x + this.rotatedOffsetX, this.object.position.y + this.rotatedOffsetY, this.radius, otherHitbox.object.position.x + otherHitbox.rotatedOffsetX, otherHitbox.object.position.y + otherHitbox.rotatedOffsetY, (otherHitbox as RectangularHitbox).width, (otherHitbox as RectangularHitbox).height, (otherHitbox as RectangularHitbox).rotation + otherHitbox.object.rotation);
      }
   }
}

export default CircularHitbox;