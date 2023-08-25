import { Point, circleAndRectangleDoIntersect, circlesDoIntersect } from "webgl-test-shared";
import Hitbox, { HitboxBounds } from "./Hitbox";
import RectangularHitbox from "./RectangularHitbox";

class CircularHitbox extends Hitbox {
   public radius!: number;

   public setHitboxInfo(radius: number, offset?: Point): void {
      this.radius = radius;
      this.offset = offset;
   }
   
   protected calculateHitboxBounds(): HitboxBounds {
      const minX = this.position.x - this.radius;
      const maxX = this.position.x + this.radius;
      const minY = this.position.y - this.radius;
      const maxY = this.position.y + this.radius;
      return [minX, maxX, minY, maxY];
   }

   public isColliding(otherHitbox: Hitbox): boolean {
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circlesDoIntersect(this.position, this.radius, otherHitbox.position, (otherHitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         return circleAndRectangleDoIntersect(this.position, this.radius, otherHitbox.position, (otherHitbox as RectangularHitbox).width, (otherHitbox as RectangularHitbox).height, otherHitbox.hitboxObject.rotation);
      }
   }
   
   public resolveTileCollision(tileX: number, tileY: number): void {
      throw new Error("Method not implemented.");
   }
}

export default CircularHitbox;