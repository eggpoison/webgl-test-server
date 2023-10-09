import { circleAndRectangleDoIntersect, circlesDoIntersect, rotateXAroundPoint, rotateYAroundPoint } from "webgl-test-shared";
import Hitbox from "./Hitbox";
import RectangularHitbox from "./RectangularHitbox";

class CircularHitbox extends Hitbox {
   public radius!: number;
   
   public updateHitboxBounds(offsetRotation: number): void {
      this.bounds[0] = this.position.x - this.radius;
      this.bounds[1] = this.position.x + this.radius;
      this.bounds[2] = this.position.y - this.radius;
      this.bounds[3] = this.position.y + this.radius;

      if (typeof this.offset !== "undefined") {
         const rotatedXOffset = rotateXAroundPoint(this.offset.x, this.offset.y, 0, 0, offsetRotation);
         const rotatedYOffset = rotateYAroundPoint(this.offset.x, this.offset.y, 0, 0, offsetRotation);

         this.bounds[0] += rotatedXOffset;
         this.bounds[1] += rotatedXOffset;
         this.bounds[2] += rotatedYOffset;
         this.bounds[3] += rotatedYOffset;
      }
   }

   public isColliding(otherHitbox: Hitbox): boolean {
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circlesDoIntersect(this.position, this.radius, otherHitbox.position, (otherHitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersect(this.position, this.radius, otherHitbox.position, (otherHitbox as RectangularHitbox).width, (otherHitbox as RectangularHitbox).height, (otherHitbox as RectangularHitbox).rotation);
      }
   }
   
   public resolveTileCollision(tileX: number, tileY: number): void {
      throw new Error("Method not implemented.");
   }
}

export default CircularHitbox;