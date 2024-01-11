import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, StatusEffectComponentArray, InventoryComponentArray, CookingEntityComponentArray } from "../../components/ComponentArray";
import { CookingEntityComponent } from "../../components/CookingEntityComponent";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { tickCookingEntity } from "./cooking-entity";

export const FURNACE_SIZE = 80;

export function createFurnace(position: Point): Entity {
   const furnace = new Entity(position, IEntityType.furnace, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new RectangularHitbox(furnace, 2, 0, 0, FURNACE_SIZE, FURNACE_SIZE, 0);
   furnace.addHitbox(hitbox);

   HealthComponentArray.addComponent(furnace, new HealthComponent(25));
   StatusEffectComponentArray.addComponent(furnace, new StatusEffectComponent(StatusEffectConst.poisoned));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(furnace, inventoryComponent);
   createNewInventory(inventoryComponent, "fuelInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "ingredientInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "outputInventory", 1, 1, false);

   CookingEntityComponentArray.addComponent(furnace, new CookingEntityComponent());

   furnace.isStatic = true;

   return furnace;
}

export function tickFurnace(furnace: Entity): void {
   tickCookingEntity(furnace);
}

export function onFurnaceRemove(furnace: Entity): void {
   HealthComponentArray.removeComponent(furnace);
   StatusEffectComponentArray.removeComponent(furnace);
   InventoryComponentArray.removeComponent(furnace);
}