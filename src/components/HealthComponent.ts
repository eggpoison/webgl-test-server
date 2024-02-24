import { IEntityType, PlayerCauseOfDeath, SettingsConst, clamp } from "webgl-test-shared";
import Entity from "../Entity";
import { HealthComponentArray } from "./ComponentArray";
import TombstoneDeathManager from "../tombstone-deaths";
import { onBerryBushHurt } from "../entities/resources/berry-bush";
import { onCowHurt } from "../entities/mobs/cow";
import { onKrumblidHurt } from "../entities/mobs/krumblid";
import { onTombstoneDeath } from "../entities/tombstone";
import { onZombieHurt, onZombieVisibleEntityHurt } from "../entities/mobs/zombie";
import { onSlimeDeath, onSlimeHurt } from "../entities/mobs/slime";
import { onYetiHurt } from "../entities/mobs/yeti";
import { onFishHurt } from "../entities/mobs/fish";
import { onBoulderDeath } from "../entities/resources/boulder";
import { onFrozenYetiDeath, onFrozenYetiHurt } from "../entities/mobs/frozen-yeti";
import { onPlayerHurt } from "../entities/tribes/player";
import { onTribeWorkerHurt } from "../entities/tribes/tribe-worker";
import { onTribeWarriorHurt } from "../entities/tribes/tribe-warrior";
import { onGolemHurt } from "../entities/mobs/golem";
import { onWoodenWallDeath } from "../entities/structures/wooden-wall";
import { AIHelperComponentArray } from "./AIHelperComponent";
import { SERVER } from "../server";
import { PhysicsComponentArray } from "./PhysicsComponent";

export class HealthComponent {
   public readonly maxHealth: number;
   public health: number;

   /** How much that incoming damage gets reduced. 0 = none, 1 = all */
   public defence = 0;
   public readonly defenceFactors: Record<string, number> = {};

   public readonly localIframeHashes = new Array<string>();
   public readonly localIframeDurations = new Array<number>();

   constructor(maxHealth: number) {
      this.maxHealth = maxHealth;
      this.health = maxHealth;
   }
}

export function tickHealthComponent(healthComponent: HealthComponent): void {
   // Update local invulnerability hashes
   for (let i = 0; i < healthComponent.localIframeHashes.length; i++) {
      healthComponent.localIframeDurations[i] -= SettingsConst.I_TPS;
      if (healthComponent.localIframeDurations[i] <= 0) {
         healthComponent.localIframeHashes.splice(i, 1);
         healthComponent.localIframeDurations.splice(i, 1);
         i--;
      }
   }
}

export function canDamageEntity(healthComponent: HealthComponent, attackHash: string): boolean {
   // Can't attack if the entity has local invulnerability
   if (typeof attackHash !== "undefined" && healthComponent.localIframeHashes.indexOf(attackHash) !== -1) {
      return false;
   }

   return true;
}

/**
 * Attempts to apply damage to an entity
 * @param damage The amount of damage given
 * @returns Whether the damage was received
 */
export function damageEntity(entity: Entity, damage: number, attackingEntity: Entity | null, causeOfDeath: PlayerCauseOfDeath, attackHash?: string): boolean {
   const healthComponent = HealthComponentArray.getComponent(entity);

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
         case IEntityType.woodenWall: {
            onWoodenWallDeath(entity, attackingEntity);
            break;
         }
      }

      if (entity.type === IEntityType.player) {
         TombstoneDeathManager.registerNewDeath(entity, causeOfDeath);
      }
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
      case IEntityType.tribeWorker: {
         if (attackingEntity !== null) {
            onTribeWorkerHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.tribeWarrior: {
         if (attackingEntity !== null) {
            onTribeWarriorHurt(entity, attackingEntity);
         }
         break;
      }
      case IEntityType.golem: {
         if (attackingEntity !== null) {
            onGolemHurt(entity, attackingEntity, damage);
         }
         break;
      }
   }

   // @Speed
   const alertedEntityIDs = new Array<number>();
   for (let i = 0; i < entity.chunks.length; i++) {
      const chunk = entity.chunks[i];
      for (let j = 0; j < chunk.viewingEntities.length; j++) {
         const viewingEntity = chunk.viewingEntities[j];
         if (alertedEntityIDs.indexOf(viewingEntity.id) !== -1) {
            continue;
         }

         const aiHelperComponent = AIHelperComponentArray.getComponent(viewingEntity);
         if (aiHelperComponent.visibleEntities.includes(entity)) {
            switch (viewingEntity.type) {
               case IEntityType.zombie: {
                  if (causeOfDeath !== PlayerCauseOfDeath.fire && causeOfDeath !== PlayerCauseOfDeath.poison) {
                     onZombieVisibleEntityHurt(viewingEntity, entity);
                  }
                  break;
               }
            }
         }

         alertedEntityIDs.push(viewingEntity.id);
      }
   }

   return true;
}

export function healEntity(entity: Entity, healAmount: number, healerID: number): void {
   if (healAmount <= 0) {
      return;
   }
   
   const healthComponent = HealthComponentArray.getComponent(entity);

   healthComponent.health += healAmount;

   // @Speed: Is there a smart way to remove this branch?
   if (healthComponent.health > healthComponent.maxHealth) {
      const amountHealed = healAmount - (healthComponent.health - healthComponent.maxHealth); // Calculate by removing excess healing from amount healed
      SERVER.registerEntityHeal({
         entityPositionX: entity.position.x,
         entityPositionY: entity.position.y,
         healedID: entity.id,
         healerID: healerID,
         healAmount: amountHealed
      });

      healthComponent.health = healthComponent.maxHealth;
   } else {
      SERVER.registerEntityHeal({
         entityPositionX: entity.position.x,
         entityPositionY: entity.position.y,
         healedID: entity.id,
         healerID: healerID,
         healAmount: healAmount
      });
   }
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