import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { CookingEntityComponentArray, HealthComponentArray, InventoryComponentArray, StatusEffectComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";
import { tickCookingEntity } from "./cooking-entity";
import { CookingEntityComponent } from "../../components/CookingEntityComponent";

export const CAMPFIRE_SIZE = 104;

const LIFETIME_SECONDS = 30;

export function createCampfire(position: Point): Entity {
   const campfire = new Entity(position, IEntityType.campfire, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(campfire, 2, 0, 0, CAMPFIRE_SIZE / 2, 0);
   campfire.addHitbox(hitbox);

   HealthComponentArray.addComponent(campfire, new HealthComponent(25));
   StatusEffectComponentArray.addComponent(campfire, new StatusEffectComponent(StatusEffectConst.poisoned));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(campfire, inventoryComponent);
   createNewInventory(inventoryComponent, "fuelInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "ingredientInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "outputInventory", 1, 1, false);

   const cookingEntityComponent = new CookingEntityComponent();
   cookingEntityComponent.remainingHeatSeconds = LIFETIME_SECONDS;
   CookingEntityComponentArray.addComponent(campfire, cookingEntityComponent);

   campfire.isStatic = true;
   
   return campfire;
}

export function tickCampfire(campfire: Entity): void {
   tickCookingEntity(campfire);
}

export function onCampfireRemove(campfire: Entity): void {
   HealthComponentArray.removeComponent(campfire);
   StatusEffectComponentArray.removeComponent(campfire);
   InventoryComponentArray.removeComponent(campfire);
}