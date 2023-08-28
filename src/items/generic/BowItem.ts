import { ItemType, BowItemInfo, ProjectileType, Vector, ParticleType, randFloat, SETTINGS, PlayerCauseOfDeath } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";
import Mob from "../../entities/mobs/Mob";
import TribeMember from "../../entities/tribes/TribeMember";
import Projectile from "../../Projectile";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Board from "../../Board";
import Particle from "../../Particle";

class BowItem extends ToolItem implements BowItemInfo {
   private static readonly ARROW_WIDTH = 20;
   private static readonly ARROW_HEIGHT = 64;
   private static readonly ARROW_DESTROY_DISTANCE = Math.sqrt(Math.pow(BowItem.ARROW_WIDTH / 2, 2) + Math.pow(BowItem.ARROW_HEIGHT, 2));
   
   public readonly toolType: "bow";

   public readonly projectileDamage: number;
   public readonly projectileKnockback: number;
   public readonly projectileAttackCooldown: number;
   public readonly projectileSpeed: number;

   private cooldownTimer = 0;

   constructor(itemType: ItemType, count: number, itemInfo: BowItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
      this.projectileDamage = itemInfo.projectileDamage;
      this.projectileKnockback = itemInfo.projectileKnockback;
      this.projectileAttackCooldown = itemInfo.projectileAttackCooldown;
      this.projectileSpeed = itemInfo.projectileSpeed;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      // If the entity is a mob or a tribe member
      if (entityToAttack instanceof Mob || entityToAttack.hasOwnProperty("tribe")) {
         return this.damage;
      }
      return 1;
   }
   
   public tick(): void {
      if (this.cooldownTimer > 0) {
         this.cooldownTimer -= 1 / SETTINGS.TPS;
         if (this.cooldownTimer < 0) {
            this.cooldownTimer = 0;
         }
      }
   }

   private canFire(): boolean {
      return this.cooldownTimer === 0;
   }

   public use?(entity: TribeMember, inventoryName: string): void {
      if (!this.canFire()) {
         return;
      }

      this.cooldownTimer = this.projectileAttackCooldown;

      const spawnPosition = entity.position.copy();
      const offset = new Vector(25, entity.rotation).convertToPoint();
      spawnPosition.add(offset);
      
      const arrowProjectile = new Projectile(spawnPosition, ProjectileType.woodenArrow, 1.5);
      arrowProjectile.velocity = new Vector(this.projectileSpeed, entity.rotation);
      arrowProjectile.rotation = entity.rotation;

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(BowItem.ARROW_WIDTH, BowItem.ARROW_HEIGHT);
      arrowProjectile.addHitbox(hitbox);

      arrowProjectile.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (arrowProjectile.isRemoved) {
            return;
         }
         
         // Don't damage any friendly entities
         if (entity.entityIsFriendly(collidingEntity)) {
            return;
         }
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const attackHash = this.id.toString();

            if (!healthComponent.isInvulnerable(attackHash)) {
               arrowProjectile.remove();
            }
            
            const hitDirection = arrowProjectile.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(this.projectileDamage, this.projectileKnockback, hitDirection, entity, PlayerCauseOfDeath.arrow, attackHash);
            healthComponent.addLocalInvulnerabilityHash(attackHash, 0.3);
         }
      });

      arrowProjectile.tickCallback = (): void => {
         // Destroy the arrow if it reaches the border
         if (arrowProjectile.position.x <= BowItem.ARROW_DESTROY_DISTANCE || arrowProjectile.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - BowItem.ARROW_DESTROY_DISTANCE || arrowProjectile.position.y <= BowItem.ARROW_DESTROY_DISTANCE || arrowProjectile.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - BowItem.ARROW_DESTROY_DISTANCE) {
            arrowProjectile.remove();
            return;
         }
      }
   }
   
}

export default BowItem;