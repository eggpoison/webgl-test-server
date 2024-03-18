import { IEntityType, RESOURCE_ENTITY_TYPES_CONST, TribeComponentData } from "webgl-test-shared";
import Tribe from "../Tribe";
import { HOSTILE_MOB_TYPES } from "../entities/tribes/tribe-member";
import { TribeComponentArray } from "./ComponentArray";
import Entity from "../Entity";

// /** Relationships a tribe member can have, in increasing order of threat */
export const enum EntityRelationship {
   friendly = 1,
   friendlyBuilding = 2,
   neutral = 4,
   resource = 8,
   hostileMob = 16,
   enemyBuilding = 32,
   enemy = 64
}

export class TribeComponent {
   public readonly tribe: Tribe;

   constructor(tribe: Tribe) {
      this.tribe = tribe;
   }
}

export function getTribeMemberRelationship(tribeComponent: TribeComponent, entity: Entity): EntityRelationship {
   switch (entity.type) {
      // Buildings
      case IEntityType.wall:
      case IEntityType.door:
      case IEntityType.spikes:
      case IEntityType.punjiSticks:
      case IEntityType.embrasure:
      case IEntityType.ballista:
      case IEntityType.slingTurret:
      case IEntityType.blueprintEntity:
      case IEntityType.tunnel:
      case IEntityType.workerHut:
      case IEntityType.warriorHut:
      case IEntityType.tribeTotem:
      case IEntityType.barrel: {
         const entityTribeComponent = TribeComponentArray.getComponent(entity.id);
         if (entityTribeComponent.tribe === tribeComponent.tribe) {
            return EntityRelationship.friendlyBuilding;
         }
         return EntityRelationship.enemyBuilding;
      }
      // Friendlies
      case IEntityType.player:
      case IEntityType.tribeWorker:
      case IEntityType.tribeWarrior:
      case IEntityType.woodenArrowProjectile:
      case IEntityType.iceArrow: {
         const entityTribeComponent = TribeComponentArray.getComponent(entity.id);
         if (entityTribeComponent.tribe === tribeComponent.tribe) {
            return EntityRelationship.friendly;
         }
         return EntityRelationship.enemy;
      }
   }

   if (HOSTILE_MOB_TYPES.includes(entity.type)) {
      return EntityRelationship.hostileMob;
   }

   if (RESOURCE_ENTITY_TYPES_CONST.includes(entity.type)) {
      return EntityRelationship.resource;
   }

   return EntityRelationship.neutral;
}

export function serialiseTribeComponent(entity: Entity): TribeComponentData {
   const tribeComponent = TribeComponentArray.getComponent(entity.id);
   return {
      tribeID: tribeComponent.tribe.id
   };
}