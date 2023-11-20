import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, ItemType, Point, randInt, TreeSize } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";

class Tree extends Entity {
   private static readonly MAX_HEALTH = 10;

   /** Amount of wood created by the tree when it is killed */
   private static readonly WOOD_DROP_AMOUNT_RECORD: { [T in TreeSize]: [number, number]} = {
      [TreeSize.small]: [2, 3],
      [TreeSize.large]: [4, 5]
   };

   private static readonly TREE_RADIUSES: Record<TreeSize, number> = {
      [TreeSize.small]: 40,
      [TreeSize.large]: 50
   };

   private readonly size: TreeSize;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;
   
   constructor(position: Point) {
      const size = randInt(0, 2) >= 1 ? 1 : 0;

      super(position, {
         health: new HealthComponent(Tree.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(48)
      }, EntityTypeConst.tree);

      const hitbox = new CircularHitbox(Tree.TREE_RADIUSES[size], 0, 0);
      this.addHitbox(hitbox);

      this.isStatic = true;

      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.wood, randInt(...Tree.WOOD_DROP_AMOUNT_RECORD[size]), true);
      
      this.rotation = Math.PI * 2 * Math.random();

      this.size = size;

      if (size === TreeSize.small) {
         this.mass = 1.25;
      } else {
         this.mass = 1.5;
      }
   }

   public getClientArgs(): [treeSize: TreeSize] {
      return [this.size];
   }
}

export default Tree;