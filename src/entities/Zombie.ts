import { CowSpecies, Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import { SERVER } from "../server";
import Entity from "./Entity";
import Mob from "./Mob";

class Zombie extends Mob {
   private static readonly MAX_HEALTH = 20;

   private static readonly DAMAGE = 2;
   
   /** The type of the zombie, 0-2 */
   private readonly zombieType: number;

   constructor(position: Point) {
      super(position, "zombie", {
         health: new HealthComponent(Zombie.MAX_HEALTH, false)
      });
      
      this.zombieType = Math.floor(Math.random() * 3);

      // Hurt players on collision
      this.createEvent("enter_collision", (collidingEntity: Entity) => {
         if (collidingEntity.type === "player") {
            collidingEntity.takeDamage(Zombie.DAMAGE, this);

            // Push away from the entity on collision
            const angle = this.position.angleBetween(collidingEntity.position) + Math.PI;
            this.addVelocity(75, angle);
         }
      });
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