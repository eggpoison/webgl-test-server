import { Point, randInt } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";

class Boulder extends Entity {
   private static readonly RADIUS = 40;

   private static readonly MAX_HEALTH = 40;

   private readonly boulderType: number;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Boulder.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "boulder");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Boulder.RADIUS
         })
      ]);

      this.boulderType = Math.floor(Math.random() * 2);

      const rockDropCount = randInt(3, 7);
      itemCreationComponent.createItemOnDeath("rock", rockDropCount);

      this.setIsStatic(true);
      
      this.rotation = 2 * Math.PI * Math.random();
   }

   public getClientArgs(): [boulderType: number] {
      return [this.boulderType];
   }

}

export default Boulder;