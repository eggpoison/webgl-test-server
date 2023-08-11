import { GameObjectDebugData, Mutable, SETTINGS, Vector } from "webgl-test-shared";
import Component from "./Component";
import Entity from "../entities/Entity";

let a = 0;

class HealthComponent extends Component {
   private static readonly INVULNERABILITY_DURATION = 0.3;

   public readonly maxHealth: number;
   private health: number;

   /** How much that incoming damage gets reduced. 0 = none, 1 = all */
   private defence = 0;
   private readonly defenceFactors: Record<string, number> = {};

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

   public addDefence(defence: number, name: string): void {
      if (this.defenceFactors.hasOwnProperty(name)) {
         return;
      }
      
      this.defence += defence;
      if (this.defence > 1) {
         this.defence = 1;
      }

      this.defenceFactors[name] = defence;
   }

   public removeDefence(name: string): void {
      if (!this.defenceFactors.hasOwnProperty(name)) {
         return;
      }
      
      this.defence -= this.defenceFactors[name];
      if (this.defence < 0) {
         this.defence = 0;
      }

      delete this.defenceFactors[name];
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

   public isDead(): boolean {
      return this.health <= 0;
   }

   /**
    * Attempts to apply damage to an entity
    * @param damage The amount of damage given
    * @returns Whether the damage was received
    */
   public damage(damage: number, knockback: number, hitDirection: number | null, attackingEntity: Entity | null, attackHash?: string): boolean {
      if (this.isInvulnerable(attackHash) || this.isDead()) return false;

      this.entity.callEvents("hurt", damage, attackingEntity, knockback, hitDirection);

      this.secondsSinceLastHit = 0;

      const absorbedDamage = damage * this.defence;
      const actualDamage = damage - absorbedDamage;
      
      this.health -= actualDamage;
      
      // If the entity was killed by the attack, destroy the entity
      if (this.isDead()) {
         this.entity.callEvents("death", attackingEntity);
         this.entity.remove();
      }

      if (this.hasGlobalInvulnerability) {
         this.globalInvulnerabilityTimer = HealthComponent.INVULNERABILITY_DURATION;
      }

      if (hitDirection !== null && !this.entity.isStatic) {
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

   public addDebugData(debugData: Mutable<GameObjectDebugData>): void {
      debugData.health = this.health;
      debugData.maxHealth = this.maxHealth;
   }
}

export default HealthComponent;