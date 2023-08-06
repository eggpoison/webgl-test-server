import { Point, TribeType } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import Tribe from "../../Tribe";
import CircularHitbox from "../../hitboxes/CircularHitbox";

class TribeTotem extends Entity {
   private static readonly MAX_HEALTH = 50;

   private static readonly RADIUS = 50;

   public readonly tribe: Tribe;
   
   constructor(position: Point, isNaturallySpawned: boolean, tribeType: TribeType) {
      super(position, {
         health: new HealthComponent(TribeTotem.MAX_HEALTH, false)
      }, "tribe_totem", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: TribeTotem.RADIUS
         })
      ]);

      this.tribe = new Tribe(tribeType);

      this.isStatic = true;
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default TribeTotem;