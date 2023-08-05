import { circleAndRectangleDoIntersect, circlesDoIntersect, HitboxType } from "webgl-test-shared";
import Hitbox, { HitboxBounds } from "./Hitbox";

class CircularHitbox extends Hitbox<"circular"> {
   protected calculateHitboxBounds(): HitboxBounds {
      const minX = this.position.x - this.info.radius;
      const maxX = this.position.x + this.info.radius;
      const minY = this.position.y - this.info.radius;
      const maxY = this.position.y + this.info.radius;
      return [minX, maxX, minY, maxY];
   }

   public isColliding(otherHitbox: Hitbox<HitboxType>): boolean {
      switch (otherHitbox.info.type) {
         case "circular": {
            return circlesDoIntersect(this.position, this.info.radius, otherHitbox.position, otherHitbox.info.radius);
         }
         case "rectangular": {
            return circleAndRectangleDoIntersect(this.position, this.info.radius, otherHitbox.position, otherHitbox.info.width, otherHitbox.info.height, otherHitbox.hitboxObject.rotation);
         }
      }
   }
   
   public resolveTileCollision(tileX: number, tileY: number): void {
      throw new Error("Method not implemented.");
   }
}

export default CircularHitbox;