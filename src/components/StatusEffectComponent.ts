import { STATUS_EFFECT_MODIFIERS, StatusEffectConst } from "webgl-test-shared";
import { StatusEffectComponentArray } from "./ComponentArray";
import Entity from "../GameObject";

export class StatusEffectComponent {
   readonly statusEffectTicksRemaining = [0, 0, 0, 0];
   readonly statusEffectTicksElapsed = [0, 0, 0, 0];
}

export function applyStatusEffect(entity: Entity, statusEffect: StatusEffectConst, durationTicks: number): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);
   if (!hasStatusEffect(statusEffectComponent, statusEffect)) {
      // New status effect
      
      statusEffectComponent.statusEffectTicksElapsed[statusEffect] = 0;
      statusEffectComponent.statusEffectTicksRemaining[statusEffect] = durationTicks;

      entity.moveSpeedMultiplier *= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
   } else {
      // Existing status effect

      if (durationTicks > statusEffectComponent.statusEffectTicksRemaining[statusEffect]) {
         statusEffectComponent.statusEffectTicksRemaining[statusEffect] = durationTicks;
      }
   }
}

export function hasStatusEffect(statusEffectComponent: StatusEffectComponent, statusEffect: StatusEffectConst): boolean {
   return statusEffectComponent.statusEffectTicksRemaining[statusEffect] > 0;
}

export function clearStatusEffect(entity: Entity, statusEffect: StatusEffectConst): void {
   const statusEffectComponent = StatusEffectComponentArray.getComponent(entity);
   statusEffectComponent.statusEffectTicksRemaining[statusEffect] = 0;
   entity.moveSpeedMultiplier /= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
}