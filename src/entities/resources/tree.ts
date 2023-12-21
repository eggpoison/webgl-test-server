import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, randInt } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, TreeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";

const TREE_MAX_HEALTH = 10;
const TREE_RADII: ReadonlyArray<number> = [40, 50];

const WOOD_DROP_AMOUNTS: ReadonlyArray<[number, number]> = [
   [2, 3],
   [4, 5]
];
export function createTree(position: Point): Entity {
   const size = Math.random() > 1/3 ? 1 : 0;

   const tree = new Entity(position, IEntityType.tree, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(tree, 0, 0, TREE_RADII[size]);
   tree.addHitbox(hitbox);

   HealthComponentArray.addComponent(tree, new HealthComponent(TREE_MAX_HEALTH));

   TreeComponentArray.addComponent(tree, {
      treeSize: size
   });

   tree.isStatic = true;
   tree.rotation = 2 * Math.PI * Math.random();

   return tree;
}

export function onTreeDeath(tree: Entity): void {
   const treeComponent = TreeComponentArray.getComponent(tree);
   createItemsOverEntity(tree, ItemType.wood, randInt(...WOOD_DROP_AMOUNTS[treeComponent.treeSize]));
}