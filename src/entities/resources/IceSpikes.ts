import { Point, SETTINGS, Vector, randFloat, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Projectile from "../../Projectile";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { SERVER } from "../../server";

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

   private readonly maxChildren = randInt(0, 3);

   public numChildrenIceSpikes = 0;
   private iceSpikeGrowProgress = 0;

   private readonly rootIceSpike: IceSpikes;

   constructor(position: Point, rootIceSpike?: IceSpikes) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(IceSpikes.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "ice_spikes");

      if (typeof rootIceSpike !== "undefined") {
         this.rootIceSpike = rootIceSpike;
      } else {
         this.rootIceSpike = this;
      }

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: IceSpikes.RADIUS
         })
      ]);

      itemCreationComponent.createItemOnDeath("frostcicle", randInt(1, 2));

      this.setIsStatic(true);
      
      this.rotation = 2 * Math.PI * Math.random();

      this.createEvent("death", () => {
         this.explode();
      });

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (collidingEntity.type !== "yeti" && collidingEntity.type !== "ice_spikes") {
            const healthComponent = collidingEntity.getComponent("health");
            if (healthComponent !== null) {
               const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
               
               healthComponent.damage(IceSpikes.CONTACT_DAMAGE, IceSpikes.CONTACT_KNOCKBACK, hitDirection, this, "ice_spikes");
               healthComponent.addLocalInvulnerabilityHash("ice_spikes", 0.3);
            }
         }
      })
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
      const position = this.position.copy();
      position.add(new Vector(IceSpikes.GROWTH_OFFSET, 2 * Math.PI * Math.random()).convertToPoint());

      const minDistanceToEntity = SERVER.board.distanceToClosestEntity(position);
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
         position.add(new Vector(10, moveDirection).convertToPoint());

         const lifetime = randFloat(0.1, 0.2);
         const projectile = new Projectile(position, "ice_shards", lifetime);

         projectile.rotation = moveDirection;

         const velocity = new Vector(IceSpikes.ICE_SHARD_EXPLODE_SPEED, moveDirection);
         projectile.velocity = velocity;
         projectile.terminalVelocity = IceSpikes.ICE_SHARD_EXPLODE_SPEED;

         projectile.addHitboxes([
            new RectangularHitbox({
               type: "rectangular",
               width: 24,
               height: 24
            })
         ]);

         projectile.createEvent("during_entity_collision", (collidingEntity: Entity) => {
            const healthComponent = collidingEntity.getComponent("health");
            if (healthComponent !== null) {
               if (collidingEntity.type === "ice_spikes") {
                  // Instantly destroy ice spikes
                  healthComponent.damage(99999, 0, 0, null);
               } else {
                  const hitDirection = projectile.position.calculateAngleBetween(collidingEntity.position);
   
                  healthComponent.damage(IceSpikes.ICE_SHARD_DAMAGE, 150, hitDirection, null, "ice_shards");
                  healthComponent.addLocalInvulnerabilityHash("ice_shards", 0.3);
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