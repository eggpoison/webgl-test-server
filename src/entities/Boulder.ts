import { Point, randInt } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";

class Boulder extends Entity {
   private static readonly WIDTH = 64;
   private static readonly HEIGHT = 64;

   private static readonly MAX_HEALTH = 40;

   private readonly boulderType: number;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Boulder.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "boulder");

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: Boulder.WIDTH,
            height: Boulder.HEIGHT
         })
      ]);

      this.boulderType = Math.floor(Math.random() * 2);

      const rockDropCount = randInt(3, 7);
      itemCreationComponent.createItemOnDeath("rock", rockDropCount);

      this.setIsStatic(true);
      
      this.rotation = Math.PI * 2 * Math.random();
   }

   public getClientArgs(): [boulderType: number] {
      return [this.boulderType];
   }

}

export default Boulder;