import AI from "../ai/AI";
import Entity from "./Entity";

abstract class Mob extends Entity {
   protected abstract readonly ai: AI;

   public tick(): void {
      this.ai.tick();
   }
}

export default Mob;