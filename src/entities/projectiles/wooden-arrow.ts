import { PlayerCauseOfDeath, Point, ProjectileType, SETTINGS } from "webgl-test-shared";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Entity from "../../GameObject";
import { HealthComponentArray } from "../../components/ComponentArray";
import { entityIsInvulnerable, damageEntity } from "../../components/HealthComponent";
import { EntityRelationship, getTribeMemberRelationship } from "../tribes/tribe-member";

const ARROW_WIDTH = 20;
const ARROW_HEIGHT = 64;
const ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(ARROW_WIDTH / 2, 2) + Math.pow(ARROW_HEIGHT, 2));

export function createWoodenArrow(position: Point, tribeMember: Entity): void {
   const arrowProjectile = new Projectile(position, ProjectileType.woodenArrow, 1.5, 0);
   arrowProjectile.velocity.x = itemInfo.projectileSpeed * Math.sin(tribeMember.rotation);
   arrowProjectile.velocity.y = itemInfo.projectileSpeed * Math.cos(tribeMember.rotation);
   arrowProjectile.rotation = tribeMember.rotation;

   const hitbox = new RectangularHitbox(arrowProjectile, 0, 0, ARROW_WIDTH, ARROW_HEIGHT);
   arrowProjectile.addHitbox(hitbox);

   arrowProjectile.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
      if (arrowProjectile.isRemoved) {
         return;
      }
      
      // Don't damage any friendly entities
      if (getTribeMemberRelationship(tribeMember, collidingEntity) === EntityRelationship.friendly) {
         return;
      }
      
      if (HealthComponentArray.hasComponent(collidingEntity)) {
         const healthComponent = HealthComponentArray.getComponent(collidingEntity);

         const attackHash = item.id.toString();
         if (!entityIsInvulnerable(healthComponent, attackHash)) {
            const hitDirection = arrowProjectile.position.calculateAngleBetween(collidingEntity.position);
            damageEntity(collidingEntity, itemInfo.projectileDamage, itemInfo.projectileKnockback, hitDirection, tribeMember, PlayerCauseOfDeath.arrow, 0, attackHash)

            arrowProjectile.remove();
         }
      }
   });

   // @Cleanup This is a shitty way of doing this (ideally shouldn't attach a listener), and can destroy the arrow too early
   // Also doesn't account for wall tiles
   arrowProjectile.tickCallback = (): void => {
      // 
      // Air resistance
      // 

      const xSignBefore = Math.sign(arrowProjectile.velocity.x);
      
      const velocityLength = arrowProjectile.velocity.length();
      arrowProjectile.velocity.x = (velocityLength - 3) * arrowProjectile.velocity.x / velocityLength;
      arrowProjectile.velocity.y = (velocityLength - 3) * arrowProjectile.velocity.y / velocityLength;
      if (Math.sign(arrowProjectile.velocity.x) !== xSignBefore) {
         arrowProjectile.velocity.x = 0;
         arrowProjectile.velocity.y = 0;
      }
      
      // Destroy the arrow if it reaches the border
      if (arrowProjectile.position.x <= ARROW_DESTROY_DISTANCE || arrowProjectile.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - ARROW_DESTROY_DISTANCE || arrowProjectile.position.y <= ARROW_DESTROY_DISTANCE || arrowProjectile.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - ARROW_DESTROY_DISTANCE) {
         arrowProjectile.remove();
         return;
      }
   }
}