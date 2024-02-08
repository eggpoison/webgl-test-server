import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, PlayerCauseOfDeath, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, PhysicsComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { PhysicsComponent } from "../../components/PhysicsComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Tribe from "../../Tribe";
import { EntityRelationship, TribeComponent, getTribeMemberRelationship } from "../../components/TribeComponent";
import { applyHitKnockback, damageEntity } from "../../components/HealthComponent";
import { SERVER } from "../../server";

export function createSlingRock(position: Point, tribe: Tribe | null): Entity {
   const rock = new Entity(position, IEntityType.slingRock, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   rock.addHitbox(new CircularHitbox(rock, 0.3, 0, 0, 20, 0));
   
   PhysicsComponentArray.addComponent(rock, new PhysicsComponent(true));
   TribeComponentArray.addComponent(rock, new TribeComponent(tribe));
   
   return rock;
}

export function tickSlingRock(rock: Entity): void {
   if (rock.velocity.lengthSquared() < 100 * 100) {
      rock.remove();
   }
}

export function onSlingRockCollision(rock: Entity, collidingEntity: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(rock);
   
   // Don't damage any friendly entities
   if (getTribeMemberRelationship(tribeComponent, collidingEntity) <= EntityRelationship.friendlyBuilding) {
      return;
   }

   // Break without damaging friendly embrasures
   if (collidingEntity.type === IEntityType.woodenEmbrasure) {
      const collidingEntityTribeComponent = TribeComponentArray.getComponent(collidingEntity);
      if (tribeComponent.tribe === collidingEntityTribeComponent.tribe) {
         rock.remove();
         return;
      }
   }

   // Pass over friendly spikes
   if (collidingEntity.type === IEntityType.woodenFloorSpikes || collidingEntity.type === IEntityType.woodenWallSpikes || collidingEntity.type === IEntityType.floorPunjiSticks || collidingEntity.type === IEntityType.wallPunjiSticks) {
      const collidingEntityTribeComponent = TribeComponentArray.getComponent(collidingEntity);
      if (tribeComponent.tribe !== null && tribeComponent.tribe === collidingEntityTribeComponent.tribe) {
         return;
      }
   }

   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }
   
   const hitDirection = rock.position.calculateAngleBetween(collidingEntity.position);
   
   // @Incomplete: Attacking entity should be the turret which threw the rock
   // @Incomplete: cause of death
   damageEntity(collidingEntity, 2, rock, PlayerCauseOfDeath.arrow);
   applyHitKnockback(collidingEntity, 75, hitDirection);
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: 2,
      knockback: 75,
      angleFromAttacker: hitDirection,
      attackerID: rock.id,
      flags: 0
   });

   rock.remove();
}

export function onSlingRockRemove(rock: Entity): void {
   PhysicsComponentArray.removeComponent(rock);
   TribeComponentArray.removeComponent(rock);
}