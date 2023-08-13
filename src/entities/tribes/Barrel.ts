import { InventoryData, ItemSlotsData, Point } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import InventoryComponent from "../../entity-components/InventoryComponent";
import Tribe from "../../Tribe";

class Barrel extends Entity {
   private static readonly INVENTORY_WIDTH = 3;
   private static readonly INVENTORY_HEIGHT = 3;
   
   private static readonly MAX_HEALTH = 20;
   
   private static readonly RADIUS = 40;

   public tribe: Tribe | null = null;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      const inventoryComponent = new InventoryComponent();
      
      super(position, {
         health: new HealthComponent(Barrel.MAX_HEALTH, false),
         inventory: inventoryComponent
      }, "barrel", isNaturallySpawned);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Barrel.RADIUS
         })
      ]);

      inventoryComponent.createNewInventory("inventory", Barrel.INVENTORY_WIDTH, Barrel.INVENTORY_HEIGHT, false);
   }

   public setTribe(tribe: Tribe | null): void {
      this.tribe = tribe;
   }
   
   public getClientArgs(): [tribeID: number | null, inventoryData: InventoryData] {
      const inventory = this.getComponent("inventory")!.getInventory("inventory");
      
      const itemSlots: ItemSlotsData = {};
      for (const [itemSlot, item] of Object.entries(inventory.itemSlots)) {
         itemSlots[Number(itemSlot)] = {
            type: item.type,
            count: item.count,
            id: item.id
         };
      }
      
      const inventoryData: InventoryData = {
         width: inventory.width,
         height: inventory.height,
         itemSlots: itemSlots,
         inventoryName: "inventory"
      };
      
      return [this.tribe !== null ? this.tribe.id : null, inventoryData];
   }
}

export default Barrel;