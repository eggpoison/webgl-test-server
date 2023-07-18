import { Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import ItemEntity from "../../items/ItemEntity";
import { createItem } from "../../items/item-creation";

class BerryBush extends Entity {
   private static readonly HEALTH = 10;

   private static readonly RADIUS = 40;

   private static readonly BERRY_DROP_OFFSET = 30;
   private static readonly BERRY_DROP_VELOCITY = 40;

   /** Number of seconds it takes for a berry bush to regrow one of its berries */
   private static readonly BERRY_GROW_TIME = 30;

   private numBerries = 5;

   private berryGrowTimer = 0;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(BerryBush.HEALTH, false)
      }, "berry_bush");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: BerryBush.RADIUS
         })
      ]);

      this.createEvent("hurt", () => {
         // Reset berry growth
         this.berryGrowTimer = 0;

         if (this.numBerries > 0) {
            this.numBerries--;
            this.dropBerry();
         }
      });

      this.setIsStatic(true);
      
      this.rotation = 2 * Math.PI * Math.random();
   }

   public tick(): void {
      super.tick();

      if (this.numBerries < 5) {
         this.berryGrowTimer += 1 / SETTINGS.TPS;
         if (this.berryGrowTimer >= BerryBush.BERRY_GROW_TIME) {
            this.berryGrowTimer = 0;
            this.growBerry();
         }
      }
   }

   public getClientArgs(): [numBerries: number] {
      return [this.numBerries];
   }

   private growBerry(): void {
      this.numBerries++;
   }

   private dropBerry(): void {
      const berry = createItem("berry", 1);

      const spawnDirection = 2 * Math.PI * Math.random();
      
      const spawnOffset = new Vector(BerryBush.BERRY_DROP_OFFSET, spawnDirection).convertToPoint();
      const position = this.position.copy();
      position.add(spawnOffset);

      const itemEntity = new ItemEntity(position, berry);
      
      const velocityDirectionOffset = (Math.random() - 0.5) * Math.PI * 0.15
      itemEntity.velocity = new Vector(BerryBush.BERRY_DROP_VELOCITY, spawnDirection + velocityDirectionOffset);
   }
}

export default BerryBush;