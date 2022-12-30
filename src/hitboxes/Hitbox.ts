import { HitboxInfo, HitboxType, Point } from "webgl-test-shared";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

export type HitboxObject = { position: Point, rotation: number };

abstract class Hitbox<T extends HitboxType> {
   /** Whether the hitbox is in use or not */
   public isActive: boolean = false;

   public info!: HitboxInfo<T>;
   public hitboxObject!: HitboxObject;

   /** The bounds of the hitbox since the last physics update */
   public bounds!: HitboxBounds;

   private readonly activationCallbacks = new Set<() => void>();

   constructor(hitboxInfo?: HitboxInfo<T>) {
      if (typeof hitboxInfo !== "undefined") {
         this.setHitboxInfo(hitboxInfo);
      }
   }

   public setHitboxObject(hitboxObject: HitboxObject): void {
      this.hitboxObject = hitboxObject;
   }

   public setHitboxInfo(hitboxInfo: HitboxInfo<T>) {
      // If the entity was just activated, call any activation callbacks
      if (this.activationCallbacks.size > 0) {
         for (const callback of this.activationCallbacks) {
            callback();
         }
         this.activationCallbacks.clear();
      }
      
      this.info = hitboxInfo;
      this.isActive = true;
   }

   /** Adds a callback to the hitbox, called when the hitbox becomes active */
   public addActivationCallback(callback: () => void): void {
      this.activationCallbacks.add(callback);
   }

   protected abstract calculateHitboxBounds(): HitboxBounds;

   public updateHitboxBounds(): void {
      this.bounds = this.calculateHitboxBounds();
   }

   public abstract isColliding(otherHitbox: Hitbox<HitboxType>): boolean;
}

export default Hitbox;