import { CowSpecies, Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import { SERVER } from "../server";
import Mob from "./Mob";

class Zombie extends Mob {
   private static readonly MAX_HEALTH = 20;
   
   /** The type of the zombie, 0-2 */
   private readonly zombieType: number;

   constructor(position: Point, zombieType: number) {
      super(position, "zombie", {
         health: new HealthComponent(Zombie.MAX_HEALTH)
      });
      
      this.zombieType = zombieType;
   }

   public tick(): void {
      super.tick();

      if (!SERVER.isNight()) {
         super.applyStatusEffect("fire", 5);
      }
   }

   public getClientArgs(): [zombieType: number] {
      return [this.zombieType];
   }
}

export default Zombie;