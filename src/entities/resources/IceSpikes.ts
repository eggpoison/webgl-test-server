import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, ItemType, PlayerCauseOfDeath, Point, ProjectileType, SETTINGS, StatusEffectConst, TileTypeConst, randFloat, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Projectile from "../../Projectile";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Board from "../../Board";

class IceSpikes extends Entity {
   private static readonly RADIUS = 40;

   private static readonly MAX_HEALTH = 5;

   private static readonly CONTACT_DAMAGE = 1;
   private static readonly CONTACT_KNOCKBACK = 180;

   private static readonly TICKS_TO_GROW = 1/5 * SETTINGS.TPS;
   private static readonly GROWTH_TICK_CHANCE = 0.5;
   private static readonly GROWTH_OFFSET = 60;

   private static readonly ICE_SHARD_DAMAGE = 2;
   private static readonly ICE_SHARD_EXPLODE_SPEED = 700;

   public readonly mass = 1;

   private readonly maxChildren = randInt(0, 3);

   public numChildrenIceSpikes = 0;
   private iceSpikeGrowProgress = 0;

   private readonly rootIceSpike: IceSpikes;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point, rootIceSpike?: IceSpikes) {
      const itemCreationComponent = new ItemCreationComponent(48);

      super(position, {
         health: new HealthComponent(IceSpikes.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, EntityTypeConst.ice_spikes);
      
      this.rotation = 2 * Math.PI * Math.random();

      if (typeof rootIceSpike !== "undefined") {
         this.rootIceSpike = rootIceSpike;
      } else {
         this.rootIceSpike = this;
      }

      const hitbox = new CircularHitbox(this, 0, 0, IceSpikes.RADIUS);
      this.addHitbox(hitbox);

      itemCreationComponent.createItemOnDeath(ItemType.frostcicle, randInt(0, 1), false);

      this.isStatic = true;

      this.createEvent("death", () => {
         this.explode();
      });

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (collidingEntity.type === EntityTypeConst.yeti || collidingEntity.type === EntityTypeConst.ice_spikes || collidingEntity.type === EntityTypeConst.snowball) {
            return;
         }
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            
            healthComponent.damage(IceSpikes.CONTACT_DAMAGE, IceSpikes.CONTACT_KNOCKBACK, hitDirection, this, PlayerCauseOfDeath.ice_spikes, 0, "ice_spikes");
            healthComponent.addLocalInvulnerabilityHash("ice_spikes", 0.3);

            collidingEntity.applyStatusEffect(StatusEffectConst.freezing, 5 * SETTINGS.TPS);
         }
      });
   }

   public tick(): void {
      super.tick();

      if (this.canGrow() && Math.random() < IceSpikes.GROWTH_TICK_CHANCE / SETTINGS.TPS) {
         this.iceSpikeGrowProgress++;
         if (this.iceSpikeGrowProgress >= IceSpikes.TICKS_TO_GROW) {
            this.grow();
         }
      }
   }

   private canGrow(): boolean {
      return this.rootIceSpike.numChildrenIceSpikes < this.rootIceSpike.maxChildren;
   }

   private grow(): void {
      // Calculate the spawn position for the new ice spikes
      const position = this.position.copy();
      const offsetDirection = 2 * Math.PI * Math.random();
      position.x += IceSpikes.GROWTH_OFFSET * Math.sin(offsetDirection);
      position.y += IceSpikes.GROWTH_OFFSET * Math.cos(offsetDirection);

      // Don't grow outside the board
      if (!Board.positionIsInBoard(position.x, position.y)) {
         return;
      }

      // Don't grow into rivers
      const tile = Board.getTileAtPosition(position);
      if (tile.type === TileTypeConst.water) {
         return;
      }

      const minDistanceToEntity = Board.distanceToClosestEntity(position);
      if (minDistanceToEntity >= 40) {
         new IceSpikes(position, this.rootIceSpike);
         
         this.rootIceSpike.numChildrenIceSpikes++;
      }
   }

   /** Causes frostcicle projectiles to fly out from the ice spike */
   private explode(): void {
      const numProjectiles = randInt(3, 4);

      for (let i = 1; i <= numProjectiles; i++) {
         const moveDirection = 2 * Math.PI * Math.random();
         
         const position = this.position.copy();
         position.x += 10 * Math.sin(moveDirection);
         position.y += 10 * Math.cos(moveDirection);

         const lifetime = randFloat(0.1, 0.2);
         const projectile = new Projectile(position, ProjectileType.iceShards, lifetime, 0);

         projectile.rotation = moveDirection;
         projectile.velocity.x = IceSpikes.ICE_SHARD_EXPLODE_SPEED * Math.sin(moveDirection);
         projectile.velocity.y = IceSpikes.ICE_SHARD_EXPLODE_SPEED * Math.cos(moveDirection);
         projectile.terminalVelocity = IceSpikes.ICE_SHARD_EXPLODE_SPEED;

         const hitbox = new RectangularHitbox(this, 0, 0, 24, 24);
         projectile.addHitbox(hitbox);

         projectile.createEvent("during_entity_collision", (collidingEntity: Entity) => {
            const healthComponent = collidingEntity.getComponent("health");
            if (healthComponent !== null) {
               if (collidingEntity.type === EntityTypeConst.ice_spikes) {
                  // Instantly destroy ice spikes
                  healthComponent.damage(99999, 0, 0, null, PlayerCauseOfDeath.ice_spikes, 0);
               } else {
                  const hitDirection = projectile.position.calculateAngleBetween(collidingEntity.position);
   
                  healthComponent.damage(IceSpikes.ICE_SHARD_DAMAGE, 150, hitDirection, null, PlayerCauseOfDeath.ice_shards, 0, "ice_shards");
                  healthComponent.addLocalInvulnerabilityHash("ice_shards", 0.3);

                  if (collidingEntity.type !== EntityTypeConst.yeti) {
                     collidingEntity.applyStatusEffect(StatusEffectConst.freezing, 3 * SETTINGS.TPS);
                  }
               }

               // Shatter the ice spike
               projectile.remove();
            }
         });
      }
   }

   public getClientArgs(): [] {
      return [];
   }

}

export default IceSpikes;