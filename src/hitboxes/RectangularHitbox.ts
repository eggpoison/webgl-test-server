import { circleAndRectangleDoIntersectWithOffset, HitboxVertexPositions, Point, rectanglePointsDoIntersectWithOffset, rotateXAroundOrigin, rotateYAroundOrigin } from "webgl-test-shared";
import Hitbox, { HitboxObject } from "./Hitbox";
import CircularHitbox from "./CircularHitbox";

class RectangularHitbox extends Hitbox {
   public width: number;
   public height: number;
   
   /** Length of half of the diagonal of the rectangle */
   public halfDiagonalLength!: number;

   /** The rotation of the hitbox relative to its game object */
   public rotation = 0;

   public vertexOffsets: HitboxVertexPositions = [new Point(0, 0), new Point(0, 0), new Point(0, 0), new Point(0, 0)];
   public sideAxes = [new Point(0, 0), new Point(0, 0)] as const;

   constructor(object: HitboxObject, mass: number, offsetX: number, offsetY: number, width: number, height: number, localID: number) {
      super(object, mass, offsetX, offsetY, localID);

      this.width = width;
      this.height = height;
      this.updateHalfDiagonalLength();
      this.updateVertexPositions();
   }

   public updateHalfDiagonalLength(): void {
      this.halfDiagonalLength = Math.sqrt(Math.pow(this.width / 2, 2) + Math.pow(this.height / 2, 2));
   }

   public updateVertexPositions(): void {
      const x1 = -this.width / 2;
      const x2 = this.width / 2;
      const y1 = -this.height / 2;
      const y2 = this.height / 2;

      // Rotate vertices

      // Top left vertex
      this.vertexOffsets[0].x = rotateXAroundOrigin(x1, y2, this.rotation + this.object.rotation);
      this.vertexOffsets[0].y = rotateYAroundOrigin(x1, y2, this.rotation + this.object.rotation);
      // Top right vertex
      this.vertexOffsets[1].x = rotateXAroundOrigin(x2, y2, this.rotation + this.object.rotation);
      this.vertexOffsets[1].y = rotateYAroundOrigin(x2, y2, this.rotation + this.object.rotation);
      // Bottom left vertex
      this.vertexOffsets[2].x = rotateXAroundOrigin(x1, y1, this.rotation + this.object.rotation);
      this.vertexOffsets[2].y = rotateYAroundOrigin(x1, y1, this.rotation + this.object.rotation);
      // Bottom right vertex
      this.vertexOffsets[3].x = rotateXAroundOrigin(x2, y1, this.rotation + this.object.rotation);
      this.vertexOffsets[3].y = rotateYAroundOrigin(x2, y1, this.rotation + this.object.rotation);

      this.calculateSideAxes();
   }

   private calculateSideAxes(): void {
      // Angle between vertex 0 (top left) and vertex 1 (top right)
      const angle1 = this.vertexOffsets[0].calculateAngleBetween(this.vertexOffsets[1]);
      this.sideAxes[0].x = Math.sin(angle1);
      this.sideAxes[0].y = Math.cos(angle1);
      
      // Angle between vertex 2 (bottom left) and vertex 3 (bottom right)
      const angle2 = this.vertexOffsets[2].calculateAngleBetween(this.vertexOffsets[3]);
      this.sideAxes[1].x = Math.sin(angle2);
      this.sideAxes[1].y = Math.cos(angle2);
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
         return circleAndRectangleDoIntersectWithOffset(otherHitbox.object.position, otherHitbox.offset, (otherHitbox as CircularHitbox).radius, this.object.position, this.offset, this.width, this.height, this.rotation + this.object.rotation);
      } else {
         // Rectangular hitbox
         // If the distance between the entities is greater than the sum of their half diagonals then they're not colliding
         const distanceSquared = Math.pow(this.object.position.x + this.offset.x - otherHitbox.object.position.x - otherHitbox.offset.x, 2) + Math.pow(this.object.position.y + this.offset.y - otherHitbox.object.position.y - otherHitbox.offset.y, 2);
         if (distanceSquared > Math.pow(this.halfDiagonalLength + (otherHitbox as RectangularHitbox).halfDiagonalLength, 2)) {
            return false;
         }
         
         return rectanglePointsDoIntersectWithOffset(this.vertexOffsets, (otherHitbox as RectangularHitbox).vertexOffsets, this.object.position, otherHitbox.object.position, this.sideAxes, (otherHitbox as RectangularHitbox).sideAxes);
      }
   }
}

export default RectangularHitbox;