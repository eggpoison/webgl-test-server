import { circleAndRectangleDoIntersect, computeSideAxis, HitboxVertexPositions, Point, rectanglePointsDoIntersect, rotatePoint, Vector } from "webgl-test-shared";
import Hitbox, { HitboxBounds } from "./Hitbox";
import CircularHitbox from "./CircularHitbox";

class RectangularHitbox extends Hitbox {
   /** Length of half of the diagonal of the rectangle */
   public halfDiagonalLength!: number;

   public vertexPositions!: HitboxVertexPositions;
   public sideAxes!: [axis1: Vector, axis2: Vector];

   public width!: number;
   public height!: number;

   public setHitboxInfo(width: number, height: number, offset?: Point): void {
      this.width = width;
      this.height = height;
      this.offset = offset;

      this.halfDiagonalLength = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
   }

   private computeVertexPositions(): void {
      const x1 = this.hitboxObject.position.x - this.width / 2;
      const x2 = this.hitboxObject.position.x + this.width / 2;
      const y1 = this.hitboxObject.position.y - this.height / 2;
      const y2 = this.hitboxObject.position.y + this.height / 2;

      let topLeft = new Point(x1, y2);
      let topRight = new Point(x2, y2);
      let bottomLeft = new Point(x1, y1);
      let bottomRight = new Point(x2, y1);

      // Rotate the points to match the object's rotation
      topLeft = rotatePoint(topLeft, this.hitboxObject.position, this.hitboxObject.rotation);
      topRight = rotatePoint(topRight, this.hitboxObject.position, this.hitboxObject.rotation);
      bottomLeft = rotatePoint(bottomLeft, this.hitboxObject.position, this.hitboxObject.rotation);
      bottomRight = rotatePoint(bottomRight, this.hitboxObject.position, this.hitboxObject.rotation);

      if (typeof this.offset !== "undefined") {
         topLeft.add(this.offset);
         topRight.add(this.offset);
         bottomLeft.add(this.offset);
         bottomRight.add(this.offset);
      }

      this.vertexPositions = [topLeft, topRight, bottomLeft, bottomRight];
   }

   private calculateSideAxes(): void {
      this.sideAxes = [
         computeSideAxis(this.vertexPositions[0], this.vertexPositions[1]),
         computeSideAxis(this.vertexPositions[0], this.vertexPositions[2])
      ];
   }

   protected calculateHitboxBounds(): HitboxBounds {
      this.computeVertexPositions();
      this.calculateSideAxes();

      const minX = Math.min(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      const maxX = Math.max(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      const minY = Math.min(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      const maxY = Math.max(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      return [minX, maxX, minY, maxY];
   }

   public isColliding(otherHitbox: RectangularHitbox | CircularHitbox): boolean {
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circleAndRectangleDoIntersect(otherHitbox.position, (otherHitbox as CircularHitbox).radius, this.position, this.width, this.height, this.hitboxObject.rotation);
      } else {
         // Rectangular hitbox
            // If the distance between the entities is greater than the sum of their half diagonals then they're not colliding
            const distance = this.position.calculateDistanceBetween(otherHitbox.position);
            if (distance > this.halfDiagonalLength + (otherHitbox as RectangularHitbox).halfDiagonalLength) {
               return false;
            }
            
            return rectanglePointsDoIntersect(this.vertexPositions, (otherHitbox as RectangularHitbox).vertexPositions, this.sideAxes, (otherHitbox as RectangularHitbox).sideAxes);
      }
   }
   
   public resolveTileCollision(tileX: number, tileY: number): void {
      throw new Error("Method not implemented.");
   }
}

export default RectangularHitbox;