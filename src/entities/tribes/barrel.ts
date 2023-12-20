import { IEntityType, Point } from "webgl-test-shared";
import Entity from "../../GameObject";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, InventoryComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";

export const BARREL_SIZE = 80;

export function createBarrel(position: Point): Entity {
   const barrel = new Entity(position, IEntityType.barrel);

   const hitbox = new CircularHitbox(barrel, 0, 0, BARREL_SIZE / 2);
   barrel.addHitbox(hitbox);

   HealthComponentArray.addComponent(barrel, new HealthComponent(20));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(barrel, inventoryComponent);
   createNewInventory(inventoryComponent, "inventory", 3, 3, false);
   
   TribeComponentArray.addComponent(barrel, {
      tribeType: 0,
      tribe: null
   });

   return barrel;
}