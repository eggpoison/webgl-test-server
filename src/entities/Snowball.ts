import { COLLISION_BITS, DEFAULT_COLLISION_MASK, Point, SETTINGS, SNOWBALL_SIZES, SnowballSize, randFloat, randSign } from "webgl-test-shared";
import Entity from "./Entity";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";

class Snowball extends Entity {
   private static readonly CASCADE_THRESHOLD = 100;
   
   private static readonly LIFETIME = [10, 15] as const;
   
   private static readonly MAX_HEALTHS: Record<SnowballSize, number> = {
      [SnowballSize.small]: 5,
      [SnowballSize.large]: 10
   };

   private readonly size: SnowballSize;

   private age = 0;
   private readonly lifetime = randFloat(...Snowball.LIFETIME);

   private angularVelocity = randFloat(1, 2) * Math.PI * randSign();

   public canDamage = true;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point, size: SnowballSize = SnowballSize.small) {
      super(position, {
         health: new HealthComponent(Snowball.MAX_HEALTHS[size], false)
      }, "snowball");

      this.size = size;

      if (this.size === SnowballSize.small) {
         this.mass = 1;
      } else {
         this.mass = 1.5;
      }

      const hitbox = new CircularHitbox(SNOWBALL_SIZES[size], 0, 0);
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

      if ((this.velocity.x !== 0 || this.velocity.y !== 0) && this.canDamage && this.velocity.length() <= Snowball.CASCADE_THRESHOLD) {
         this.canDamage = false;
      }
   }

   public getClientArgs(): [size: SnowballSize] {
      return [this.size];
   }
}

export default Snowball;