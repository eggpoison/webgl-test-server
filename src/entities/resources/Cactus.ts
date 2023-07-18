import { CactusFlowerData, Point, randFloat, randInt, randItem } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const generateRandomFlowers = (): ReadonlyArray<CactusFlowerData> => {
   // Generate random number of flowers from 2 to 7, weighted low
   let numFlowers = 2;
   while (Math.random() < 0.5 && numFlowers < 7) {
      numFlowers++;
   }

   const flowers = new Array<CactusFlowerData>();

   for (let i = 0; i < numFlowers; i++) {
      flowers.push({
         type: randInt(0, 3),
         column: randInt(0, 7),
         height: randFloat(0.2, 0.6),
         size: randInt(0, 1)
      });
   }

   return flowers;
}

class Cactus extends Entity {
   private static readonly MAX_HEALTH = 25;

   private static readonly RADIUS = 40;

   /** Amount the hitbox is brought in. */
   private static readonly HITBOX_PADDING = 3;

   private static readonly CONTACT_DAMAGE = 1;
   private static readonly CONTACT_KNOCKBACK = 50;

   private readonly flowers: ReadonlyArray<CactusFlowerData>;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Cactus.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "cactus");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Cactus.RADIUS - Cactus.HITBOX_PADDING
         })
      ]);

      this.flowers = generateRandomFlowers();

      const spineDropCount = randInt(2, 5);
      itemCreationComponent.createItemOnDeath("cactus_spine", spineDropCount);

      this.setIsStatic(true);
      
      this.rotation = 2 * Math.PI * Math.random();

      this.createEvent("during_collision", (collidingEntity: Entity): void => {
         const direction = this.position.calculateAngleBetween(collidingEntity.position);
         collidingEntity.takeDamage(Cactus.CONTACT_DAMAGE, Cactus.CONTACT_KNOCKBACK, direction, this, "cactus");
      });
   }

   public getClientArgs(): [flowers: ReadonlyArray<CactusFlowerData>] {
      return [this.flowers];
   }
}

export default Cactus;