import { circleAndRectangleDoIntersectWithOffset, circlesDoIntersectWithOffset, rotateXAroundOrigin, rotateYAroundOrigin } from "webgl-test-shared";
import Hitbox, { HitboxObject } from "./Hitbox";
import RectangularHitbox from "./RectangularHitbox";

class CircularHitbox extends Hitbox {
   public radius: number;

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, radius: number, localID: number) {
      super(object, mass, offsetX, offsetY, localID);

      this.radius = radius;
   }

   public calculateHitboxBoundsMinX(): number {
      const offsetX = rotateXAroundOrigin(this.offset.x, this.offset.y, this.object.rotation);
      return this.object.position.x + offsetX - this.radius;
   }
   public calculateHitboxBoundsMaxX(): number {
      const offsetX = rotateXAroundOrigin(this.offset.x, this.offset.y, this.object.rotation);
      return this.object.position.x + offsetX + this.radius;
   }
   public calculateHitboxBoundsMinY(): number {
      const offsetY = rotateYAroundOrigin(this.offset.x, this.offset.y, this.object.rotation);
      return this.object.position.y + offsetY - this.radius;
   }
   public calculateHitboxBoundsMaxY(): number {
      const offsetY = rotateYAroundOrigin(this.offset.x, this.offset.y, this.object.rotation);
      return this.object.position.y + offsetY + this.radius;
   }

   public isColliding(otherHitbox: Hitbox, externalRotation: number): boolean {
      // @Speed: This check is slow
      if (otherHitbox.hasOwnProperty("radius")) {
         // @Speed
         // @Speed
         // @Speed
         // @Cleanup AWFULLLLL
         const thisOffsetX = rotateXAroundOrigin(this.offset.x, this.offset.y, this.object.rotation);
         const thisOffsetY = rotateYAroundOrigin(this.offset.x, this.offset.y, this.object.rotation);
         const thisPosX = this.object.position.x + thisOffsetX;
         const thisPosY = this.object.position.y + thisOffsetY;
         const otherOffsetX = rotateXAroundOrigin(otherHitbox.offset.x, otherHitbox.offset.y, externalRotation);
         const otherOffsetY = rotateYAroundOrigin(otherHitbox.offset.x, otherHitbox.offset.y, externalRotation);
         const otherPosX = otherHitbox.object.position.x + otherOffsetX;
         const otherPosY = otherHitbox.object.position.y + otherOffsetY;
         
         // Circular hitbox
         return circlesDoIntersectWithOffset(thisPosX, thisPosY, this.radius, otherPosX, otherPosY, (otherHitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersectWithOffset(this.object.position, this.offset, this.radius, otherHitbox.object.position, otherHitbox.offset, (otherHitbox as RectangularHitbox).width, (otherHitbox as RectangularHitbox).height, (otherHitbox as RectangularHitbox).rotation + otherHitbox.object.rotation);
      }
   }
}

export default CircularHitbox;