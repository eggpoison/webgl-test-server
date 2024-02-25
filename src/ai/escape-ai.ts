import Board from "../Board";
import Entity from "../Entity";
import { EscapeAIComponentArray } from "../components/ComponentArray";

export function registerAttackingEntity(entity: Entity, attackingEntity: Entity): void {
   const escapeAIComponent = EscapeAIComponentArray.getComponent(entity.id);

   const idx = escapeAIComponent.attackingEntityIDs.indexOf(attackingEntity.id);
   if (idx === -1) {
      escapeAIComponent.attackingEntityIDs.push(attackingEntity.id);
      escapeAIComponent.attackEntityTicksSinceLastAttack.push(0);
   } else {
      escapeAIComponent.attackEntityTicksSinceLastAttack[idx] = 0;
   }
}

export function runFromAttackingEntity(entity: Entity, attackingEntity: Entity, acceleration: number): void {
   const direction = attackingEntity.position.calculateAngleBetween(entity.position);
   entity.acceleration.x = acceleration * Math.sin(direction);
   entity.acceleration.y = acceleration * Math.cos(direction);
   if (direction !== entity.rotation) {
      entity.hitboxesAreDirty = true;
   }
   entity.rotation = direction;
}

export function chooseEscapeEntity(entity: Entity, visibleEntities: ReadonlyArray<Entity>): Entity | null {
   const escapeAIComponent = EscapeAIComponentArray.getComponent(entity.id);
   
   let minDistance = Number.MAX_SAFE_INTEGER;
   let escapeEntity: Entity | null = null;
   for (let i = 0; i < escapeAIComponent.attackingEntityIDs.length; i++) {
      const attackingEntity = Board.entityRecord[escapeAIComponent.attackingEntityIDs[i]];

      // Don't escape from entities which aren't visible
      if (!visibleEntities.includes(attackingEntity)) {
         continue;
      }

      const distance = entity.position.calculateDistanceBetween(attackingEntity.position);
      if (distance < minDistance) {
         minDistance = distance;
         escapeEntity = attackingEntity;
      }
   }

   return escapeEntity;
}