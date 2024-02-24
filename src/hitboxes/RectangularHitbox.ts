import { circleAndRectangleDoIntersect, HitboxVertexPositions, Point, rectanglePointsDoIntersect, rotateXAroundOrigin, rotateYAroundOrigin } from "webgl-test-shared";
import Hitbox, { HitboxObject } from "./Hitbox";
import CircularHitbox from "./CircularHitbox";

class RectangularHitbox extends Hitbox {
   public width: number;
   public height: number;
   
   /** Length of half of the diagonal of the rectangle */
   public halfDiagonalLength!: number;

   /** The rotation of the hitbox relative to its game object */
   public rotation = 0;

   // @Memory: Only need to calculate the top left and top right ones
   public vertexOffsets: HitboxVertexPositions = [new Point(0, 0), new Point(0, 0), new Point(0, 0), new Point(0, 0)];

   public axisX = 0;
   public axisY = 0;

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, width: number, height: number, localID: number) {
      super(object, mass, offsetX, offsetY, localID);

      this.width = width;
      this.height = height;
      this.updateHalfDiagonalLength();
      this.updateVertexPositionsAndSideAxes();
   }

   public updateHalfDiagonalLength(): void {
      this.halfDiagonalLength = Math.sqrt(this.width * this.width / 4 + this.height * this.height / 4);
   }

   public updateVertexPositionsAndSideAxes(): void {
      const x1 = -this.width * 0.5;
      const x2 = this.width * 0.5;
      const y2 = this.height * 0.5;

      const rotation = this.rotation + this.object.rotation;
      const sinRotation = Math.sin(rotation);
      const cosRotation = Math.cos(rotation);

      // Rotate vertices

      // Top left vertex
      this.vertexOffsets[0].x = cosRotation * x1 + sinRotation * y2;
      this.vertexOffsets[0].y = cosRotation * y2 - sinRotation * x1;
      // Top right vertex
      this.vertexOffsets[1].x = cosRotation * x2 + sinRotation * y2;
      this.vertexOffsets[1].y = cosRotation * y2 - sinRotation * x2;
      // Bottom right vertex
      this.vertexOffsets[2].x = -this.vertexOffsets[0].x;
      this.vertexOffsets[2].y = -this.vertexOffsets[0].y;
      // Bottom left vertex
      this.vertexOffsets[3].x = -this.vertexOffsets[1].x;
      this.vertexOffsets[3].y = -this.vertexOffsets[1].y;

      // Angle between vertex 0 (top left) and vertex 1 (top right)
      // @Speed: If we do a different axis, can we get rid of the minus?
      this.axisX = cosRotation;
      this.axisY = -sinRotation;
   }

   public calculateHitboxBoundsMinX(): number {
      return this.object.position.x + Math.min(this.vertexOffsets[0].x, this.vertexOffsets[1].x, this.vertexOffsets[2].x, this.vertexOffsets[3].x);
   }
   public calculateHitboxBoundsMaxX(): number {
      return this.object.position.x + Math.max(this.vertexOffsets[0].x, this.vertexOffsets[1].x, this.vertexOffsets[2].x, this.vertexOffsets[3].x);
   }
   public calculateHitboxBoundsMinY(): number {
      return this.object.position.y + Math.min(this.vertexOffsets[0].y, this.vertexOffsets[1].y, this.vertexOffsets[2].y, this.vertexOffsets[3].y);
   }
   public calculateHitboxBoundsMaxY(): number {
      return this.object.position.y + Math.max(this.vertexOffsets[0].y, this.vertexOffsets[1].y, this.vertexOffsets[2].y, this.vertexOffsets[3].y);
   }

   public isColliding(otherHitbox: RectangularHitbox | CircularHitbox): boolean {
      // @Speed: This check is slow
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circleAndRectangleDoIntersect(otherHitbox.object.position.x + otherHitbox.rotatedOffsetX, otherHitbox.object.position.y + otherHitbox.rotatedOffsetY, (otherHitbox as CircularHitbox).radius, this.object.position.x + this.rotatedOffsetX, this.object.position.y + this.rotatedOffsetY, this.width, this.height, this.rotation + this.object.rotation);
      } else {
         // Rectangular hitbox
         // If the distance between the entities is greater than the sum of their half diagonals then they're not colliding
         const distanceSquared = Math.pow(this.object.position.x + this.rotatedOffsetX - otherHitbox.object.position.x - otherHitbox.rotatedOffsetX, 2) + Math.pow(this.object.position.y + this.rotatedOffsetY - otherHitbox.object.position.y - otherHitbox.rotatedOffsetY, 2);
         if (distanceSquared > Math.pow(this.halfDiagonalLength + (otherHitbox as RectangularHitbox).halfDiagonalLength, 2)) {
            return false;
         }
         
         return rectanglePointsDoIntersect(this.vertexOffsets, (otherHitbox as RectangularHitbox).vertexOffsets, this.object.position.x + this.rotatedOffsetX, this.object.position.y + this.rotatedOffsetY, otherHitbox.object.position.x + otherHitbox.rotatedOffsetX, otherHitbox.object.position.y + otherHitbox.rotatedOffsetY, this.axisX, this.axisY, (otherHitbox as RectangularHitbox).axisX, (otherHitbox as RectangularHitbox).axisY);
      }
   }
}

export default RectangularHitbox;