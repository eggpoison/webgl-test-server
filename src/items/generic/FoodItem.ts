import { FoodItemInfo, ItemType, ParticleType, Vector, randFloat } from "webgl-test-shared";
import StackableItem from "./StackableItem";
import Board from "../../Board";
import Particle from "../../Particle";
import TribeMember from "../../entities/tribes/TribeMember";

class FoodItem extends StackableItem implements FoodItemInfo {
   public readonly healAmount: number;
   public readonly eatTime: number;
   
   constructor(itemType: ItemType, count: number, itemInfo: FoodItemInfo) {
      super(itemType, count, itemInfo);

      this.healAmount = itemInfo.healAmount;
      this.eatTime = itemInfo.eatTime;
   }

   public duringUse(entity: TribeMember): void {
      if (Board.tickIntervalHasPassed(0.1)) {
         const spawnPosition = entity.position.copy();
         const offset = new Vector(16, entity.rotation).convertToPoint();
         spawnPosition.add(offset);
         
         const lifetime = 2;
         
         new Particle({
            type: ParticleType.white1x1,
            spawnPosition: spawnPosition,
            initialVelocity: new Vector(randFloat(20, 30), 2 * Math.PI * Math.random()),
            initialAcceleration: null,
            initialRotation: 2 * Math.PI * Math.random(),
            opacity: 1,
            lifetime: lifetime
         });
      }
   }

   public use(entity: TribeMember, inventoryName: string): void {
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