import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, SettingsConst, StatusEffectConst } from "webgl-test-shared";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Entity from "../../Entity";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { StatusEffectComponentArray, applyStatusEffect } from "../../components/StatusEffectComponent";
import { PhysicsComponent, PhysicsComponentArray } from "../../components/PhysicsComponent";
import { EntityRelationship, TribeComponent, getEntityRelationship } from "../../components/TribeComponent";
import Tribe from "../../Tribe";

const ARROW_WIDTH = 5 * 4;
const ARROW_HEIGHT = 14 * 4;
const ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(ARROW_WIDTH / 2, 2) + Math.pow(ARROW_HEIGHT, 2));

export function createIceArrow(position: Point, rotation: number, tribe: Tribe): Entity {
   const iceArrow = new Entity(position, IEntityType.iceArrow, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   iceArrow.rotation = rotation;
   
   const hitbox = new RectangularHitbox(iceArrow.position.x, iceArrow.position.y, 0.4, 0, 0, HitboxCollisionTypeConst.soft, iceArrow.getNextHitboxLocalID(), iceArrow.rotation, ARROW_WIDTH, ARROW_HEIGHT, 0);
   iceArrow.addHitbox(hitbox);
   
   PhysicsComponentArray.addComponent(iceArrow, new PhysicsComponent(false, true));
   TribeComponentArray.addComponent(iceArrow, new TribeComponent(tribe));

   return iceArrow;
}

export function tickIceArrow(iceArrow: Entity): void {
   if (iceArrow.ageTicks >= 1.5 * SettingsConst.TPS) {
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
   if (iceArrow.position.x <= ARROW_DESTROY_DISTANCE || iceArrow.position.x >= SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - ARROW_DESTROY_DISTANCE || iceArrow.position.y <= ARROW_DESTROY_DISTANCE || iceArrow.position.y >= SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - ARROW_DESTROY_DISTANCE) {
      iceArrow.remove();
      return;
   }
}

export function onIceArrowCollision(arrow: Entity, collidingEntity: Entity): void {
   // Don't damage any friendly entities
   const tribeComponent = TribeComponentArray.getComponent(arrow.id);
   if (getEntityRelationship(tribeComponent, collidingEntity) === EntityRelationship.friendly) {
      return;
   }
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      if (StatusEffectComponentArray.hasComponent(collidingEntity)) {
         applyStatusEffect(collidingEntity, StatusEffectConst.freezing, 3 * SettingsConst.TPS);
      }
      
      arrow.remove();
   }
}

export function onIceArrowRemove(arrow: Entity): void {
   PhysicsComponentArray.removeComponent(arrow);
   TribeComponentArray.removeComponent(arrow);
}