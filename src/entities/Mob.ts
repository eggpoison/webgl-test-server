import { EntityType } from "webgl-test-shared";
import AI from "../ai/AI";
import Entity from "./Entity";

abstract class Mob<T extends EntityType> extends Entity<T> {
   protected abstract readonly ai: AI;

   public tick(): void {
      super.tick();

      this.ai.tick();
   }
}

export default Mob;