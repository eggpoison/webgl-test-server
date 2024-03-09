import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, TreeComponentData, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, TreeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";

const TREE_MAX_HEALTHS = [10, 15];
const TREE_RADII: ReadonlyArray<number> = [40, 50];

const WOOD_DROP_AMOUNTS: ReadonlyArray<[number, number]> = [
   [2, 3],
   [4, 5]
];

export function createTree(position: Point): Entity {
   const size = Math.random() > 1/3 ? 1 : 0;

   const tree = new Entity(position, IEntityType.tree, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   tree.rotation = 2 * Math.PI * Math.random();

   const mass = 1.25 + size * 0.25;
   const hitbox = new CircularHitbox(tree, mass, 0, 0, TREE_RADII[size]);
   tree.addHitbox(hitbox);

   HealthComponentArray.addComponent(tree, new HealthComponent(TREE_MAX_HEALTHS[size]));
   StatusEffectComponentArray.addComponent(tree, new StatusEffectComponent(0));
   TreeComponentArray.addComponent(tree, {
      treeSize: size
   });

   return tree;
}

export function onTreeDeath(tree: Entity): void {
   const treeComponent = TreeComponentArray.getComponent(tree.id);
   createItemsOverEntity(tree, ItemType.wood, randInt(...WOOD_DROP_AMOUNTS[treeComponent.treeSize]));
}

export function onTreeRemove(tree: Entity): void {
   HealthComponentArray.removeComponent(tree);
   StatusEffectComponentArray.removeComponent(tree);
   TreeComponentArray.removeComponent(tree);
}

export function serialiseTreeComponent(tree: Entity): TreeComponentData {
   const treeComponent = TreeComponentArray.getComponent(tree.id);
   return {
      treeSize: treeComponent.treeSize
   };
}