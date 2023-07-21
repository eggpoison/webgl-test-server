import { SETTINGS, Vector } from "webgl-test-shared";
import Component from "./Component";
import Entity from "../entities/Entity";

let a = 0;

class HealthComponent extends Component {
   private static readonly INVULNERABILITY_DURATION = 0.3;

   public readonly maxHealth: number;
   private health: number;

   private readonly localInvulnerabilityHashes: { [immunityHash: string]: number } = {};

   private readonly hasGlobalInvulnerability: boolean;
   private globalInvulnerabilityTimer = 0;

   /** Amount of seconds that has passed since the entity was last hit */
   private secondsSinceLastHit: number | null = null;

   private knockbackMultiplier = 1;

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
   
   public setKnockbackMultiplier(knockbackMultiplier: number): void {
      this.knockbackMultiplier = knockbackMultiplier;
   }

   public getKnockbackMultiplier(): number {
      return this.knockbackMultiplier;
   }

   public getHealth(): number {
      return this.health;
   }

   /*
const healthComponent = this.getComponent("health")!;
      
      // Don't attack during invulnerability
      if (healthComponent.isInvulnerable(attackHash)) {
         return false;
      }
      
      const hitWasReceived = healthComponent.damage(damage);
 
      if (hitWasReceived) this.callEvents("hurt", damage, knockback, attackDirection, attackingEntity);

      // Push away from the source of damage
      if (hitWasReceived && !this.isRemoved && !this.isStatic) {
         if (attackingEntity !== null) {
            const angle = this.position.calculateAngleBetween(attackingEntity.position) + Math.PI;
            const force = new Vector(knockback * healthComponent.getKnockbackMultiplier(), angle);
            if (this.velocity !== null) {
               this.velocity.add(force);
            } else {
               this.velocity = force;
            }
         }
      }

      return true;
   */

   /**
    * Attempts to apply damage to an entity
    * @param damage The amount of damage given
    * @returns Whether the damage was received
    */
   public damage(damage: number, knockback: number, hitDirection: number, attackingEntity: Entity | null, attackHash?: string): boolean {
      // Don't receive damage if invulnerable
      if (this.isInvulnerable(attackHash)) return false;

      this.entity.callEvents("hurt", damage, attackingEntity);

      this.secondsSinceLastHit = 0;

      this.health -= damage;

      // If the entity was killed by the attack, destroy the entity
      if (this.health <= 0) {
         this.entity.callEvents("death");
         this.entity.remove();
      }

      if (this.hasGlobalInvulnerability) {
         this.globalInvulnerabilityTimer = HealthComponent.INVULNERABILITY_DURATION;
      }

      if (attackingEntity !== null && !this.entity.isStatic) {
         this.applyKnockback(knockback, hitDirection);
      }

      return true;
   }

   public applyKnockback(knockback: number, knockbackDirection: number): void {
      const force = new Vector(knockback * this.getKnockbackMultiplier(), knockbackDirection);
      if (this.entity.velocity !== null) {
         this.entity.velocity.add(force);
      } else {
         this.entity.velocity = force;
      }

      this.entity.callEvents("on_knockback", knockback, knockbackDirection);
   }

   public heal(healAmount: number): void {
      this.health += healAmount;
      if (this.health > this.maxHealth) {
         this.health = this.maxHealth;
      }
   }

   public addLocalInvulnerabilityHash(hash: string, invulnerabiityDurationSeconds: number): void {
      if (!this.localInvulnerabilityHashes.hasOwnProperty(hash)) {
         this.localInvulnerabilityHashes[hash] = invulnerabiityDurationSeconds;
      }
   }

   public isInvulnerable(attackHash?: string): boolean {
      // Global invulnerability
      if (this.hasGlobalInvulnerability && this.globalInvulnerabilityTimer > 0) {
         return true;
      }

      // Local invulnerability
      if (typeof attackHash !== "undefined" && this.localInvulnerabilityHashes.hasOwnProperty(attackHash)) {
         return true;
      }

      return false;
   }

   public getSecondsSinceLastHit(): number | null {
      return this.secondsSinceLastHit;
   }
}

export default HealthComponent;