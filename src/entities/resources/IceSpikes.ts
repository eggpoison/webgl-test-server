import { Point, Vector, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Projectile from "../../Projectile";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";

class IceSpikes extends Entity {
   private static readonly RADIUS = 40;

   private static readonly MAX_HEALTH = 5;

   private static readonly CONTACT_DAMAGE = 1;
   private static readonly CONTACT_KNOCKBACK = 180;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(IceSpikes.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "ice_spikes");

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
         this.shatter();
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

   /** Causes frostcicle projectiles to fly out from the ice spike */
   private shatter(): void {
      const numProjectiles = randInt(3, 4);

      for (let i = 1; i <= numProjectiles; i++) {
         const position = this.position.copy();
         const projectile = new Projectile(position, "ice_shards", 4);

         projectile.addHitboxes([
            new RectangularHitbox({
               type: "rectangular",
               width: 24,
               height: 24
            })
         ]);

         const velocity = new Vector(1000, Math.random() * 2 * Math.PI);
         projectile.velocity = velocity;
      }
   }

   public getClientArgs(): [] {
      return [];
   }

}

export default IceSpikes;