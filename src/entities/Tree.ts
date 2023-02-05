import { Point, randInt, TreeSize } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Entity from "./Entity";

class Tree extends Entity {
   private static readonly MAX_HEALTH = 10;

   private static readonly KNOCKBACK_MULTIPLIER = 0.3;

   /** Amount of wood created by the tree when it is killed */
   private static readonly WOOD_DROP_AMOUNT_RECORD: { [T in TreeSize]: [number, number]} = {
      [TreeSize.small]: [1, 2],
      [TreeSize.large]: [3, 5]
   }

   private readonly size: TreeSize;
   
   constructor(position: Point) {
      const size = randInt(0, 2) >= 1 ? 1 : 0;

      super(position, {
         health: new HealthComponent(Tree.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "tree");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 40 + size * 10
         })
      ]);

      this.setIsStatic(true);

      this.getComponent("health")!.setKnockbackMultiplier(Tree.KNOCKBACK_MULTIPLIER);

      this.getComponent("item_creation")!.createItemOnDeath("wood", randInt(...Tree.WOOD_DROP_AMOUNT_RECORD[size]));
      
      this.rotation = Math.PI * 2 * Math.random();

      this.size = size;
   }

   public getClientArgs(): [treeSize: TreeSize] {
      return [this.size];
   }
}

export default Tree;