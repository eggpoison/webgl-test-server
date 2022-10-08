import AI from "../ai/AI";
import Entity from "./Entity";

abstract class Mob extends Entity {
   protected abstract readonly ai: AI;

   public tick(): void {
      super.tick();

      this.ai.update();
   }
}

export default Mob;