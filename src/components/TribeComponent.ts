import { IEntityType, TribeComponentData, assertUnreachable } from "webgl-test-shared";
import Tribe from "../Tribe";
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
      case IEntityType.furnace:
      case IEntityType.barrel:
      case IEntityType.workbench:
      case IEntityType.planterBox:
      case IEntityType.researchBench:
      case IEntityType.campfire: {
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
      // Hostile mobs
      case IEntityType.yeti:
      case IEntityType.frozenYeti:
      case IEntityType.zombie:
      case IEntityType.slime:
      case IEntityType.golem:
      case IEntityType.pebblum: {
         return EntityRelationship.hostileMob;
      }
      case IEntityType.boulder:
      case IEntityType.cactus:
      case IEntityType.iceSpikes:
      case IEntityType.berryBush:
      case IEntityType.tree: {
         return EntityRelationship.resource;
      }
      case IEntityType.cow:
      case IEntityType.fish:
      case IEntityType.iceShardProjectile:
      case IEntityType.itemEntity:
      case IEntityType.krumblid:
      case IEntityType.rockSpikeProjectile:
      case IEntityType.slimeSpit:
      case IEntityType.slimewisp:
      case IEntityType.snowball:
      case IEntityType.spearProjectile:
      case IEntityType.spitPoison:
      case IEntityType.tombstone:
      case IEntityType.battleaxeProjectile: {
         return EntityRelationship.neutral;
      }
      default: {
         assertUnreachable(entity.type);
      }
   }
}

export function serialiseTribeComponent(entity: Entity): TribeComponentData {
   const tribeComponent = TribeComponentArray.getComponent(entity.id);
   return {
      tribeID: tribeComponent.tribe.id
   };
}