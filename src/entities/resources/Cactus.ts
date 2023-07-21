import { CactusBodyFlowerData, CactusLimbData, CactusLimbFlowerData, Point, Vector, randFloat, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const generateRandomFlowers = (): ReadonlyArray<CactusBodyFlowerData> => {
   // Generate random number of flowers from 1 to 5, weighted low
   let numFlowers = 1;
   while (Math.random() < 0.35 && numFlowers < 5) {
      numFlowers++;
   }

   const flowers = new Array<CactusBodyFlowerData>();

   for (let i = 0; i < numFlowers; i++) {
      flowers.push({
         type: randInt(0, 4),
         column: randInt(0, 7),
         height: Math.random(),
         size: randInt(0, 1)
      });
   }

   return flowers;
}

const generateRandomLimbs = (): ReadonlyArray<CactusLimbData> => {
   // Low chance for 0 limbs
   // High chance for 1 limb
   // Less chance for 2 limbs
   // Less chance for 3 limbs, etc.
   let numLimbs = 0;
   while (Math.random() < 4/5 - numLimbs/5 && numLimbs < 3) {
      numLimbs++;
   }

   const limbs = new Array<CactusLimbData>();

   for (let i = 0; i < numLimbs; i++) {
      let flower: CactusLimbFlowerData | undefined;

      if (Math.random() < 0.45) {
         flower = {
            type: randInt(0, 3),
            height: randFloat(0, 1),
            direction: 2 * Math.PI * Math.random()
         }
      }

      limbs.push({
         direction: 2 * Math.PI * Math.random(),
         flower: flower
      });
   }

   return limbs;
}

class Cactus extends Entity {
   private static readonly MAX_HEALTH = 25;

   private static readonly RADIUS = 40;

   /** Amount the hitbox is brought in. */
   private static readonly HITBOX_PADDING = 3;

   private static readonly CONTACT_DAMAGE = 1;
   private static readonly CONTACT_KNOCKBACK = 200;

   private readonly flowers: ReadonlyArray<CactusBodyFlowerData>;
   private readonly limbs: ReadonlyArray<CactusLimbData>;

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
      this.limbs = generateRandomLimbs();

      // Create hitboxes for all the cactus limbs
      for (const limb of this.limbs) {
         const offset = new Vector(37, limb.direction).convertToPoint();
         
         this.addHitboxes([
            new CircularHitbox({
               type: "circular",
               radius: 18,
               offset: offset
            })
         ]);
      }

      const spineDropCount = randInt(2, 5);
      itemCreationComponent.createItemOnDeath("cactus_spine", spineDropCount);

      this.setIsStatic(true);
      
      // this.rotation = 2 * Math.PI * Math.random();

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(Cactus.CONTACT_DAMAGE, Cactus.CONTACT_KNOCKBACK, hitDirection, this, "cactus");
            healthComponent.addLocalInvulnerabilityHash("cactus", 0.3);
         }
      });
   }

   public getClientArgs(): [flowers: ReadonlyArray<CactusBodyFlowerData>, limbs: ReadonlyArray<CactusLimbData>] {
      return [this.flowers, this.limbs];
   }
}

export default Cactus;