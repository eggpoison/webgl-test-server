import { IEntityType, PlayerCauseOfDeath, SETTINGS, clamp } from "webgl-test-shared";
import Entity from "../Entity";
import { HealthComponentArray } from "./ComponentArray";
import TombstoneDeathManager from "../tombstone-deaths";
import { SERVER } from "../server";
import { onBerryBushHurt } from "../entities/resources/berry-bush";
import { onCowHurt } from "../entities/mobs/cow";
import { onKrumblidHurt } from "../entities/mobs/krumblid";
import { onTombstoneDeath } from "../entities/tombstone";
import { onZombieHurt } from "../entities/mobs/zombie";
import { onSlimeDeath, onSlimeHurt } from "../entities/mobs/slime";
import { onYetiHurt } from "../entities/mobs/yeti";
import { onFishHurt } from "../entities/mobs/fish";
import { onBoulderDeath } from "../entities/resources/boulder";
import { onFrozenYetiDeath, onFrozenYetiHurt } from "../entities/mobs/frozen-yeti";
import { onPlayerHurt } from "../entities/tribes/player";

export class HealthComponent {
   public readonly maxHealth: number;
   public health: number;

   /** How much that incoming damage gets reduced. 0 = none, 1 = all */
   public defence = 0;
   public readonly defenceFactors: Record<string, number> = {};

   public readonly localIframeHashes = new Array<string>();
   public readonly localIframeDurations = new Array<number>();

   // @Cleanup @Memory: This is only used to send to the player, does it have to be stored here??? (expensive)
   public amountHealedThisTick = 0;

   constructor(maxHealth: number) {
      this.maxHealth = maxHealth;
      this.health = maxHealth;
   }
}

export function tickHealthComponent(healthComponent: HealthComponent): void {
   healthComponent.amountHealedThisTick = 0;

   // Update local invulnerability hashes
   for (let i = 0; i < healthComponent.localIframeHashes.length; i++) {
      healthComponent.localIframeDurations[i] -= 1 / SETTINGS.TPS;
      if (healthComponent.localIframeDurations[i] <= 0) {
         healthComponent.localIframeHashes.splice(i, 1);
         healthComponent.localIframeDurations.splice(i, 1);
         i--;
      }
   }
}

/**
 * Attempts to apply damage to an entity
 * @param damage The amount of damage given
 * @returns Whether the damage was received
 */
export function damageEntity(entity: Entity, damage: number, knockback: number, hitDirection: number | null, attackingEntity: Entity | null, causeOfDeath: PlayerCauseOfDeath, hitFlags: number, attackHash?: string): boolean {
   const healthComponent = HealthComponentArray.getComponent(entity);
   
   if (entityIsInvulnerable(healthComponent, attackHash) || healthComponent.health <= 0) {
      return false;
   }

   const absorbedDamage = damage * clamp(healthComponent.defence, 0, 1);
   const actualDamage = damage - absorbedDamage;
   
   healthComponent.health -= actualDamage;

   // If the entity was killed by the attack, destroy the entity
   if (healthComponent.health <= 0) {
      entity.remove();

      switch (entity.type) {
         case IEntityType.tombstone: {
            onTombstoneDeath(entity, attackingEntity);
            break;
         }
         case IEntityType.slime: {
            if (attackingEntity !== null) {
               onSlimeDeath(entity, attackingEntity);
            }
            break;
         }
         case IEntityType.boulder: {
            if (attackingEntity !== null) {
               onBoulderDeath(entity, attackingEntity);
            }
            break;
         }
         case IEntityType.frozenYeti: {
            onFrozenYetiDeath(entity, attackingEntity);
            break;
         }
      }

      // @Cleanup: This should instead just be an event created in the player class
      if (entity.type === IEntityType.player) {
         TombstoneDeathManager.registerNewDeath(entity, causeOfDeath);
      }
   }

   SERVER.registerEntityHit({
      entityPositionX: entity.position.x,
      entityPositionY: entity.position.y,
      hitEntityID: entity.id,
      damage: damage,
      knockback: knockback,
      angleFromAttacker: hitDirection,
      attackerID: attackingEntity !== null ? attackingEntity.id : -1,
      flags: hitFlags
   });

   if (hitDirection !== null && !entity.isStatic) {
      applyKnockback(entity, knockback, hitDirection);
   }

   switch (entity.type) {
      case IEntityType.berryBush: {
         onBerryBushHurt(entity);
         break;
      }
      case IEntityType.cow: {
         if (attackingEntity !== null) {
            onCowHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.krumblid: {
         if (attackingEntity !== null) {
            onKrumblidHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.zombie: {
         if (attackingEntity !== null) {
            onZombieHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.slime: {
         if (attackingEntity !== null) {
            onSlimeHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.yeti: {
         if (attackingEntity !== null) {
            onYetiHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.fish: {
         if (attackingEntity !== null) {
            onFishHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.frozenYeti: {
         if (attackingEntity !== null) {
            onFrozenYetiHurt(entity, attackingEntity, damage);
         }
         break;
      }
      case IEntityType.player: {
         if (attackingEntity !== null) {
            onPlayerHurt(entity, attackingEntity);
         }
         break;
      }
   }

   return true;
}

// @Cleanup: Should this be here?
export function applyKnockback(entity: Entity, knockback: number, knockbackDirection: number): void {
   if (typeof knockback === "undefined" || typeof knockbackDirection === "undefined") {
      throw new Error("Knockback was undefined");
   }
   
   const knockbackForce = knockback / entity.mass;
   entity.velocity.x += knockbackForce * Math.sin(knockbackDirection);
   entity.velocity.y += knockbackForce * Math.cos(knockbackDirection);
}

export function healEntity(entity: Entity, healAmount: number): void {
   const healthComponent = HealthComponentArray.getComponent(entity);

   let amountHealed: number;

   healthComponent.health += healAmount;
   if (healthComponent.health > healthComponent.maxHealth) {
      amountHealed = healAmount - (healthComponent.health - healthComponent.maxHealth); // Calculate by removing excess healing from amount healed
      healthComponent.health = healthComponent.maxHealth;
   } else {
      amountHealed = healAmount;
   }

   healthComponent.amountHealedThisTick += amountHealed;
}

export function entityIsInvulnerable(healthComponent: HealthComponent, attackHash?: string): boolean {
   // Local invulnerability
   if (typeof attackHash !== "undefined" && healthComponent.localIframeHashes.indexOf(attackHash) !== -1) {
      return true;
   }

   return false;
}

export function addLocalInvulnerabilityHash(healthComponent: HealthComponent, hash: string, invulnerabilityDurationSeconds: number): void {
   const idx = healthComponent.localIframeHashes.indexOf(hash);
   if (idx === -1) {
      // Add new entry
      healthComponent.localIframeHashes.push(hash);
      healthComponent.localIframeDurations.push(invulnerabilityDurationSeconds);
   }
}

export function getEntityHealth(entity: Entity): number {
   const healthComponent = HealthComponentArray.getComponent(entity);
   return healthComponent.health;
}

export function addDefence(healthComponent: HealthComponent, defence: number, name: string): void {
   if (healthComponent.defenceFactors.hasOwnProperty(name)) {
      return;
   }
   
   healthComponent.defence += defence;
   healthComponent.defenceFactors[name] = defence;
}

export function removeDefence(healthComponent: HealthComponent, name: string): void {
   if (!healthComponent.defenceFactors.hasOwnProperty(name)) {
      return;
   }
   
   healthComponent.defence -= healthComponent.defenceFactors[name];
   delete healthComponent.defenceFactors[name];
}