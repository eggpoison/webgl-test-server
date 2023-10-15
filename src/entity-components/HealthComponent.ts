import { GameObjectDebugData, HitData, Mutable, PlayerCauseOfDeath, SETTINGS, clamp } from "webgl-test-shared";
import Component from "./Component";
import Entity from "../entities/Entity";
import TombstoneDeathManager from "../tombstone-deaths";
import Player from "../entities/tribes/Player";
import Board from "../Board";

class HealthComponent extends Component {
   private static readonly INVULNERABILITY_DURATION = 0.3;

   public readonly maxHealth: number;
   public health: number;

   /** How much that incoming damage gets reduced. 0 = none, 1 = all */
   private defence = 0;
   private readonly defenceFactors: Record<string, number> = {};

   private readonly localIframeHashes = new Array<string>();
   private readonly localIframeDurations = new Array<number>();

   private readonly hasGlobalInvulnerability: boolean;
   private globalInvulnerabilityTimer = 0;

   /** Amount of seconds that has passed since the entity was last hit */
   private secondsSinceLastHit: number | null = null;

   public hitsTaken = new Array<HitData>();

   public amountHealedSinceLastPacketSend = 0;

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
      this.defenceFactors[name] = defence;
   }

   public removeDefence(name: string): void {
      if (!this.defenceFactors.hasOwnProperty(name)) {
         return;
      }
      
      this.defence -= this.defenceFactors[name];
      delete this.defenceFactors[name];
   }

   public tick(): void {
      if (this.secondsSinceLastHit !== null) {
         this.secondsSinceLastHit += 1 / SETTINGS.TPS;
      }

      // Update local invulnerability hashes
      for (let i = 0; i < this.localIframeHashes.length; i++) {
         this.localIframeDurations[i] -= 1 / SETTINGS.TPS;
         if (this.localIframeDurations[i] <= 0) {
            this.localIframeHashes.splice(i, 1);
            this.localIframeDurations.splice(i, 1);
            i--;
         }
      }

      // Update global invulnerability
      if (this.globalInvulnerabilityTimer > 0) {
         this.globalInvulnerabilityTimer -= 1 / SETTINGS.TPS;
      }

      // Remove old hit data
      for (let i = 0; i < this.hitsTaken.length; i++) {
         if (this.hitsTaken[i].tick !== Board.ticks) {
            this.hitsTaken.splice(i, 1);
            i--;
         }
      }
   }

   public isDead(): boolean {
      return this.health <= 0;
   }

   /**
    * Attempts to apply damage to an entity
    * @param damage The amount of damage given
    * @returns Whether the damage was received
    */
   public damage(damage: number, knockback: number, hitDirection: number | null, attackingEntity: Entity | null, causeOfDeath: PlayerCauseOfDeath, hitFlags: number, attackHash?: string): boolean {
      if (this.isInvulnerable(attackHash) || this.isDead()) return false;

      this.secondsSinceLastHit = 0;

      const absorbedDamage = damage * clamp(this.defence, 0, 1);
      const actualDamage = damage - absorbedDamage;
      
      this.health -= actualDamage;

      this.entity.callEvents("hurt", damage, attackingEntity, knockback, hitDirection);
      
      // If the entity was killed by the attack, destroy the entity
      if (this.isDead()) {
         this.entity.callEvents("death", attackingEntity);
         this.entity.remove();

         if (this.entity.type === "player") {
            TombstoneDeathManager.registerNewDeath((this.entity as Player).username, causeOfDeath);
         }

         Board.killedEntities.push({
            id: this.entity.id,
            boundingChunks: this.entity.chunks
         });
      }

      this.hitsTaken.push({
         knockback: knockback,
         angleFromAttacker: hitDirection,
         flags: hitFlags,
         tick: Board.ticks
      });
      
      if (this.hasGlobalInvulnerability) {
         this.globalInvulnerabilityTimer = HealthComponent.INVULNERABILITY_DURATION;
      }

      if (hitDirection !== null && !this.entity.isStatic) {
         this.applyKnockback(knockback, hitDirection);
      }

      return true;
   }

   public applyKnockback(knockback: number, knockbackDirection: number): void {
      if (typeof knockback === "undefined" || typeof knockbackDirection === "undefined") {
         throw new Error("Knockback was undefined");
      }
      
      const knockbackForce = knockback / this.entity.mass;
      this.entity.velocity.x += knockbackForce * Math.sin(knockbackDirection);
      this.entity.velocity.y += knockbackForce * Math.cos(knockbackDirection);
   }

   public heal(healAmount: number): void {
      let amountHealed: number;

      this.health += healAmount;
      if (this.health > this.maxHealth) {
         amountHealed = healAmount - (this.health - this.maxHealth); // Calculate by removing excess healing from amount healed
         this.health = this.maxHealth;
      } else {
         amountHealed = healAmount;
      }

      this.amountHealedSinceLastPacketSend += amountHealed;
   }

   public addLocalInvulnerabilityHash(hash: string, invulnerabilityDurationSeconds: number): void {
      const idx = this.localIframeHashes.indexOf(hash);
      if (idx === -1) {
         // Add new entry
         this.localIframeHashes.push(hash);
         this.localIframeDurations.push(invulnerabilityDurationSeconds);
      }
   }

   public isInvulnerable(attackHash?: string): boolean {
      // Global invulnerability
      if (this.hasGlobalInvulnerability && this.globalInvulnerabilityTimer > 0) {
         return true;
      }

      // Local invulnerability
      if (typeof attackHash !== "undefined" && this.localIframeHashes.indexOf(attackHash) !== -1) {
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