import { Point, rotateXAroundOrigin, rotateYAroundOrigin } from "webgl-test-shared";
import RectangularHitbox from "./RectangularHitbox";
import CircularHitbox from "./CircularHitbox";

export type HitboxObject = { position: Point, rotation: number };

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

abstract class Hitbox {
   public object: HitboxObject;
   public readonly mass: number;
   public offsetX: number;
   public offsetY: number;
   public localID: number;

   public rotatedOffsetX!: number;
   public rotatedOffsetY!: number;

   // @Memory: Would be great to remove this
   public chunkBounds: HitboxBounds = [-1, -1, -1, -1];

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, localID: number) {
      // @Cleanup: Perhaps localID can be inferred from the length of the object's hitboxes
      
      this.object = object;
      this.mass = mass;
      this.offsetX = offsetX;
      this.offsetY = offsetY;
      this.localID = localID;

      this.updateOffset();
   }

   public updateOffset(): void {
      const cosRotation = Math.cos(this.object.rotation);
      const sinRotation = Math.sin(this.object.rotation);
      
      this.rotatedOffsetX = cosRotation * this.offsetX + sinRotation * this.offsetY;
      this.rotatedOffsetY = cosRotation * this.offsetY - sinRotation * this.offsetX;
   }

   public abstract calculateHitboxBoundsMinX(): number;
   public abstract calculateHitboxBoundsMaxX(): number;
   public abstract calculateHitboxBoundsMinY(): number;
   public abstract calculateHitboxBoundsMaxY(): number;

   public abstract isColliding(otherHitbox: RectangularHitbox | CircularHitbox, externalRotation: number): boolean;
}

export default Hitbox;