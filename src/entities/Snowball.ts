import { Point, SETTINGS, SNOWBALL_SIZES, SnowballSize, randItem } from "webgl-test-shared";
import Entity from "./Entity";
import HealthComponent from "../entity-components/HealthComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";

class Snowball extends Entity {
   private static readonly LIFETIME = [10, 15] as const;
   
   private static readonly MAX_HEALTHS: Record<SnowballSize, number> = {
      [SnowballSize.small]: 5,
      [SnowballSize.large]: 10
   }
   
   private readonly size: SnowballSize;

   private age = 0;
   private readonly lifetime = randItem(Snowball.LIFETIME);

   constructor(position: Point, isNaturallySpawned: boolean, size: SnowballSize = SnowballSize.small) {
      super(position, {
         health: new HealthComponent(Snowball.MAX_HEALTHS[size], false)
      }, "snowball", isNaturallySpawned);

      this.size = size;

      const hitboxSize = SNOWBALL_SIZES[size];
      
      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: hitboxSize / 2
         })
      ]);

      this.rotation = 2 * Math.PI * Math.random();
   }

   public tick(): void {
      super.tick();

      this.age += 1 / SETTINGS.TPS;
      if (this.age >= this.lifetime) {
         this.remove();
      }
   }

   public getClientArgs(): [size: SnowballSize] {
      return [this.size];
   }
}

export default Snowball;