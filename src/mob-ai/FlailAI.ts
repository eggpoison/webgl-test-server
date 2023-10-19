import { SETTINGS, TileType, randFloat } from "webgl-test-shared";
import AI from "./AI";
import { MobAIType } from "../mob-ai-types";
import Mob from "../entities/mobs/Mob";

interface FlailAIParams {
   readonly flailIntervalSeconds: number;
   readonly flailForce: number;
}

class FlailAI extends AI {
   public type = MobAIType.flail as const;

   private readonly flailIntervalSeconds: number;
   private readonly flailForce: number;

   private flailTimer = 0;

   constructor(mob: Mob, aiParams: FlailAIParams) {
      super(mob);

      this.flailIntervalSeconds = aiParams.flailIntervalSeconds;
      this.flailForce = aiParams.flailForce;
   }

   public tick(): void {
      super.tick();

      this.flailTimer += 1 / SETTINGS.TPS;
      if (this.flailTimer >= this.flailIntervalSeconds) {
         this.flail();
         this.flailTimer = 0;
      }
   }

   private flail(): void {
      const flailDirection = 2 * Math.PI * Math.random();

      this.mob.velocity.x += this.flailForce * Math.sin(flailDirection);
      this.mob.velocity.y += this.flailForce * Math.cos(flailDirection);

      this.mob.rotation = flailDirection + randFloat(-0.5, 0.5);
   }

   protected onActivation(): void {
      this.flailTimer = 0;
   }

   public canSwitch(): boolean {
      return this.mob.tile.type !== TileType.water;
   }
}

export default FlailAI;