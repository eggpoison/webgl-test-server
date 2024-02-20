import { COLLISION_BITS, DEFAULT_COLLISION_MASK, GenericArrowType, IEntityType, PlayerCauseOfDeath, Point, SETTINGS } from "webgl-test-shared";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Entity from "../../Entity";
import { ArrowComponentArray, HealthComponentArray, PhysicsComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { applyHitKnockback, damageEntity } from "../../components/HealthComponent";
import { ArrowComponent, ArrowStatusEffectInfo } from "../../components/ArrowComponent";
import Board from "../../Board";
import { SERVER } from "../../server";
import { PhysicsComponent } from "../../components/PhysicsComponent";
import { EntityRelationship, TribeComponent, getTribeMemberRelationship } from "../../components/TribeComponent";
import { applyStatusEffect } from "../../components/StatusEffectComponent";

// @Cleanup: Rename file to something more generic

const ARROW_WIDTH = 12;
const ARROW_HEIGHT = 64;
// @Incomplete: Use width and height from generic arrow info
const ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(ARROW_WIDTH / 2, 2) + Math.pow(ARROW_HEIGHT, 2));

export interface GenericArrowInfo {
   readonly type: GenericArrowType;
   readonly damage: number;
   readonly knockback: number;
   readonly hitboxWidth: number;
   readonly hitboxHeight: number;
   readonly ignoreFriendlyBuildings: boolean;
   readonly statusEffect: ArrowStatusEffectInfo | null;
}

export function createWoodenArrow(position: Point, thrower: Entity, arrowInfo: GenericArrowInfo): Entity {
   const arrow = new Entity(position, IEntityType.woodenArrowProjectile, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   arrow.rotation = thrower.rotation;
   
   const hitbox = new RectangularHitbox(arrow, 0.5, 0, 0, arrowInfo.hitboxWidth, arrowInfo.hitboxHeight, 0);
   arrow.addHitbox(hitbox);

   const throwerTribeComponent = TribeComponentArray.getComponent(thrower);
   
   PhysicsComponentArray.addComponent(arrow, new PhysicsComponent(false));
   TribeComponentArray.addComponent(arrow, new TribeComponent(throwerTribeComponent.tribe));
   ArrowComponentArray.addComponent(arrow, new ArrowComponent(thrower.id, arrowInfo.type, arrowInfo.damage, arrowInfo.knockback, arrowInfo.ignoreFriendlyBuildings, arrowInfo.statusEffect));
   
   return arrow;
}

export function tickArrowProjectile(arrow: Entity): void {
   if (arrow.ageTicks >= 1.5 * SETTINGS.TPS) {
      arrow.remove();
      return;
   }
   
   // 
   // Air resistance
   // 

   const xSignBefore = Math.sign(arrow.velocity.x);
   
   const velocityLength = arrow.velocity.length();
   arrow.velocity.x = (velocityLength - 3) * arrow.velocity.x / velocityLength;
   arrow.velocity.y = (velocityLength - 3) * arrow.velocity.y / velocityLength;
   if (Math.sign(arrow.velocity.x) !== xSignBefore) {
      arrow.velocity.x = 0;
      arrow.velocity.y = 0;
   }
   
   // Destroy the arrow if it reaches the border
   if (arrow.position.x <= ARROW_DESTROY_DISTANCE || arrow.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - ARROW_DESTROY_DISTANCE || arrow.position.y <= ARROW_DESTROY_DISTANCE || arrow.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - ARROW_DESTROY_DISTANCE) {
      arrow.remove();
      return;
   }
}

export function onWoodenArrowCollision(arrow: Entity, collidingEntity: Entity): void {
   const arrowComponent = ArrowComponentArray.getComponent(arrow);
   const tribeComponent = TribeComponentArray.getComponent(arrow);

   // Ignore friendlies, and friendly buildings if the ignoreFriendlyBuildings flag is set
   const relationship = getTribeMemberRelationship(tribeComponent, collidingEntity);
   if (relationship === EntityRelationship.friendly || (arrowComponent.ignoreFriendlyBuildings && relationship === EntityRelationship.friendlyBuilding)) {
      return;
   }

   // Break without damaging friendly embrasures
   if (collidingEntity.type === IEntityType.woodenEmbrasure) {
      const collidingEntityTribeComponent = TribeComponentArray.getComponent(collidingEntity);
      if (tribeComponent.tribe === collidingEntityTribeComponent.tribe) {
         arrow.remove();
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

   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const arrowComponent = ArrowComponentArray.getComponent(arrow);

      const thrower = Board.entityRecord.hasOwnProperty(arrowComponent.throwerID) ? Board.entityRecord[arrowComponent.throwerID] : null;
      const hitDirection = arrow.position.calculateAngleBetween(collidingEntity.position);
      
      damageEntity(collidingEntity, arrowComponent.damage, thrower, PlayerCauseOfDeath.arrow);
      applyHitKnockback(collidingEntity, arrowComponent.knockback, hitDirection);
      SERVER.registerEntityHit({
         entityPositionX: collidingEntity.position.x,
         entityPositionY: collidingEntity.position.y,
         hitEntityID: collidingEntity.id,
         damage: arrowComponent.damage,
         knockback: arrowComponent.knockback,
         angleFromAttacker: hitDirection,
         attackerID: arrowComponent.throwerID,
         flags: 0
      });

      if (StatusEffectComponentArray.hasComponent(collidingEntity) && arrowComponent.statusEffect !== null) {
         applyStatusEffect(collidingEntity, arrowComponent.statusEffect.type, arrowComponent.statusEffect.durationTicks);
      }

      arrow.remove();
   }
}

export function onArrowRemove(arrow: Entity): void {
   PhysicsComponentArray.removeComponent(arrow);
   TribeComponentArray.removeComponent(arrow);
   ArrowComponentArray.removeComponent(arrow);
}