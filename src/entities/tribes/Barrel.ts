import { Point } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

class Barrel extends Entity {
   private static readonly MAX_HEALTH = 20;
   
   private static readonly RADIUS = 40;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Barrel.MAX_HEALTH, false)
      }, "barrel", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Barrel.RADIUS
         })
      ]);
   }
   
   public getClientArgs(): [] {
      return [];
   }
}

export default Barrel;