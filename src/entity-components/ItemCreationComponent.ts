import { ItemID, Vector } from "webgl-test-shared";
import Item from "../items/Item";
import ItemEntity from "../items/ItemEntity";
import Component from "./Component";

class ItemCreationComponent extends Component {
   /** Max units that an item can spawn away from the entity when dead */
   private static readonly ITEM_SPAWN_RANGE = 48;

   public createItemOnDeath(itemID: ItemID, count: number): void {
      this.entity.createEvent("death", () => {
         for (let i = 0; i < count; i++) {
            const magnitude = Math.random() * ItemCreationComponent.ITEM_SPAWN_RANGE;
            const direction = 2 * Math.PI * Math.random();
            const position = this.entity.position.add(new Vector(magnitude, direction).convertToPoint());

            const item = new Item(itemID, 1);
            new ItemEntity(position, item);
         }
      });
   }
}

export default ItemCreationComponent;