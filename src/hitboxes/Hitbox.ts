import { Point } from "webgl-test-shared";
import RectangularHitbox from "./RectangularHitbox";
import CircularHitbox from "./CircularHitbox";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

export type HitboxObject = { position: Point, rotation: number };

abstract class Hitbox {
   public hitboxObject!: HitboxObject;

   /** The bounds of the hitbox since the last physics update */
   public bounds!: HitboxBounds;

   /** The position of the hitbox, accounting for offset from its entity */
   public position!: Point;

   public offset?: Point;

   public setHitboxObject(hitboxObject: HitboxObject): void {
      this.hitboxObject = hitboxObject;
   }

   protected abstract calculateHitboxBounds(): HitboxBounds;

   public updateHitboxBounds(): void {
      this.bounds = this.calculateHitboxBounds();
   }

   /** Updates the hitboxes position to match the position of its hitbox object */
   public updatePosition(): void {
      this.position = this.hitboxObject.position.copy();
      if (typeof this.offset !== "undefined") {
         this.position.add(this.offset);
      }
      if (isNaN(this.position.x)) {
         throw new Error("Invalid position.");
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