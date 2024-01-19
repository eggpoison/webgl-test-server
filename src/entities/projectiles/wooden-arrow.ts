import { BowItemInfo, COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ITEM_INFO_RECORD, ItemType, PlayerCauseOfDeath, Point, SETTINGS } from "webgl-test-shared";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Entity from "../../Entity";
import { ArrowComponentArray, HealthComponentArray, PhysicsComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { applyHitKnockback, damageEntity } from "../../components/HealthComponent";
import { EntityRelationship, getTribeMemberRelationship } from "../tribes/tribe-member";
import { ArrowComponent } from "../../components/ArrowComponent";
import Board from "../../Board";
import { SERVER } from "../../server";
import { PhysicsComponent } from "../../components/PhysicsComponent";

const ARROW_WIDTH = 12;
const ARROW_HEIGHT = 64;
const ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(ARROW_WIDTH / 2, 2) + Math.pow(ARROW_HEIGHT, 2));

export function createWoodenArrow(position: Point, tribeMember: Entity, arrowType: ItemType): Entity {
   const arrow = new Entity(position, IEntityType.woodenArrowProjectile, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   arrow.rotation = tribeMember.rotation;
   
   const hitbox = new RectangularHitbox(arrow, 0.5, 0, 0, ARROW_WIDTH, ARROW_HEIGHT, 0);
   arrow.addHitbox(hitbox);
   
   PhysicsComponentArray.addComponent(arrow, new PhysicsComponent(false));
   ArrowComponentArray.addComponent(arrow, new ArrowComponent(tribeMember.id, arrowType));
   
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
   
   // Don't damage any friendly entities
   if (Board.entityRecord.hasOwnProperty(arrowComponent.tribeMemberID) && getTribeMemberRelationship(Board.entityRecord[arrowComponent.tribeMemberID], collidingEntity) === EntityRelationship.friendly) {
      return;
   }

   // Break without damaging friendly embrasures
   if (collidingEntity.type === IEntityType.woodenEmbrasure && Board.entityRecord.hasOwnProperty(arrowComponent.tribeMemberID)) {
      const shooter = Board.entityRecord[arrowComponent.tribeMemberID];
      const shooterTribeComponent = TribeComponentArray.getComponent(shooter);
      
      const collidingEntityTribeComponent = TribeComponentArray.getComponent(collidingEntity);
      if (shooterTribeComponent.tribe === collidingEntityTribeComponent.tribe) {
         arrow.remove();
         return;
      }
   }

   // Pass over friendly spikes
   if (collidingEntity.type === IEntityType.woodenFloorSpikes && Board.entityRecord.hasOwnProperty(arrowComponent.tribeMemberID)) {
      const shooter = Board.entityRecord[arrowComponent.tribeMemberID];
      const shooterTribeComponent = TribeComponentArray.getComponent(shooter);
      
      const collidingEntityTribeComponent = TribeComponentArray.getComponent(collidingEntity);
      if (shooterTribeComponent.tribe !== null && shooterTribeComponent.tribe === collidingEntityTribeComponent.tribe) {
         return;
      }
   }

   if (HealthComponentArray.hasComponent(collidingEntity)) {
      const arrowComponent = ArrowComponentArray.getComponent(arrow);

      const itemInfo = ITEM_INFO_RECORD[arrowComponent.bowType] as BowItemInfo;
      const thrower = Board.entityRecord.hasOwnProperty(arrowComponent.tribeMemberID) ? Board.entityRecord[arrowComponent.tribeMemberID] : null;
      const hitDirection = arrow.position.calculateAngleBetween(collidingEntity.position);
      
      damageEntity(collidingEntity, itemInfo.projectileDamage, thrower, PlayerCauseOfDeath.arrow);
      applyHitKnockback(collidingEntity, itemInfo.projectileKnockback, hitDirection);
      SERVER.registerEntityHit({
         entityPositionX: collidingEntity.position.x,
         entityPositionY: collidingEntity.position.y,
         hitEntityID: collidingEntity.id,
         damage: itemInfo.projectileDamage,
         knockback: itemInfo.projectileKnockback,
         angleFromAttacker: hitDirection,
         attackerID: thrower !== null ? thrower.id : -1,
         flags: 0
      });

      arrow.remove();
   }
}

export function onArrowRemove(arrow: Entity): void {
   PhysicsComponentArray.removeComponent(arrow);
   ArrowComponentArray.removeComponent(arrow);
}