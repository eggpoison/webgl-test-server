import { circleAndRectangleDoIntersect, circlesDoIntersect, HitboxType } from "webgl-test-shared";
import Hitbox, { HitboxBounds } from "./Hitbox";

class CircularHitbox extends Hitbox<"circular"> {
   protected calculateHitboxBounds(): HitboxBounds {
      const minX = this.hitboxObject.position.x - this.info.radius;
      const maxX = this.hitboxObject.position.x + this.info.radius;
      const minY = this.hitboxObject.position.y - this.info.radius;
      const maxY = this.hitboxObject.position.y + this.info.radius;
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
}

export default CircularHitbox;