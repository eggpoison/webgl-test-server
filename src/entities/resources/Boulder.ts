import { ItemType, Point, randInt } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";

class Boulder extends Entity {
   private static readonly RADIUS = 40;

   private static readonly MAX_HEALTH = 40;

   private readonly boulderType: number;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent(48);

      super(position, {
         health: new HealthComponent(Boulder.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "boulder");

      const hitbox = new CircularHitbox();
      hitbox.radius = Boulder.RADIUS;
      this.addHitbox(hitbox);

      this.boulderType = Math.floor(Math.random() * 2);

      const rockDropCount = randInt(3, 7);
      itemCreationComponent.createItemOnDeath(ItemType.rock, rockDropCount, true);

      this.isStatic = true;
      
      this.rotation = 2 * Math.PI * Math.random();
   }

   public getClientArgs(): [boulderType: number] {
      return [this.boulderType];
   }
}

export default Boulder;