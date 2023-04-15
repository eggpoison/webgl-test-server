import { FoodItemInfo, ItemType } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import StackableItem from "./StackableItem";

class FoodItem extends StackableItem implements FoodItemInfo {
   public readonly healAmount: number;
   public readonly eatTime: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: FoodItemInfo) {
      super(itemType, count, itemInfo);

      this.healAmount = itemInfo.healAmount;
      this.eatTime = itemInfo.eatTime;
   }

   public use(entity: Entity, inventoryName: string): void {
      const healthComponent = entity.getComponent("health")!;

      // Don't use food if already at maximum health
      if (healthComponent.getHealth() >= healthComponent.maxHealth) return;

      // Heal entity
      healthComponent.heal(this.healAmount);

      // Consume the item
      const inventoryComponent = entity.getComponent("inventory")!;
      this.consumeItem(inventoryComponent, inventoryName, 1);
   }
}

export default FoodItem;