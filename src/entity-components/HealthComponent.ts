import { SETTINGS } from "webgl-test-shared";
import { SERVER } from "../server";
import Component from "./Component";

/*

Damage calculations:


*/

class HealthComponent extends Component {
   private static readonly INVULNERABILITY_DURATION = 0.3;

   private readonly maxHealth: number;

   private health: number;
   private armour: number;

   private invulnerabilityTimer = 0;

   constructor(maxHealth: number, health: number, armour: number) {
      super();

      this.maxHealth = maxHealth;
      this.health = health;
      this.armour = armour;
   }

   public update(): void {
      if (this.invulnerabilityTimer > 0) {
         this.invulnerabilityTimer -= 1 / SETTINGS.TPS;

         if (this.invulnerabilityTimer <= 0) {
            SERVER.board.removeAttack(this.entity);
         } else {
            const progress = 1 - this.invulnerabilityTimer / HealthComponent.INVULNERABILITY_DURATION;
            SERVER.board.attackInfoRecord[this.entity.id].progress = progress;
         }
      }
   }

   /**
    * Attempts to apply damage to an entity
    * @param damage The amount of damage given
    * @returns If an attack should be started
    */
   public receiveDamage(damage: number): boolean {
      // Don't receive damage if invulnerable
      if (this.isInvulnerable()) return false;

      this.health -= damage;
      if (this.health <= 0) {
         this.entity.kill(null);
         return false;
      }

      this.invulnerabilityTimer = HealthComponent.INVULNERABILITY_DURATION;

      return true;
   }

   public getHealth(): number {
      return this.health;
   }

   public isInvulnerable(): boolean {
      return this.invulnerabilityTimer > 0;
   }
}

export default HealthComponent;