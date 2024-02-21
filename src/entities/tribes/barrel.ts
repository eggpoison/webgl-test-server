import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst, TribeType } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, InventoryComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";
import Tribe from "../../Tribe";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import { TribeComponent } from "../../components/TribeComponent";

export const BARREL_SIZE = 80;

export function createBarrel(position: Point, tribe: Tribe | null): Entity {
   const barrel = new Entity(position, IEntityType.barrel, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   const hitbox = new CircularHitbox(barrel, 1.5, 0, 0, BARREL_SIZE / 2, 0);
   barrel.addHitbox(hitbox);

   HealthComponentArray.addComponent(barrel, new HealthComponent(20));
   StatusEffectComponentArray.addComponent(barrel, new StatusEffectComponent(StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(barrel, new TribeComponent(tribe));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(barrel, inventoryComponent);
   createNewInventory(inventoryComponent, "inventory", 3, 3, false);

   return barrel;
}

export function onBarrelRemove(barrel: Entity): void {
   HealthComponentArray.removeComponent(barrel);
   StatusEffectComponentArray.removeComponent(barrel);
   InventoryComponentArray.removeComponent(barrel);
   TribeComponentArray.removeComponent(barrel);
}