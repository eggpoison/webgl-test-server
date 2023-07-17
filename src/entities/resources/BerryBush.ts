import { Point, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

class BerryBush extends Entity {
   private static readonly HEALTH = 10;

   private static readonly RADIUS = 40;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(BerryBush.HEALTH, false),
         item_creation: itemCreationComponent
      }, "berry_bush");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: BerryBush.RADIUS
         })
      ]);

      itemCreationComponent.createItemOnDeath("berry", randInt(3, 5));

      this.setIsStatic(true);
      
      this.rotation = Math.PI * 2 * Math.random();
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default BerryBush;