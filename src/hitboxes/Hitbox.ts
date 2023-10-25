import { Point, rotateXAroundPoint, rotateYAroundPoint } from "webgl-test-shared";
import RectangularHitbox from "./RectangularHitbox";
import CircularHitbox from "./CircularHitbox";
import GameObject from "src/GameObject";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

abstract class Hitbox {
   /** The position of the hitbox, accounting for its offset and offset rotation */
   public position = new Point(0, 0);

   public offset?: Point;

   /** Bounds of the hitbox at the beginning of the current tick */
   public previousBounds: HitboxBounds = [-1, -1, -1, -1];

   /** Up-to-date bounds of the hitbox */
   public bounds: HitboxBounds = [-1, -1, -1, -1];

   public abstract updateHitboxBounds(offsetRotation: number): void;

   /** Updates the hitboxes position to match the position of its hitbox object */
   public updateFromGameObject(gameObject: GameObject): void {
      this.position.x = gameObject.position.x;
      this.position.y = gameObject.position.y;

      if (typeof this.offset !== "undefined") {
         this.position.x += rotateXAroundPoint(this.offset.x, this.offset.y, 0, 0, gameObject.rotation);
         this.position.y += rotateYAroundPoint(this.offset.x, this.offset.y, 0, 0, gameObject.rotation);
      }
   }

   public abstract isColliding(otherHitbox: RectangularHitbox | CircularHitbox): boolean;
}

export default Hitbox;