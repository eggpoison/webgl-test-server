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

   private readonly localInvulnerabilityHashes: { [immunityHash: string]: number } = {};

   private readonly hasGlobalInvulnerability: boolean;
   private globalInvulnerabilityTimer = 0;

   /** Amount of seconds that has passed since the entity was last hit */
   private secondsSinceLastHit: number | null = null;

   constructor(maxHealth: number, hasGlobalInvulnerability: boolean) {
      super();

      this.maxHealth = maxHealth;
      this.health = maxHealth;

      this.hasGlobalInvulnerability = hasGlobalInvulnerability;
   }

   public tick(): void {
      if (this.secondsSinceLastHit !== null) {
         this.secondsSinceLastHit += 1 / SETTINGS.TPS;
      }

      // Update local invulnerability hashes
      for (const hash of Object.keys(this.localInvulnerabilityHashes)) {
         this.localInvulnerabilityHashes[hash] -= 1 / SETTINGS.TPS;
         if (this.localInvulnerabilityHashes[hash] <= 0) {
            delete this.localInvulnerabilityHashes[hash];
         }
      }

      // Update global invulnerability
      if (this.globalInvulnerabilityTimer > 0) {
         this.globalInvulnerabilityTimer -= 1 / SETTINGS.TPS;
      }
   }

   /**
    * Attempts to apply damage to an entity
    * @param damage The amount of damage given
    * @returns Whether the damage was received
    */
   public takeDamage(damage: number, attackHash?: string): boolean {
      // Don't receive damage if invulnerable
      if (this.isInvulnerable(attackHash)) return false;

      this.secondsSinceLastHit = 0;

      this.health -= damage;
      if (this.health <= 0) {
         this.entity.destroy();
         return true;
      }

      if (this.hasGlobalInvulnerability){
         this.globalInvulnerabilityTimer = HealthComponent.INVULNERABILITY_DURATION;
      }

      return true;
   }

   public getHealth(): number {
      return this.health;
   }

   public addLocalInvulnerabilityHash(hash: string, invulnerabiityDurationSeconds: number): void {
      if (!this.localInvulnerabilityHashes.hasOwnProperty(hash)) {
         this.localInvulnerabilityHashes[hash] = invulnerabiityDurationSeconds;
      }
   }

   public isInvulnerable(attackHash?: string): boolean {
      // Local invulnerability
      if (typeof attackHash !== "undefined" && this.localInvulnerabilityHashes.hasOwnProperty(attackHash)) {
         return true;
      }
      
      // Global invulnerability
      if (this.hasGlobalInvulnerability) {
         return this.globalInvulnerabilityTimer > 0;
      }

      return false;
   }

   public getSecondsSinceLastHit(): number | null {
      return this.secondsSinceLastHit;
   }
}

export default HealthComponent;