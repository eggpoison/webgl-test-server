import { circleAndRectangleDoIntersect, HitboxType, HitboxVertexPositions, Point, rectanglesDoIntersect, RectangularHitboxInfo, rotatePoint } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Hitbox, { HitboxBounds } from "./Hitbox";

class RectangularHitbox extends Hitbox<"rectangular"> {
   /** Length of half of the diagonal of the rectangle */
   public readonly halfDiagonalLength: number;

   public vertexPositions: HitboxVertexPositions;

   constructor(hitboxInfo: RectangularHitboxInfo, entity: Entity) {
      super(hitboxInfo, entity);

      this.halfDiagonalLength = Math.sqrt(Math.pow(this.info.width / 2, 2) + Math.pow(this.info.height / 2, 2));
   }

   public calculateVertexPositions(): HitboxVertexPositions {
      const x1 = this.entity.position.x - this.info.width / 2;
      const x2 = this.entity.position.x + this.info.width / 2;
      const y1 = this.entity.position.y - this.info.height / 2;
      const y2 = this.entity.position.y + this.info.height / 2;

      let topLeft = new Point(x1, y2);
      let topRight = new Point(x2, y2);
      let bottomLeft = new Point(x1, y1);
      let bottomRight = new Point(x2, y1);

      // Rotate the points to match the entity's rotation
      topLeft = rotatePoint(topLeft, this.entity.position, this.entity.rotation);
      topRight = rotatePoint(topRight, this.entity.position, this.entity.rotation);
      bottomLeft = rotatePoint(bottomLeft, this.entity.position, this.entity.rotation);
      bottomRight = rotatePoint(bottomRight, this.entity.position, this.entity.rotation);

      return [topLeft, topRight, bottomLeft, bottomRight];
   }

   public calculateHitboxBounds(): HitboxBounds {
      const minX = Math.min(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      const maxX = Math.max(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      const minY = Math.min(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      const maxY = Math.max(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      return [minX, maxX, minY, maxY];
   }

   public isColliding(otherHitbox: Hitbox<HitboxType>): boolean {
      switch (otherHitbox.info.type) {
         case "circular": {
            return circleAndRectangleDoIntersect(otherHitbox.entity.position, otherHitbox.info.radius, this.entity.position, this.info.width, this.info.height, this.entity.rotation);
         }
         case "rectangular": {
            const distance = this.entity.position.distanceFrom(otherHitbox.entity.position);
            if (distance > this.halfDiagonalLength + (otherHitbox as RectangularHitbox).halfDiagonalLength) {
               return false;
            }
            
            return rectanglesDoIntersect(this.entity.position, this.info.width, this.info.height, this.info.height, otherHitbox.entity.position, otherHitbox.info.width, otherHitbox.info.height, otherHitbox.entity.rotation);
         }
      }
   }
}

export default RectangularHitbox;