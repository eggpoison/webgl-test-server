import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { CookingComponentArray, HealthComponentArray, InventoryComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";
import { tickCookingEntity } from "./cooking-entity";
import { CookingComponent } from "../../components/CookingComponent";

export const CAMPFIRE_SIZE = 104;

const LIFETIME_SECONDS = 30;

export function createCampfire(position: Point): Entity {
   const campfire = new Entity(position, IEntityType.campfire, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(campfire, 2, 0, 0, HitboxCollisionTypeConst.soft, CAMPFIRE_SIZE / 2);
   campfire.addHitbox(hitbox);

   HealthComponentArray.addComponent(campfire, new HealthComponent(25));
   StatusEffectComponentArray.addComponent(campfire, new StatusEffectComponent(StatusEffectConst.poisoned));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(campfire, inventoryComponent);
   createNewInventory(inventoryComponent, "fuelInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "ingredientInventory", 1, 1, false);
   createNewInventory(inventoryComponent, "outputInventory", 1, 1, false);

   const cookingEntityComponent = new CookingComponent();
   cookingEntityComponent.remainingHeatSeconds = LIFETIME_SECONDS;
   CookingComponentArray.addComponent(campfire, cookingEntityComponent);

   return campfire;
}

export function tickCampfire(campfire: Entity): void {
   // @Incomplete: Destroy campfire when remaining heat reaches 0
   tickCookingEntity(campfire);
}

export function onCampfireRemove(campfire: Entity): void {
   HealthComponentArray.removeComponent(campfire);
   StatusEffectComponentArray.removeComponent(campfire);
   InventoryComponentArray.removeComponent(campfire);
}