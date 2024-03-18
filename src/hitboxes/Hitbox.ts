import { HitboxCollisionTypeConst, Point } from "webgl-test-shared";
import RectangularHitbox from "./RectangularHitbox";
import CircularHitbox from "./CircularHitbox";
import Entity from "../Entity";

export type HitboxObject = { position: Point, rotation: number };

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

abstract class Hitbox {
   /** Unique identifier in its entities' hitboxes */
   public readonly localID: number;
   
   public object: HitboxObject;
   public readonly mass: number;
   public offsetX: number;
   public offsetY: number;

   // @Cleanup: The whole thing with adding rotated offset to object position is very inconvenient, would be much better to do the client thing of having a position property
   public rotatedOffsetX!: number;
   public rotatedOffsetY!: number;

   // @Memory: Would be great to remove this
   public chunkBounds: HitboxBounds = [-1, -1, -1, -1];

   public collisionType: HitboxCollisionTypeConst;

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, collisionType: HitboxCollisionTypeConst) {
      this.object = object;
      this.mass = mass;
      this.offsetX = offsetX;
      this.offsetY = offsetY;
      this.collisionType = collisionType;

      this.localID = (object as Entity).nextHitboxLocalID;
      (object as Entity).nextHitboxLocalID++;

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