import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point } from "webgl-test-shared";
import Entity from "../../Entity";
import { DoorComponentArray, HealthComponentArray, StatusEffectComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";
import Tribe from "../../Tribe";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { DoorComponent } from "../../components/DoorComponent";
import { TribeComponent } from "../../components/TribeComponent";

export function createWoodenDoor(position: Point, tribe: Tribe | null, rotation: number): Entity {
   const door = new Entity(position, IEntityType.woodenDoor, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   door.rotation = rotation;

   const hitbox = new RectangularHitbox(door, 1, 0, 0, 64, 16, 0);
   door.addHitbox(hitbox);
   
   HealthComponentArray.addComponent(door, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(door, new StatusEffectComponent(0));
   DoorComponentArray.addComponent(door, new DoorComponent(position.x, position.y, rotation));
   TribeComponentArray.addComponent(door, new TribeComponent(tribe)); 

   return door;
}

export function onWoodenDoorRemove(door: Entity): void {
   HealthComponentArray.removeComponent(door);
   StatusEffectComponentArray.removeComponent(door);
   DoorComponentArray.removeComponent(door);
   TribeComponentArray.removeComponent(door);
}