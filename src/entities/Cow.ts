import { ENTITY_INFO_RECORD, Hitbox, Point } from "webgl-test-shared";
import PassiveMobAI from "../ai/PassiveMobAI";
import HealthComponent from "../entity-components/HealthComponent";
import Mob from "./Mob";

class Cow extends Mob<"cow"> {
   private static readonly MAX_HEALTH = 10;

   public readonly type = "cow";

   private static readonly WANDER_CHANCE = 0.6;
   private static readonly WANDER_ACCELERATION = 100;
   private static readonly WANDER_TERMINAL_VELOCITY = 50;
   private static readonly VISION_RANGE = 200;
   private static readonly ESCAPE_RANGE = 300;
   private static readonly STARE_LOCK_TIME = 3;
   private static readonly STARE_TIME = 7;
   private static readonly STARE_COOLDOWN = 10;
   protected readonly ai: PassiveMobAI;

   public readonly hitbox = ENTITY_INFO_RECORD.cow.hitbox;

   constructor(position: Point) {
      super(position, null, null, 2 * Math.PI * Math.random(), [
         new HealthComponent(Cow.MAX_HEALTH, Cow.MAX_HEALTH, 0)
      ]);

      this.ai = new PassiveMobAI(this, {
         wanderChance: Cow.WANDER_CHANCE,
         wanderAcceleration: Cow.WANDER_ACCELERATION,
         wanderTerminalVelocity: Cow.WANDER_TERMINAL_VELOCITY,
         visionRange: Cow.VISION_RANGE,
         escapeRange: Cow.ESCAPE_RANGE,
         stareLockTime: Cow.STARE_LOCK_TIME,
         stareTime: Cow.STARE_TIME,
         stareCooldown: Cow.STARE_COOLDOWN
      });
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Cow;