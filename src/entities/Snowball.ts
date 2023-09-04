import { ParticleType, Point, SETTINGS, SNOWBALL_SIZES, SnowballSize, Vector, randFloat, randInt, randSign } from "webgl-test-shared";
import Entity from "./Entity";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Board from "../Board";
import Particle from "../Particle";
import MonocolourParticle from "../MonocolourParticle";

class Snowball extends Entity {
   private static readonly CASCADE_THRESHOLD = 100;
   
   private static readonly LIFETIME = [10, 15] as const;
   
   private static readonly MAX_HEALTHS: Record<SnowballSize, number> = {
      [SnowballSize.small]: 5,
      [SnowballSize.large]: 10
   }

   private readonly size: SnowballSize;

   private age = 0;
   private readonly lifetime = randFloat(...Snowball.LIFETIME);

   private angularVelocity = randFloat(1, 2) * Math.PI * randSign();

   public canDamage = true;

   constructor(position: Point, isNaturallySpawned: boolean, size: SnowballSize = SnowballSize.small) {
      super(position, {
         health: new HealthComponent(Snowball.MAX_HEALTHS[size], false)
      }, "snowball", isNaturallySpawned);

      this.size = size;

      if (this.size === SnowballSize.small) {
         this.mass = 1;
      } else {
         this.mass = 1.5;
      }

      const hitboxSize = SNOWBALL_SIZES[size];
      
      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(hitboxSize / 2);
      this.addHitbox(hitbox);

      this.rotation = 2 * Math.PI * Math.random();
   }

   public tick(): void {
      super.tick();

      // Angular velocity
      this.rotation += this.angularVelocity / SETTINGS.TPS;
      if (this.angularVelocity !== 0) {
         const beforeSign = Math.sign(this.angularVelocity);
         this.angularVelocity -= Math.PI / SETTINGS.TPS * beforeSign;
         if (beforeSign !== Math.sign(this.angularVelocity)) {
            this.angularVelocity = 0;
         }
      }

      this.age += 1 / SETTINGS.TPS;
      if (this.age >= this.lifetime) {
         this.remove();
      }

      if (this.velocity !== null && this.canDamage && this.velocity.magnitude <= Snowball.CASCADE_THRESHOLD) {
         this.canDamage = false;
      }

      if (this.canDamage) {
         if (Board.tickIntervalHasPassed(0.05)) {
            this.createSnowParticle();
         }
      }
   }

   private createSnowParticle(): void {
      const lifetime = randFloat(0.6, 0.8);
      
      new MonocolourParticle({
         type: ParticleType.snow,
         spawnPosition: this.position.copy(),
         initialVelocity: new Vector(randFloat(40, 60), 2 * Math.PI * Math.random()),
         initialAcceleration: null,
         initialRotation: 2 * Math.PI * Math.random(),
         opacity: (age: number): number => {
            return 1 - age / lifetime;
         },
         lifetime: lifetime,
         scale: randInt(1, 2)
      });
   }

   public getClientArgs(): [size: SnowballSize] {
      return [this.size];
   }
}

export default Snowball;