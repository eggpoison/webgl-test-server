import { PlayerCauseOfDeath, STATUS_EFFECT_MODIFIERS, StatusEffectConst, customTickIntervalHasPassed } from "webgl-test-shared";
import { PhysicsComponentArray, StatusEffectComponentArray } from "./ComponentArray";
import Entity from "../Entity";
import { damageEntity } from "./HealthComponent";
import { SERVER } from "../server";

export class StatusEffectComponent {
   public readonly activeStatusEffectTypes = new Array<StatusEffectConst>();
   public readonly activeStatusEffectTicksRemaining = new Array<number>();
   public readonly activeStatusEffectTicksElapsed = new Array<number>();

   public readonly statusEffectImmunityBitset: number;

   constructor(statusEffectImmunityBitset: number) {
      this.statusEffectImmunityBitset = statusEffectImmunityBitset;
   }
}

const entityIsImmuneToStatusEffect = (statusEffectComponent: StatusEffectComponent, statusEffect: StatusEffectConst): boolean => {
   return (statusEffectComponent.statusEffectImmunityBitset & statusEffect) > 0;
}

export function applyStatusEffect(entity: Entity, statusEffect: StatusEffectConst, durationTicks: number): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);
   if (entityIsImmuneToStatusEffect(statusEffectComponent, statusEffect)) {
      return;
   }
   
   if (!hasStatusEffect(statusEffectComponent, statusEffect)) {
      // New status effect
      
      statusEffectComponent.activeStatusEffectTypes.push(statusEffect);
      statusEffectComponent.activeStatusEffectTicksElapsed.push(0);
      statusEffectComponent.activeStatusEffectTicksRemaining.push(durationTicks);

      if (PhysicsComponentArray.hasComponent(entity)) {
         const physicsComponent = PhysicsComponentArray.getComponent(entity);
         physicsComponent.moveSpeedMultiplier *= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
      }
   } else {
      // Existing status effect

      for (let i = 0; i < statusEffectComponent.activeStatusEffectTypes.length; i++) {
         if (durationTicks > statusEffectComponent.activeStatusEffectTicksRemaining[i]) {
            statusEffectComponent.activeStatusEffectTicksRemaining[i] = durationTicks;
            break;
         }
      }
   }
}

export function hasStatusEffect(statusEffectComponent: StatusEffectComponent, statusEffect: StatusEffectConst): boolean {
   for (let i = 0; i < statusEffectComponent.activeStatusEffectTypes.length; i++) {
      if (statusEffectComponent.activeStatusEffectTypes[i] === statusEffect) {
         return true;
      }
   }
   return false;
}

export function clearStatusEffect(entity: Entity, statusEffectIndex: number): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);

   if (PhysicsComponentArray.hasComponent(entity)) {
      const statusEffect = statusEffectComponent.activeStatusEffectTypes[statusEffectIndex];
      
      const physicsComponent = PhysicsComponentArray.getComponent(entity);
      physicsComponent.moveSpeedMultiplier /= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
   }

   statusEffectComponent.activeStatusEffectTypes.splice(statusEffectIndex, 1);
   statusEffectComponent.activeStatusEffectTicksRemaining.splice(statusEffectIndex, 1);
   statusEffectComponent.activeStatusEffectTicksElapsed.splice(statusEffectIndex, 1);
}

export function tickStatusEffectComponent(entity: Entity): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);

   for (let i = 0; i < statusEffectComponent.activeStatusEffectTypes.length; i++) {
      const statusEffect = statusEffectComponent.activeStatusEffectTypes[i];

      statusEffectComponent.activeStatusEffectTicksRemaining[i]--;
      if (statusEffectComponent.activeStatusEffectTicksRemaining[i] === 0) {
         clearStatusEffect(entity, i);
         i--;
         continue;
      }

      statusEffectComponent.activeStatusEffectTicksElapsed[i]++;

      switch (statusEffect) {
         case StatusEffectConst.burning: {
            // If the entity is in a river, clear the fire effect
            if (entity.isInRiver) {
               clearStatusEffect(entity, i);
            } else {
               // Fire tick
               const ticksElapsed = statusEffectComponent.activeStatusEffectTicksElapsed[i];
               if (customTickIntervalHasPassed(ticksElapsed, 0.75)) {
                  damageEntity(entity, 1, null, PlayerCauseOfDeath.fire);
                  SERVER.registerEntityHit({
                     entityPositionX: entity.position.x,
                     entityPositionY: entity.position.y,
                     hitEntityID: entity.id,
                     damage: 1,
                     knockback: 0,
                     angleFromAttacker: null,
                     attackerID: -1,
                     flags: 0
                  });
               }
            }
            break;
         }
         case StatusEffectConst.poisoned: {
            const ticksElapsed = statusEffectComponent.activeStatusEffectTicksElapsed[i];
            if (customTickIntervalHasPassed(ticksElapsed, 0.5)) {
               damageEntity(entity, 1, null, PlayerCauseOfDeath.poison);
               SERVER.registerEntityHit({
                  entityPositionX: entity.position.x,
                  entityPositionY: entity.position.y,
                  hitEntityID: entity.id,
                  damage: 1,
                  knockback: 0,
                  angleFromAttacker: null,
                  attackerID: -1,
                  flags: 0
               });
            }
            break;
         }
         case StatusEffectConst.bleeding: {
            const ticksElapsed = statusEffectComponent.activeStatusEffectTicksElapsed[i];
            if (customTickIntervalHasPassed(ticksElapsed, 1)) {
               damageEntity(entity, 1, null, PlayerCauseOfDeath.bloodloss);
               SERVER.registerEntityHit({
                  entityPositionX: entity.position.x,
                  entityPositionY: entity.position.y,
                  hitEntityID: entity.id,
                  damage: 1,
                  knockback: 0,
                  angleFromAttacker: null,
                  attackerID: -1,
                  flags: 0
               });
            }
            break;
         }
      }
   }
}