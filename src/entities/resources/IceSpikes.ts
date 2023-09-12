import { ItemType, PlayerCauseOfDeath, Point, ProjectileType, SETTINGS, Vector, randFloat, randInt } from "webgl-test-shared";
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
   // private readonly maxChildren = 100;

   public numChildrenIceSpikes = 0;
   private iceSpikeGrowProgress = 0;

   private readonly rootIceSpike: IceSpikes;

   constructor(position: Point, isNaturallySpawned: boolean, rootIceSpike?: IceSpikes) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(IceSpikes.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "ice_spikes", isNaturallySpawned);

      if (typeof rootIceSpike !== "undefined") {
         this.rootIceSpike = rootIceSpike;
      } else {
         this.rootIceSpike = this;
      }

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(IceSpikes.RADIUS);
      this.addHitbox(hitbox);

      if (Object.keys(Board.droppedItems).length < 50) {
         itemCreationComponent.createItemOnDeath(ItemType.frostcicle, randInt(0, 1), false);
      }

      this.isStatic = true;
      
      this.rotation = 2 * Math.PI * Math.random();

      this.createEvent("death", () => {
         this.explode();
      });

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (collidingEntity.type === "yeti" || collidingEntity.type === "ice_spikes" || collidingEntity.type === "snowball") {
            return;
         }
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            
            healthComponent.damage(IceSpikes.CONTACT_DAMAGE, IceSpikes.CONTACT_KNOCKBACK, hitDirection, this, PlayerCauseOfDeath.ice_spikes, 0, "ice_spikes");
            healthComponent.addLocalInvulnerabilityHash("ice_spikes", 0.3);

            collidingEntity.applyStatusEffect("freezing", 5);
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
      position.add(new Vector(IceSpikes.GROWTH_OFFSET, 2 * Math.PI * Math.random()).convertToPoint());

      // Don't grow outside the board
      if (!Board.positionIsInBoard(position.x, position.y)) {
         return;
      }

      // Don't grow into rivers
      const tile = Board.getTileAtPosition(position);
      if (tile.type === "water") {
         return;
      }

      const minDistanceToEntity = Board.distanceToClosestEntity(position);
      if (minDistanceToEntity >= 40) {
         new IceSpikes(position, false, this.rootIceSpike);
         
         this.rootIceSpike.numChildrenIceSpikes++;
      }
   }

   /** Causes frostcicle projectiles to fly out from the ice spike */
   private explode(): void {
      const numProjectiles = randInt(3, 4);

      for (let i = 1; i <= numProjectiles; i++) {
         const moveDirection = 2 * Math.PI * Math.random();
         
         const position = this.position.copy();
         position.add(new Vector(10, moveDirection).convertToPoint());

         const lifetime = randFloat(0.1, 0.2);
         const projectile = new Projectile(position, ProjectileType.iceShards, lifetime);

         projectile.rotation = moveDirection;

         const velocity = new Vector(IceSpikes.ICE_SHARD_EXPLODE_SPEED, moveDirection);
         projectile.velocity = velocity;
         projectile.terminalVelocity = IceSpikes.ICE_SHARD_EXPLODE_SPEED;


         const hitbox = new RectangularHitbox();
         hitbox.setHitboxInfo(24, 24);
         projectile.addHitbox(hitbox);

         projectile.createEvent("during_entity_collision", (collidingEntity: Entity) => {
            const healthComponent = collidingEntity.getComponent("health");
            if (healthComponent !== null) {
               if (collidingEntity.type === "ice_spikes") {
                  // Instantly destroy ice spikes
                  healthComponent.damage(99999, 0, 0, null, PlayerCauseOfDeath.ice_spikes, 0);
               } else {
                  const hitDirection = projectile.position.calculateAngleBetween(collidingEntity.position);
   
                  healthComponent.damage(IceSpikes.ICE_SHARD_DAMAGE, 150, hitDirection, null, PlayerCauseOfDeath.ice_shards, 0, "ice_shards");
                  healthComponent.addLocalInvulnerabilityHash("ice_shards", 0.3);

                  if (collidingEntity.type !== "yeti") {
                     collidingEntity.applyStatusEffect("freezing", 3);
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