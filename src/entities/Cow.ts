import { Point } from "webgl-test-shared";
import PassiveMobAI from "../ai/PassiveMobAI";
import HealthComponent from "../entity-components/HealthComponent";
import HitboxComponent, { Hitbox } from "../entity-components/HitboxComponent";
import Mob from "./Mob";

class Cow extends Mob<"cow"> {
   private static readonly MAX_HEALTH = 10;

   public readonly type = "cow";

   private static readonly WANDER_CHANCE = 0.6;
   private static readonly WANDER_ACCELERATION = 100;
   private static readonly WANDER_TERMINAL_VELOCITY = 100;
   private static readonly VISION_RANGE = 64;
   private static readonly ESCAPE_RANGE = 96;
   protected readonly ai: PassiveMobAI;

   private static readonly HITBOX: Hitbox = {
      type: "circular",
      radius: 64
   };

   constructor(position: Point) {
      super(position, null, null, [
         new HealthComponent(Cow.MAX_HEALTH, Cow.MAX_HEALTH, 0),
         new HitboxComponent(Cow.HITBOX)
      ]);

      this.ai = new PassiveMobAI(this, Cow.WANDER_CHANCE, Cow.WANDER_ACCELERATION, Cow.WANDER_TERMINAL_VELOCITY, Cow.VISION_RANGE, Cow.ESCAPE_RANGE);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Cow;