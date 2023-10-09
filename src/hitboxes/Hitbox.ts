import { Point, rotateXAroundPoint, rotateYAroundPoint } from "webgl-test-shared";
import RectangularHitbox from "./RectangularHitbox";
import CircularHitbox from "./CircularHitbox";
import { GameObject } from "../GameObject";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

abstract class Hitbox {
   /** The position of the hitbox, accounting for offset from its entity */
   public position = new Point(0, 0);

   public offset?: Point;

   /** The bounds of the hitbox since the last physics update */
   public bounds: HitboxBounds = [-1, -1, -1, -1];

   public abstract updateHitboxBounds(offsetRotation: number): void;

   /** Updates the hitboxes position to match the position of its hitbox object */
   public updatePositionFromGameObject(gameObject: GameObject): void {
      this.position.x = gameObject.position.x;
      this.position.y = gameObject.position.y;

      if (typeof this.offset !== "undefined") {
         this.position.x += rotateXAroundPoint(this.offset.x, this.offset.y, 0, 0, gameObject.rotation);
         this.position.y += rotateYAroundPoint(this.offset.x, this.offset.y, 0, 0, gameObject.rotation);
      }
   }

   public setPosition(position: Point): void {
      this.position = position;
      if (isNaN(this.position.x)) {
         throw new Error("Invalid position.");
      }
   }

   public abstract isColliding(otherHitbox: RectangularHitbox | CircularHitbox): boolean;

   public abstract resolveTileCollision(tileX: number, tileY: number): void;
}

export default Hitbox;