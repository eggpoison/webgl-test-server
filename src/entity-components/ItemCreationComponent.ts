import { ItemType, Vector } from "webgl-test-shared";
import { createItem } from "../items/item-creation";
import ItemEntity from "../items/ItemEntity";
import Component from "./Component";

class ItemCreationComponent extends Component {
   /** Max units that an item can spawn away from the entity when dead */
   private static readonly ITEM_SPAWN_RANGE = 48;

   public createItemOnDeath(itemType: ItemType, count: number): void {
      this.entity.createEvent("death", () => {
         for (let i = 0; i < count; i++) {
            const magnitude = Math.random() * ItemCreationComponent.ITEM_SPAWN_RANGE;
            const direction = 2 * Math.PI * Math.random();

            const position = this.entity.position.copy();
            position.add(new Vector(magnitude, direction).convertToPoint());

            const item = createItem(itemType, 1);
            new ItemEntity(position, item);
         }
      });
   }
}

export default ItemCreationComponent;