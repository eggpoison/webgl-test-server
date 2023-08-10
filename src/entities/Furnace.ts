import { InventoryData, Point } from "webgl-test-shared";
import Entity from "./Entity";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent, { serializeInventoryData } from "../entity-components/InventoryComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

class Furnace extends Entity {
   private static readonly MAX_HEALTH = 25;
   
   private static readonly SIZE = 40;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      const inventoryComponent = new InventoryComponent()
      
      super(position, {
         health: new HealthComponent(Furnace.MAX_HEALTH, false),
         inventory: inventoryComponent
      }, "furnace", isNaturallySpawned);

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: Furnace.SIZE / 2,
            height: Furnace.SIZE / 2
         })
      ]);

      inventoryComponent.createNewInventory("fuelSlot", 1, 1, false);
      inventoryComponent.createNewInventory("outputSlot", 1, 1, false);
   }

   public getClientArgs(): [fuelInventory: InventoryData, outputInventory: InventoryData] {
      const inventoryComponent = this.getComponent("inventory")!;
      return [
         serializeInventoryData(this, inventoryComponent.getInventory("fuelSlot"), "fuelSlot"),
         serializeInventoryData(this, inventoryComponent.getInventory("outputSlot"), "outputSlot")
      ];
   }
}

export default Furnace;