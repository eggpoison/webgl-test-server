import { angle, circleAndRectangleDoIntersect, HitboxVertexPositions, Point, rectanglePointsDoIntersect, rotateXAroundOrigin, rotateXAroundPoint, rotateYAroundOrigin, rotateYAroundPoint } from "webgl-test-shared";
import Hitbox from "./Hitbox";
import CircularHitbox from "./CircularHitbox";
import GameObject from "src/GameObject";

class RectangularHitbox extends Hitbox {
   public width: number;
   public height: number;
   
   /** Length of half of the diagonal of the rectangle */
   public halfDiagonalLength!: number;

   private previousRotation = 0;
   /** The rotation of the hitbox relative to its game object */
   public rotation = 0;
   /** Rotation of the hitboxes game object */
   public externalRotation = 0;

   private vertexOffsetTopLeftX = -1;
   private vertexOffsetTopLeftY = -1;
   private vertexOffsetTopRightX = -1;
   private vertexOffsetTopRightY = -1;
   private vertexOffsetBottomLeftX = -1;
   private vertexOffsetBottomLeftY = -1;
   private vertexOffsetBottomRightX = -1;
   private vertexOffsetBottomRightY = -1;
   public vertexPositions: HitboxVertexPositions = [new Point(-1, -1), new Point(-1, -1), new Point(-1, -1), new Point(-1, -1)];
   public sideAxes = [new Point(0, 0), new Point(0, 0)] as const;

   constructor(width: number, height: number, offsetX: number, offsetY: number) {
      super(offsetX, offsetY);

      this.width = width;
      this.height = height;
      this.updateHalfDiagonalLength();
      this.updateVertexPositions();
   }

   public updateHalfDiagonalLength(): void {
      this.halfDiagonalLength = Math.sqrt(Math.pow(this.width / 2, 2) + Math.pow(this.height / 2, 2));
   }

   public updateFromGameObject(gameObject: GameObject): void {
      super.updateFromGameObject(gameObject);
      this.externalRotation = gameObject.rotation;
   }

   private updateVertexPositions(): void {
      const newRotation = this.rotation + this.externalRotation;
      if (newRotation !== this.previousRotation) {
         const x1 = -this.width / 2;
         const x2 = this.width / 2;
         const y1 = -this.height / 2;
         const y2 = this.height / 2;
   
         // Rotate vertices
   
         // Top left vertex
         this.vertexOffsetTopLeftX = rotateXAroundOrigin(x1, y2, newRotation);
         this.vertexOffsetTopLeftY = rotateYAroundOrigin(x1, y2, newRotation);
         // Top right vertex
         this.vertexOffsetTopRightX = rotateXAroundOrigin(x2, y2, newRotation);
         this.vertexOffsetTopRightY = rotateYAroundOrigin(x2, y2, newRotation);
         // Bottom left vertex
         this.vertexOffsetBottomLeftX = rotateXAroundOrigin(x1, y1, newRotation);
         this.vertexOffsetBottomLeftY = rotateYAroundOrigin(x1, y1, newRotation);
         // Bottom right vertex
         this.vertexOffsetBottomRightX = rotateXAroundOrigin(x2, y1, newRotation);
         this.vertexOffsetBottomRightY = rotateYAroundOrigin(x2, y1, newRotation);

         this.previousRotation = newRotation;
         
         this.calculateSideAxes();
      }

      this.vertexPositions[0].x = this.vertexOffsetTopLeftX + this.position.x;
      this.vertexPositions[0].y = this.vertexOffsetTopLeftY + this.position.y;
      this.vertexPositions[1].x = this.vertexOffsetTopRightX + this.position.x;
      this.vertexPositions[1].y = this.vertexOffsetTopRightY + this.position.y;
      this.vertexPositions[2].x = this.vertexOffsetBottomLeftX + this.position.x;
      this.vertexPositions[2].y = this.vertexOffsetBottomLeftY + this.position.y;
      this.vertexPositions[3].x = this.vertexOffsetBottomRightX + this.position.x;
      this.vertexPositions[3].y = this.vertexOffsetBottomRightY + this.position.y;
   }

   private calculateSideAxes(): void {
      // Angle between vertex 0 (top left) and vertex 1 (top right)
      const angle1 = angle(this.vertexOffsetTopRightX - this.vertexOffsetTopLeftX, this.vertexOffsetTopRightY - this.vertexOffsetTopLeftY);
      this.sideAxes[0].x = Math.sin(angle1);
      this.sideAxes[0].y = Math.cos(angle1);
      
      // Angle between vertex 2 (bottom left) and vertex 3 (bottom right)
      const angle2 = angle(this.vertexOffsetBottomRightX - this.vertexOffsetBottomLeftX, this.vertexOffsetBottomRightY - this.vertexOffsetBottomLeftY);
      this.sideAxes[1].x = Math.sin(angle2);
      this.sideAxes[1].y = Math.cos(angle2);
   }

   public updateHitboxBounds(): void {
      this.updateVertexPositions();

      this.bounds[0] = Math.min(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      this.bounds[1] = Math.max(this.vertexPositions[0].x, this.vertexPositions[1].x, this.vertexPositions[2].x, this.vertexPositions[3].x);
      this.bounds[2] = Math.min(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
      this.bounds[3] = Math.max(this.vertexPositions[0].y, this.vertexPositions[1].y, this.vertexPositions[2].y, this.vertexPositions[3].y);
   }

   public isColliding(otherHitbox: RectangularHitbox | CircularHitbox): boolean {
      // @Speed: This check is slow
      if (otherHitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         return circleAndRectangleDoIntersect(otherHitbox.position, (otherHitbox as CircularHitbox).radius, this.position, this.width, this.height, this.rotation + this.externalRotation);
      } else {
         // Rectangular hitbox
         // If the distance between the entities is greater than the sum of their half diagonals then they're not colliding
         const distanceSquared = Math.pow(this.position.x - otherHitbox.position.x, 2) + Math.pow(this.position.y - otherHitbox.position.y, 2);
         if (distanceSquared > Math.pow(this.halfDiagonalLength + (otherHitbox as RectangularHitbox).halfDiagonalLength, 2)) {
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