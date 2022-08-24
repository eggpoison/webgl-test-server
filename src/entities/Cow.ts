import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import HitboxComponent, { Hitbox } from "../entity-components/HitboxComponent";
import Entity from "./Entity";

class Cow extends Entity<"cow"> {
   private static readonly MAX_HEALTH = 10;

   public readonly type = "cow";

   private static readonly HITBOX: Hitbox = {
      type: "circular",
      radius: 64
   };

   constructor(position: Point) {
      super(position, null, null, [
         new HealthComponent(Cow.MAX_HEALTH, Cow.MAX_HEALTH, 0),
         new HitboxComponent(Cow.HITBOX)
      ]);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Cow;