import { HitboxInfo, HitboxType, Point } from "webgl-test-shared";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

export type HitboxObject = { position: Point, rotation: number };

abstract class Hitbox<T extends HitboxType> {
   public info!: HitboxInfo<T>;
   public hitboxObject!: HitboxObject;

   /** The bounds of the hitbox since the last physics update */
   public bounds!: HitboxBounds;

   /** The position of the hitbox, accounting for offset from its entity */
   public position!: Point;

   constructor(hitboxInfo?: HitboxInfo<T>) {
      if (typeof hitboxInfo !== "undefined") {
         this.setHitboxInfo(hitboxInfo);
      }
   }

   public setHitboxObject(hitboxObject: HitboxObject): void {
      this.hitboxObject = hitboxObject;
   }

   public setHitboxInfo(hitboxInfo: HitboxInfo<T>) {
      this.info = hitboxInfo;
   }

   protected abstract calculateHitboxBounds(): HitboxBounds;

   public updateHitboxBounds(): void {
      this.bounds = this.calculateHitboxBounds();
   }

   public updatePosition(): void {
      this.position = this.hitboxObject.position.copy();
      if (typeof this.info.offset !== "undefined") {
         this.position.add(this.info.offset);
      }
   }

   public abstract isColliding(otherHitbox: Hitbox<HitboxType>): boolean;
}

export default Hitbox;