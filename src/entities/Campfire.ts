import { InventoryData, Point } from "webgl-test-shared";
import Entity from "./Entity";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent, { serializeInventoryData } from "../entity-components/InventoryComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

class Campfire extends Entity {
   private static readonly MAX_HEALTH = 25;
   
   private static readonly SIZE = 40;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      const inventoryComponent = new InventoryComponent()
      
      super(position, {
         health: new HealthComponent(Campfire.MAX_HEALTH, false),
         inventory: inventoryComponent
      }, "campfire", isNaturallySpawned);

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: Campfire.SIZE / 2,
            height: Campfire.SIZE / 2
         })
      ]);

      inventoryComponent.createNewInventory("inventory", 1, 1, false);
   }

   public getClientArgs(): [inventory: InventoryData] {
      return [serializeInventoryData(this, this.getComponent("inventory")!.getInventory("inventory"), "inventory")];
   }
}

export default Campfire;