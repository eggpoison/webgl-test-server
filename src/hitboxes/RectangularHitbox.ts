import { circleAndRectangleDoIntersect, computeSideAxis, HitboxType, HitboxVertexPositions, Point, rectanglePointsDoIntersect, rectanglesDoIntersect, RectangularHitboxInfo, rotatePoint, Vector } from "webgl-test-shared";
import Hitbox, { HitboxBounds } from "./Hitbox";

class RectangularHitbox extends Hitbox<"rectangular"> {
   /** Length of half of the diagonal of the rectangle */
   public halfDiagonalLength!: number;

   public vertexPositions!: HitboxVertexPositions;
   public sideAxes!: [axis1: Vector, axis2: Vector];

   public setHitboxInfo(hitboxInfo: RectangularHitboxInfo): void {
      super.setHitboxInfo(hitboxInfo);

      this.halfDiagonalLength = Math.sqrt(Math.pow(hitboxInfo.width / 2, 2) + Math.pow(hitboxInfo.height / 2, 2));
   }

   public computeVertexPositions(): void {
      const x1 = this.hitboxObject.position.x - this.info.width / 2;
      const x2 = this.hitboxObject.position.x + this.info.width / 2;
      const y1 = this.hitboxObject.position.y - this.info.height / 2;
      const y2 = this.hitboxObject.position.y + this.info.height / 2;

      let topLeft = new Point(x1, y2);
      let topRight = new Point(x2, y2);
      let bottomLeft = new Point(x1, y1);
      let bottomRight = new Point(x2, y1);

      // Rotate the points to match the object's rotation
      topLeft = rotatePoint(topLeft, this.hitboxObject.position, this.hitboxObject.rotation);
      topRight = rotatePoint(topRight, this.hitboxObject.position, this.hitboxObject.rotation);
      bottomLeft = rotatePoint(bottomLeft, this.hitboxObject.position, this.hitboxObject.rotation);
      bottomRight = rotatePoint(bottomRight, this.hitboxObject.position, this.hitboxObject.rotation);

      if (typeof this.info.offset !== "undefined") {
         topLeft.add(this.info.offset);
         topRight.add(this.info.offset);
         bottomLeft.add(this.info.offset);
         bottomRight.add(this.info.offset);
      }

      this.vertexPositions = [topLeft, topRight, bottomLeft, bottomRight];
   }

   public calculateSideAxes(): void {
      this.sideAxes = [
         computeSideAxis(this.vertexPositions[0], this.vertexPositions[1]),
         computeSideAxis(this.vertexPositions[0], this.vertexPositions[2])
      ];
   }

   protected calculateHitboxBounds(): HitboxBounds {
      const minX = Math.min(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      const maxX = Math.max(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      const minY = Math.min(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      const maxY = Math.max(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      return [minX, maxX, minY, maxY];
   }

   public isColliding(otherHitbox: Hitbox<HitboxType>): boolean {
      switch (otherHitbox.info.type) {
         case "circular": {
            return circleAndRectangleDoIntersect(otherHitbox.position, otherHitbox.info.radius, this.position, this.info.width, this.info.height, this.hitboxObject.rotation);
         }
         case "rectangular": {
            // If the distance between the entities is greater than the sum of their half diagonals then they're not colliding
            const distance = this.position.calculateDistanceBetween(otherHitbox.position);
            if (distance > this.halfDiagonalLength + (otherHitbox as RectangularHitbox).halfDiagonalLength) {
               return false;
            }
            
            return rectanglePointsDoIntersect(this.vertexPositions, (otherHitbox as RectangularHitbox).vertexPositions, this.sideAxes, (otherHitbox as RectangularHitbox).sideAxes);
         }
      }
   }
   
   public resolveTileCollision(tileX: number, tileY: number): void {
      throw new Error("Method not implemented.");
   }
}

export default RectangularHitbox;