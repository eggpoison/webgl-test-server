import { GameObjectDebugData, Point } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Tribe from "../../Tribe";

class TribeTotem extends Entity {
   private static readonly MAX_HEALTH = 50;

   private static readonly RADIUS = 60;

   public tribe: Tribe | null = null;

   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(TribeTotem.MAX_HEALTH, false)
      }, "tribe_totem", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: TribeTotem.RADIUS
         })
      ]);

      this.isStatic = true;
   }

   public setTribe(tribe: Tribe | null): void {
      this.tribe = tribe;
   }

   public getClientArgs(): [] {
      return [];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      if (this.tribe !== null) {
         // Show the tribe's area
         for (const tile of this.tribe.getArea()) {
            debugData.tileHighlights.push({
               colour: [1, 0, 0],
               tilePosition: [tile.x, tile.y]
            });
         }
      }

      return debugData;
   }
}

export default TribeTotem;