import { HitboxInfo, HitboxType, Point } from "webgl-test-shared";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

export type HitboxObject<T extends unknown> = T & { position: Point, rotation: number };

abstract class Hitbox<T extends HitboxType> {
   public info: HitboxInfo<T>;
   public hitboxObject: HitboxObject<unknown>;

   /** The bounds of the hitbox since the last physics update */
   public bounds!: HitboxBounds;

   constructor(hitboxInfo: HitboxInfo<T>, hitboxObject: HitboxObject<unknown>) {
      this.info = hitboxInfo;
      this.hitboxObject = hitboxObject;
   }

   protected abstract calculateHitboxBounds(): HitboxBounds;

   public updateHitboxBounds(): void {
      this.bounds = this.calculateHitboxBounds();
   }

   public abstract isColliding(otherHitbox: Hitbox<HitboxType>): boolean;
}

export default Hitbox;