import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, PlayerCauseOfDeath, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { createItemEntity } from "../item-entity";
import { HealthComponentArray, SpearComponentArray } from "../../components/ComponentArray";
import { damageEntity } from "../../components/HealthComponent";
import { SpearComponent } from "../../components/SpearComponent";
import Board from "../../Board";

const DROP_VELOCITY = 400;

export function createSpearProjectile(position: Point, tribeMemberID: number): Entity {
   const spear = new Entity(position, IEntityType.spearProjectile, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(spear, 0, 0, 12, 60);
   spear.addHitbox(hitbox);

   SpearComponentArray.addComponent(spear, new SpearComponent(tribeMemberID));

   return spear;
}

export function tickSpearProjectile(spear: Entity): void {
   if (spear.velocity.lengthSquared() <= DROP_VELOCITY * DROP_VELOCITY) {
      createItemEntity(spear.position.copy(), ItemType.spear, 1);
      spear.remove();
   }
}

export function onSpearProjectileCollision(spear: Entity, collidingEntity: Entity): void {
   // Don't hurt the entity who threw the spear
   const spearComponent = SpearComponentArray.getComponent(spear);
   if (collidingEntity.id === spearComponent.tribeMemberID) {
      return;
   }
   
   if (HealthComponentArray.hasComponent(collidingEntity)) {
      let tribeMember: Entity | null = null;
      if (Board.entityRecord.hasOwnProperty(spearComponent.tribeMemberID)) {
         tribeMember = Board.entityRecord[spearComponent.tribeMemberID];
      }

      const damage = Math.floor(spear.velocity.length() / 120);
      
      // Damage the entity
      const direction = spear.position.calculateAngleBetween(collidingEntity.position);
      damageEntity(collidingEntity, damage, 150, direction, tribeMember, PlayerCauseOfDeath.spear, 0);
      
      spear.remove();
   }
}

export function onSpearProjectileRemove(spear: Entity): void {
   SpearComponentArray.removeComponent(spear);
}