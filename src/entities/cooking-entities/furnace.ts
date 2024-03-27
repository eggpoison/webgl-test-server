import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, InventoryComponentArray, CookingComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { CookingComponent } from "../../components/CookingComponent";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { tickCookingEntity } from "./cooking-entity";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";

export const FURNACE_SIZE = 80;

export function createFurnace(position: Point, rotation: number, tribe: Tribe): Entity {
   const furnace = new Entity(position, IEntityType.furnace, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   furnace.rotation = rotation;

   const hitbox = new RectangularHitbox(furnace, 2, 0, 0, HitboxCollisionTypeConst.hard, FURNACE_SIZE, FURNACE_SIZE);
   furnace.addHitbox(hitbox);

   HealthComponentArray.addComponent(furnace, new HealthComponent(25));
   StatusEffectComponentArray.addComponent(furnace, new StatusEffectComponent(StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(furnace, new TribeComponent(tribe));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(furnace, inventoryComponent);
   createNewInventory(inventoryComponent, "fuelInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "ingredientInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "outputInventory", 1, 1, false);

   CookingComponentArray.addComponent(furnace, new CookingComponent());

   return furnace;
}

export function onFurnaceJoin(furnace: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(furnace.id);
   tribeComponent.tribe.addBuilding(furnace);
}

export function tickFurnace(furnace: Entity): void {
   tickCookingEntity(furnace);
}

export function onFurnaceRemove(furnace: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(furnace.id);
   tribeComponent.tribe.removeBuilding(furnace);

   HealthComponentArray.removeComponent(furnace);
   StatusEffectComponentArray.removeComponent(furnace);
   InventoryComponentArray.removeComponent(furnace);
   TribeComponentArray.removeComponent(furnace);
}