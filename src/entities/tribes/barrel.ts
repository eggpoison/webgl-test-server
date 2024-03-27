import { COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponentArray, InventoryComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { InventoryComponent, createNewInventory } from "../../components/InventoryComponent";
import Tribe from "../../Tribe";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { TribeComponent } from "../../components/TribeComponent";

export const BARREL_SIZE = 80;

export function createBarrel(position: Point, rotation: number, tribe: Tribe): Entity {
   const barrel = new Entity(position, IEntityType.barrel, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   barrel.rotation = rotation;

   const hitbox = new CircularHitbox(barrel.position.x, barrel.position.y, 1.5, 0, 0, HitboxCollisionTypeConst.hard, BARREL_SIZE / 2, barrel.getNextHitboxLocalID(), barrel.rotation);
   barrel.addHitbox(hitbox);

   HealthComponentArray.addComponent(barrel, new HealthComponent(20));
   StatusEffectComponentArray.addComponent(barrel, new StatusEffectComponent(StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(barrel, new TribeComponent(tribe));

   const inventoryComponent = new InventoryComponent();
   InventoryComponentArray.addComponent(barrel, inventoryComponent);
   createNewInventory(inventoryComponent, "inventory", 3, 3, false);

   tribe.addBarrel(barrel);

   return barrel;
}

export function onBarrelRemove(barrel: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(barrel.id);
   tribeComponent.tribe.removeBarrel(barrel);
   
   HealthComponentArray.removeComponent(barrel);
   StatusEffectComponentArray.removeComponent(barrel);
   InventoryComponentArray.removeComponent(barrel);
   TribeComponentArray.removeComponent(barrel);
}