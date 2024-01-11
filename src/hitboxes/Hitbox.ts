import { Point } from "webgl-test-shared";
import RectangularHitbox from "./RectangularHitbox";
import CircularHitbox from "./CircularHitbox";

export type HitboxObject = { position: Point, rotation: number };

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

abstract class Hitbox {
   public object: HitboxObject;
   public readonly mass: number;
   public offset: Point;
   public localID: number;

   public chunkBounds: HitboxBounds = [-1, -1, -1, -1];

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, localID: number) {
      this.object = object;
      this.mass = mass;
      this.offset = new Point(offsetX, offsetY);
      this.localID = localID;
   }

   public abstract calculateHitboxBoundsMinX(): number;
   public abstract calculateHitboxBoundsMaxX(): number;
   public abstract calculateHitboxBoundsMinY(): number;
   public abstract calculateHitboxBoundsMaxY(): number;

   public abstract isColliding(otherHitbox: RectangularHitbox | CircularHitbox): boolean;
}

export default Hitbox;