import { circleAndRectangleDoIntersect, HitboxCollisionTypeConst, HitboxVertexPositions, Point, rectanglePointsDoIntersect } from "webgl-test-shared";
import Hitbox, { HitboxObject } from "./Hitbox";
import CircularHitbox from "./CircularHitbox";

class RectangularHitbox extends Hitbox {
   public width: number;
   public height: number;
   
   /** The rotation of the hitbox relative to its game object */
   public rotation = 0;

   // @Memory: Only need to calculate the top left and top right ones
   public vertexOffsets: HitboxVertexPositions = [new Point(0, 0), new Point(0, 0), new Point(0, 0), new Point(0, 0)];

   public axisX = 0;
   public axisY = 0;

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, collisionType: HitboxCollisionTypeConst, width: number, height: number) {
      super(object, mass, offsetX, offsetY, collisionType);

      this.width = width;
      this.height = height;
      this.updateVertexPositionsAndSideAxes();
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

         const diffX = this.object.position.x + this.rotatedOffsetX - otherHitbox.object.position.x - otherHitbox.rotatedOffsetX;
         const diffY = this.object.position.y + this.rotatedOffsetY - otherHitbox.object.position.y - otherHitbox.rotatedOffsetY;
         
         const width1Squared = this.width * this.width;
         const height1Squared = this.height * this.height;
         const width2Squared = (otherHitbox as RectangularHitbox).width * (otherHitbox as RectangularHitbox).width;
         const height2Squared = (otherHitbox as RectangularHitbox).height * (otherHitbox as RectangularHitbox).height;

         // If the distance between the entities is greater than the sum of their half diagonals then they can never collide
         if (diffX * diffX + diffY * diffY > (width1Squared + height1Squared + width2Squared + height2Squared + 2 * Math.sqrt((width1Squared + height1Squared) * (width2Squared + height2Squared))) * 0.25) {
            return false;
         }
         
         return rectanglePointsDoIntersect(this.vertexOffsets, (otherHitbox as RectangularHitbox).vertexOffsets, this.object.position.x + this.rotatedOffsetX, this.object.position.y + this.rotatedOffsetY, otherHitbox.object.position.x + otherHitbox.rotatedOffsetX, otherHitbox.object.position.y + otherHitbox.rotatedOffsetY, this.axisX, this.axisY, (otherHitbox as RectangularHitbox).axisX, (otherHitbox as RectangularHitbox).axisY);
      }
   }
}

export default RectangularHitbox;