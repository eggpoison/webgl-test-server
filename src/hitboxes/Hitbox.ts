import { HitboxInfo, HitboxType } from "webgl-test-shared";
import Entity from "../entities/Entity";

export type HitboxBounds = [minX: number, maxX: number, minY: number, maxY: number];

abstract class Hitbox<T extends HitboxType> {
   public info: HitboxInfo<T>;
   public entity: Entity;

   /** The bounds of the hitbox since the last physics update */
   public bounds!: HitboxBounds;

   constructor(hitboxInfo: HitboxInfo<T>, entity: Entity) {
      this.info = hitboxInfo;
      this.entity = entity;
   }

   protected abstract calculateHitboxBounds(): HitboxBounds;

   public updateHitboxBounds(): void {
      this.bounds = this.calculateHitboxBounds();
   }

   public abstract isColliding(otherHitbox: Hitbox<HitboxType>): boolean;
}

export default Hitbox;