import { ParticleType, Point, Vector, randFloat, randInt } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Particle from "../../Particle";

class Boulder extends Entity {
   private static readonly RADIUS = 40;

   private static readonly MAX_HEALTH = 40;

   private readonly boulderType: number;

   constructor(position: Point, isNaturallySpawned: boolean) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Boulder.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "boulder", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Boulder.RADIUS
         })
      ]);

      this.boulderType = Math.floor(Math.random() * 2);

      const rockDropCount = randInt(3, 7);
      itemCreationComponent.createItemOnDeath("rock", rockDropCount);

      this.setIsStatic(true);
      
      this.rotation = 2 * Math.PI * Math.random();

      this.createEvent("hurt", (): void => {
         for (let i = 0; i < 2; i++) {
            this.createRockParticle("outer");
         }
      });
   
      this.createEvent("death", (): void => {
         const numRocks = randInt(4, 5);
         for (let i = 0; i < numRocks; i++) {
            this.createRockParticle("inner");
         }
      });
   }

private createRockParticle(type: "outer" | "inner"): void {
   const spawnPosition = this.position.copy();

   if (type === "outer") {
      const offset = new Vector(Boulder.RADIUS, 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);
   } else {
      const offset = new Vector(Boulder.RADIUS * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);
   }

   const lifetime = randFloat(0.3, 0.6);
   
   new Particle({
      type: Math.random() < 0.5 ? ParticleType.rock : ParticleType.rockLarge,
      spawnPosition: spawnPosition,
      initialVelocity: new Vector(randFloat(50, 70), 2 * Math.PI * Math.random()),
      initialAcceleration: null,
      initialRotation: 2 * Math.PI * Math.random(),
      angularVelocity: 2 * Math.PI * randFloat(-1, 1),
      angularDrag: 1 * Math.PI,
      opacity: (age: number): number => {
         return 1 - age/lifetime;
      },
      lifetime: lifetime
   });
}

   public getClientArgs(): [boulderType: number] {
      return [this.boulderType];
   }
}

export default Boulder;