import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SETTINGS, StatusEffectConst } from "webgl-test-shared";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Entity from "../../Entity";
import { ArrowComponentArray, HealthComponentArray, PhysicsComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { EntityRelationship, getTribeMemberRelationship } from "../tribes/tribe-member";
import { ArrowComponent } from "../../components/ArrowComponent";
import Board from "../../Board";
import { applyStatusEffect } from "../../components/StatusEffectComponent";
import { PhysicsComponent } from "../../components/PhysicsComponent";

const ARROW_WIDTH = 5 * 4;
const ARROW_HEIGHT = 14 * 4;
const ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(ARROW_WIDTH / 2, 2) + Math.pow(ARROW_HEIGHT, 2));

export function createIceArrow(position: Point, tribeMember: Entity): Entity {
   const iceArrow = new Entity(position, IEntityType.iceArrow, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   iceArrow.rotation = tribeMember.rotation;
   
   const hitbox = new RectangularHitbox(iceArrow, 0.4, 0, 0, ARROW_WIDTH, ARROW_HEIGHT, 0);
   iceArrow.addHitbox(hitbox);
   
   PhysicsComponentArray.addComponent(iceArrow, new PhysicsComponent(false));
   ArrowComponentArray.addComponent(iceArrow, new ArrowComponent(tribeMember.id, ItemType.ice_bow));

   return iceArrow;
}

export function tickIceArrow(iceArrow: Entity): void {
   if (iceArrow.ageTicks >= 1.5 * SETTINGS.TPS) {
      iceArrow.remove();
      return;
   }
   
   // 
   // Air resistance
   // 

   const xSignBefore = Math.sign(iceArrow.velocity.x);
   
   const velocityLength = iceArrow.velocity.length();
   iceArrow.velocity.x = (velocityLength - 3) * iceArrow.velocity.x / velocityLength;
   iceArrow.velocity.y = (velocityLength - 3) * iceArrow.velocity.y / velocityLength;
   if (Math.sign(iceArrow.velocity.x) !== xSignBefore) {
      iceArrow.velocity.x = 0;
      iceArrow.velocity.y = 0;
   }
   
   // Destroy the arrow if it reaches the border
   if (iceArrow.position.x <= ARROW_DESTROY_DISTANCE || iceArrow.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - ARROW_DESTROY_DISTANCE || iceArrow.position.y <= ARROW_DESTROY_DISTANCE || iceArrow.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - ARROW_DESTROY_DISTANCE) {
      iceArrow.remove();
      return;
   }
}

export function onIceArrowCollision(arrow: Entity, collidingEntity: Entity): void {
   // Don't damage any friendly entities
   const arrowComponent = ArrowComponentArray.getComponent(arrow);
   if (Board.entityRecord.hasOwnProperty(arrowComponent.tribeMemberID) && getTribeMemberRelationship(Board.entityRecord[arrowComponent.tribeMemberID], collidingEntity) === EntityRelationship.friendly) {
      return;
   }
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
         applyStatusEffect(collidingEntity, StatusEffectConst.freezing, 3 * SETTINGS.TPS);
      }
      
      arrow.remove();
   }
}

export function onIceArrowRemove(arrow: Entity): void {
   PhysicsComponentArray.removeComponent(arrow);
   ArrowComponentArray.removeComponent(arrow);
}