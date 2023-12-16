import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, ItemType, Point, randInt } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";

class Boulder extends Entity {
   private static readonly RADIUS = 40;

   private static readonly MAX_HEALTH = 40;

   private readonly boulderType: number;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent(48);

      super(position, {
         health: new HealthComponent(Boulder.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, EntityTypeConst.boulder);
      
      this.rotation = 2 * Math.PI * Math.random();

      const hitbox = new CircularHitbox(this, 0, 0, Boulder.RADIUS);
      this.addHitbox(hitbox);

      this.boulderType = Math.floor(Math.random() * 2);

      itemCreationComponent.createItemOnDeath(ItemType.rock, randInt(3, 7), true);

      this.isStatic = true;
   }

   public getClientArgs(): [boulderType: number] {
      return [this.boulderType];
   }
}

export default Boulder;