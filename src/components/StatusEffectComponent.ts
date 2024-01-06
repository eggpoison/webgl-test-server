import { PlayerCauseOfDeath, STATUS_EFFECT_MODIFIERS, StatusEffectConst, customTickIntervalHasPassed } from "webgl-test-shared";
import { StatusEffectComponentArray } from "./ComponentArray";
import Entity from "../Entity";
import { damageEntity } from "./HealthComponent";

export const NUM_STATUS_EFFECTS = Object.keys(STATUS_EFFECT_MODIFIERS).length;

export class StatusEffectComponent {
   public readonly ticksRemaining = [0, 0, 0, 0];
   public readonly ticksElapsed = [0, 0, 0, 0];

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
      
      statusEffectComponent.ticksElapsed[statusEffect] = 0;
      statusEffectComponent.ticksRemaining[statusEffect] = durationTicks;

      entity.moveSpeedMultiplier *= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
   } else {
      // Existing status effect

      if (durationTicks > statusEffectComponent.ticksRemaining[statusEffect]) {
         statusEffectComponent.ticksRemaining[statusEffect] = durationTicks;
      }
   }
}

export function hasStatusEffect(statusEffectComponent: StatusEffectComponent, statusEffect: StatusEffectConst): boolean {
   return statusEffectComponent.ticksRemaining[statusEffect] > 0;
}

export function clearStatusEffect(entity: Entity, statusEffect: StatusEffectConst): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);
   statusEffectComponent.ticksRemaining[statusEffect] = 0;
   entity.moveSpeedMultiplier /= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
}

export function tickStatusEffectComponent(entity: Entity): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);

   for (let statusEffect = 0; statusEffect < NUM_STATUS_EFFECTS; statusEffect++) {
      const ticksRemaining = statusEffectComponent.ticksRemaining[statusEffect];
      if (ticksRemaining > 0) {
         statusEffectComponent.ticksRemaining[statusEffect]--;
         statusEffectComponent.ticksElapsed[statusEffect]++;
         if (statusEffectComponent.ticksRemaining[statusEffect] === 0) {
            clearStatusEffect(entity, statusEffect);
         }

         switch (statusEffect) {
            case StatusEffectConst.burning: {
               // If the entity is in a river, clear the fire effect
               if (entity.isInRiver) {
                  clearStatusEffect(entity, StatusEffectConst.burning);
               } else {
                  // Fire tick
                  const ticksElapsed = statusEffectComponent.ticksElapsed[StatusEffectConst.burning];
                  if (customTickIntervalHasPassed(ticksElapsed, 0.75)) {
                     damageEntity(entity, 1, 0, null, null, PlayerCauseOfDeath.fire, 0);
                  }
               }
               break;
            }
            case StatusEffectConst.poisoned: {
               const ticksElapsed = statusEffectComponent.ticksElapsed[StatusEffectConst.poisoned];
               if (customTickIntervalHasPassed(ticksElapsed, 0.5)) {
                  damageEntity(entity, 1, 0, null, null, PlayerCauseOfDeath.poison, 0);
               }
               break;
            }
            case StatusEffectConst.bleeding: {
               const ticksElapsed = statusEffectComponent.ticksElapsed[StatusEffectConst.bleeding];
               if (customTickIntervalHasPassed(ticksElapsed, 1)) {
                  damageEntity(entity, 1, 0, null, null, PlayerCauseOfDeath.bloodloss, 0);
               }
               break;
            }
         }
      }
   }
}