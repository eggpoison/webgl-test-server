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

   /** Updates the hitboxes position to match the position of its hitbox object */
   public updatePosition(): void {
      this.position = this.hitboxObject.position.copy();
      if (typeof this.info.offset !== "undefined") {
         this.position.add(this.info.offset);
      }
   }

   public setPosition(position: Point): void {
      this.position = position;
   }

   public abstract isColliding(otherHitbox: Hitbox<HitboxType>): boolean;

   public abstract resolveTileCollision(tileX: number, tileY: number): void;
}

export default Hitbox;