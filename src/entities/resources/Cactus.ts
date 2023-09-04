import { CactusBodyFlowerData, CactusFlowerSize, CactusLimbData, CactusLimbFlowerData, ItemType, ParticleType, PlayerCauseOfDeath, Point, Vector, lerp, randFloat, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Particle from "../../Particle";
import TexturedParticle from "../../TexturedParticle";

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
         height: lerp(10, Cactus.RADIUS - Cactus.LIMB_PADDING, Math.random()),
         size: randInt(0, 1),
         rotation: 2 * Math.PI * Math.random()
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
            height: randFloat(6, 10),
            direction: 2 * Math.PI * Math.random(),
            rotation: 2 * Math.PI * Math.random()
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
   private static readonly MAX_HEALTH = 15;

   public static readonly RADIUS = 40;

   /** Amount the hitbox is brought in. */
   private static readonly HITBOX_PADDING = 3;

   private static readonly CONTACT_DAMAGE = 1;
   private static readonly CONTACT_KNOCKBACK = 200;

   public static readonly LIMB_PADDING = 10;

   private static readonly FLOWER_PARTICLE_FADE_TIME = 1;

   private readonly flowers: ReadonlyArray<CactusBodyFlowerData>;
   private readonly limbs: ReadonlyArray<CactusLimbData>;

   constructor(position: Point, isNaturallySpawned: boolean) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Cactus.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "cactus", isNaturallySpawned);


      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(Cactus.RADIUS - Cactus.HITBOX_PADDING);
      this.addHitbox(hitbox);

      this.flowers = generateRandomFlowers();
      this.limbs = generateRandomLimbs();

      // Create hitboxes for all the cactus limbs
      for (const limb of this.limbs) {
         const offset = new Vector(37, limb.direction).convertToPoint();
         
         const hitbox = new CircularHitbox();
         hitbox.setHitboxInfo(18, offset);
         this.addHitbox(hitbox);
      }

      const spineDropCount = randInt(2, 5);
      itemCreationComponent.createItemOnDeath(ItemType.cactus_spine, spineDropCount, true);

      this.isStatic = true;
      
      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(Cactus.CONTACT_DAMAGE, Cactus.CONTACT_KNOCKBACK, hitDirection, this, PlayerCauseOfDeath.cactus, "cactus");
            healthComponent.addLocalInvulnerabilityHash("cactus", 0.3);
         }
      });

      this.createEvent("death", (): void => {
         this.createFlowerParticles();
      });
   }

   private createFlowerParticles(): void {
      for (const flower of this.flowers) {
         const flowerPosition = this.position.copy();
         const offsetDirection = flower.column * Math.PI / 4;
         const flowerOffset = new Vector(flower.height, offsetDirection).convertToPoint();
         flowerPosition.add(flowerOffset);

         this.createFlowerParticle(flowerPosition, flower.type, flower.size, flower.rotation);
      }

      for (const limb of this.limbs) {
         if (typeof limb.flower !== "undefined") {
            const limbPosition = this.position.copy();
            const offset = new Vector(Cactus.RADIUS, limb.direction).convertToPoint();
            limbPosition.add(offset);

            const flowerPosition = limbPosition.copy();
            const flowerOffset = new Vector(limb.flower.height, limb.flower.direction).convertToPoint();
            flowerPosition.add(flowerOffset);

            this.createFlowerParticle(flowerPosition, limb.flower.type, CactusFlowerSize.small, limb.flower.rotation);
         }
      }
   }

   private createFlowerParticle(spawnPosition: Point, flowerType: number, size: CactusFlowerSize, rotation: number): void {
      const particleType = this.getFlowerParticleType(flowerType, size);
      
      const lifetime = randFloat(3, 5);
      
      new TexturedParticle({
         type: particleType,
         spawnPosition: spawnPosition,
         initialVelocity: new Vector(randFloat(30, 50), 2 * Math.PI * Math.random()),
         drag: 75,
         initialAcceleration: null,
         initialRotation: rotation,
         angularVelocity: Math.PI * randFloat(-1, 1),
         angularDrag: 1.5 * Math.PI,
         opacity: (age: number): number => {
            if (age < lifetime - Cactus.FLOWER_PARTICLE_FADE_TIME) {
               return 1;
            } else {
               return lerp(1, 0, (age - (lifetime - Cactus.FLOWER_PARTICLE_FADE_TIME)) / Cactus.FLOWER_PARTICLE_FADE_TIME);
            }
         },
         lifetime: lifetime
      });
   }

   private getFlowerParticleType(flowerType: number, size: CactusFlowerSize): ParticleType {
      switch (flowerType) {
         case 0: {
            if (size === CactusFlowerSize.small) {
               return ParticleType.cactusFlower1;
            } else {
               return ParticleType.cactusFlower1_2;
            }
         }
         case 1: {
            if (size === CactusFlowerSize.small) {
               return ParticleType.cactusFlower2;
            } else {
               return ParticleType.cactusFlower2_2;
            }
         }
         case 2: {
            if (size === CactusFlowerSize.small) {
               return ParticleType.cactusFlower3;
            } else {
               return ParticleType.cactusFlower3_2;
            }
         }
         case 3: {
            if (size === CactusFlowerSize.small) {
               return ParticleType.cactusFlower4;
            } else {
               return ParticleType.cactusFlower4_2;
            }
         }
         case 4: {
            return ParticleType.cactusFlower5;
         }
         default: {
            throw new Error(`Unknown flower type '${flowerType}.`);
         }
      }
   }

   public getClientArgs(): [flowers: ReadonlyArray<CactusBodyFlowerData>, limbs: ReadonlyArray<CactusLimbData>] {
      return [this.flowers, this.limbs];
   }
}

export default Cactus;